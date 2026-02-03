"""
Kotaemon Proxy Server
=====================
A FastAPI proxy service that connects to Kotaemon (Gradio-based RAG)
and exposes REST endpoints for the Dicoding Gen AI webapp.

Endpoints:
- POST /api/kotaemon/chat - Send chat messages with RAG
- POST /api/kotaemon/upload - Upload documents for indexing
- POST /api/kotaemon/delete - Delete documents from vector store
- GET /api/kotaemon/status - Check Kotaemon connection status
- GET /api/kotaemon/api-info - Get available Kotaemon API endpoints
"""

import os
import re
import asyncio
import sqlite3
from pathlib import Path
from typing import Optional, List, Any, Union
from contextlib import asynccontextmanager
import uuid
import hmac
import hashlib
import time
from datetime import datetime

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from gradio_client import Client, handle_file

# Import database and routes
from models import init_database, close_database, db
from middleware import require_auth
from routes import chats_router, documents_router

# Import agent system (Kotaemon-based, no direct Gemini calls)
from agents import (
    LangGraphQuestionAgent,
    get_agent,
    reset_agent,
    AgentStyle,
    AgentRequest,
    AgentResponse,
    QuestionType,
    ExportFormat,
    EditQuestionRequest,
    GenerateQuestionParams,
    save_session_question_set,
)

# Load environment variables
load_dotenv()

# Configuration
KOTAEMON_URL = os.getenv("KOTAEMON_URL", "http://localhost:7860")
KOTAEMON_USERNAME = os.getenv("KOTAEMON_USERNAME", "admin")
KOTAEMON_PASSWORD = os.getenv("KOTAEMON_PASSWORD", "admin")
PROXY_HOST = os.getenv("PROXY_HOST", "0.0.0.0")
PROXY_PORT = int(os.getenv("PROXY_PORT", "8000"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")

# Kotaemon database path (for reading document list)
KOTAEMON_DB_PATH = os.getenv(
    "KOTAEMON_DB_PATH",
    str(Path(__file__).parent.parent / "ktem_app_data" / "user_data" / "sql.db")
)

# Global client instance
kotaemon_client: Optional[Client] = None
api_info: Optional[dict] = None

# Global agent instances (LangGraph-based with Pydantic tools)
question_agent: Optional[LangGraphQuestionAgent] = None


# Pydantic Models
class ChatRequest(BaseModel):
    chatInput: str
    sessionId: str
    action: str = "sendMessage"
    model: Optional[str] = "default"
    maxTokens: Optional[int] = 2048
    temperature: Optional[float] = 0.7
    topK: Optional[int] = 40
    topP: Optional[float] = 0.95
    document: Optional[str] = "none"
    selectedDocuments: Optional[List[str]] = []  # For multi-document selection
    history: Optional[List[List[str]]] = []
    agentStyle: Optional[str] = "none"  # Added for agent support
    imageUrl: Optional[str] = None  # Added for image support


class ChatResponse(BaseModel):
    output: str
    sources: Optional[List[dict]] = None
    sessionId: str
    # Agent response fields
    questions: Optional[dict] = None
    exportJson: Optional[str] = None
    exportMarkdown: Optional[str] = None
    editable: bool = False


class UploadRequest(BaseModel):
    filePath: str


class DeleteRequest(BaseModel):
    filePath: str


class StatusResponse(BaseModel):
    connected: bool
    kotaemon_url: str
    message: str


def connect_to_kotaemon():
    """Initialize connection to Kotaemon Gradio server."""
    global kotaemon_client, api_info

    try:
        print(f"🔌 Connecting to Kotaemon at {KOTAEMON_URL}...")

        # Connect WITHOUT auth (Kotaemon handles auth via API endpoint)
        kotaemon_client = Client(KOTAEMON_URL)

        # Login via Kotaemon's API endpoint
        if KOTAEMON_USERNAME and KOTAEMON_PASSWORD:
            try:
                login_result = kotaemon_client.predict(
                    KOTAEMON_USERNAME,
                    KOTAEMON_PASSWORD,
                    api_name="/login_1"
                )
                print(f"✅ Logged in as {KOTAEMON_USERNAME}")
            except Exception as login_error:
                print(f"⚠️ Login warning: {login_error} (continuing without login)")

        # Get API info to discover available endpoints
        api_info = kotaemon_client.view_api(return_format="dict")
        print(f"✅ Connected to Kotaemon successfully!")

        # List key endpoints
        named_eps = list(api_info.get('named_endpoints', {}).keys())
        key_eps = [e for e in named_eps if any(k in e for k in ['chat', 'submit', 'upload', 'file', 'login'])]
        print(f"📋 Key endpoints: {key_eps[:10]}...")

        return True
    except Exception as e:
        print(f"❌ Failed to connect to Kotaemon: {e}")
        kotaemon_client = None
        api_info = None
        return False


async def fetch_kotaemon_file_uuid(filename: str) -> Optional[str]:
    """
    Query Kotaemon API to get UUID for a file by filename.
    
    This function queries Kotaemon's file list API to find the UUID
    for a recently uploaded file. Used when SQLite DB is not accessible.
    """
    global kotaemon_client
    
    if kotaemon_client is None:
        print("⚠️ Cannot fetch UUID: Kotaemon client not connected")
        return None
    
    try:
        loop = asyncio.get_running_loop()
        
        # Login first
        try:
            await loop.run_in_executor(
                None,
                lambda: kotaemon_client.predict(KOTAEMON_USERNAME, KOTAEMON_PASSWORD, api_name="/login_1")
            )
        except Exception:
            pass  # Ignore login errors
        
            # Try to get file choices from Kotaemon (this returns file list with UUIDs)
        try:
            # This typically returns a DataFrame or list of files
            # Try multiple potential endpoints
            result = None
            for endpoint in ["/load_files_2", "/load_files", "/get_file_list", "/file_list"]:
                if endpoint in api_info.get("named_endpoints", {}):
                    print(f"🔍 Testing endpoint {endpoint} for file list...")
                    try:
                        result = await loop.run_in_executor(
                            None,
                            lambda: kotaemon_client.predict(api_name=endpoint)
                        )
                        if result:
                            # Gradio update object
                             if isinstance(result, tuple) and len(result) > 0 and isinstance(result[0], dict) and 'choices' in result[0]:
                                  result = result[0]['choices'] # Extract relevant list
                                  print(f"✅ Endpoint {endpoint} returned choices list")
                                  break
                             
                             print(f"✅ Endpoint {endpoint} returned raw data: {type(result)}")
                             if result: # If not empty
                                 break
                    except Exception as ep_err:
                        print(f"⚠️ Endpoint {endpoint} failed: {ep_err}")

            # Parse result to find our file
            if result:
                # Debug result structure (print first item)
                if isinstance(result, (list, tuple)) and len(result) > 0:
                     print(f"📄 Sample file item: {result[0]}")

                # List parsing logic
                if isinstance(result, (list, tuple)):
                    for item in result:
                        # 1. Dict format: {'name': 'foo.pdf', 'id': '...'}
                        if isinstance(item, dict) and filename in str(item.get('name', item.get('filename', ''))):
                            uuid_val = item.get('id') or item.get('uuid') or item.get('file_id')
                            if uuid_val:
                                return str(uuid_val)
                        
                        # 2. List/Tuple format: ['filename', 'uuid'] (Common in Kotaemon)
                        elif isinstance(item, (list, tuple)) and len(item) >= 2:
                            # Check if filename is index 0
                            if filename in str(item[0]):
                                return str(item[1]) # UUID is likely index 1
                            # Check if filename is index 1
                            elif filename in str(item[1]):
                                return str(item[0]) # UUID might be index 0

            # Fallback: Query direct SQL via Gradio if possible? No.
            
        except Exception as e:
            print(f"⚠️ Could not query /load_files: {e}")
        
        print(f"⚠️ Could not find UUID for {filename} via Kotaemon API")
        return None
        
    except Exception as e:
        print(f"❌ Error fetching UUID from Kotaemon: {e}")
        return None


async def store_kotaemon_uuid_in_mongodb(user_id: str, filename: str, kotaemon_uuid: str):
    """
    Store Kotaemon UUID in MongoDB for a document.
    
    Updates the document record to include kotaemon_uuid field.
    """
    try:
        # Find by path (which includes user_id/filename pattern)
        result = await db.documents.update_one(
            {
                "userId": user_id,
                "$or": [
                    {"path": {"$regex": filename}},
                    {"title": filename}
                ]
            },
            {"$set": {"kotaemon_uuid": kotaemon_uuid, "updatedAt": datetime.utcnow()}}
        )
        
        if result.modified_count > 0:
            print(f"✅ Stored Kotaemon UUID {kotaemon_uuid} for {filename}")
            return True
        else:
            # Document might not exist yet, create minimal record
            await db.documents.insert_one({
                "userId": user_id,
                "title": filename,
                "path": f"{user_id}/{filename}",
                "kotaemon_uuid": kotaemon_uuid,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            })
            print(f"✅ Created new document record with UUID {kotaemon_uuid}")
            return True
            
    except Exception as e:
        print(f"❌ Error storing UUID in MongoDB: {e}")
        return False


async def get_kotaemon_uuid_from_mongodb(user_id: str, filename: str) -> Optional[str]:
    """
    Get Kotaemon UUID from MongoDB for a document.
    
    Returns the stored kotaemon_uuid if available.
    """
    try:
        doc = await db.documents.find_one({
            "userId": user_id,
            "$or": [
                {"path": {"$regex": filename}},
                {"title": filename}
            ]
        })
        
        if doc and doc.get("kotaemon_uuid"):
            return doc["kotaemon_uuid"]
        return None
        
    except Exception as e:
        print(f"⚠️ Error getting UUID from MongoDB: {e}")
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    print("🚀 Starting unified backend...")

    # Initialize MongoDB
    try:
        await init_database()
    except Exception as e:
        print(f"⚠️ MongoDB connection failed: {e}")
        print("   Continuing without database - chat/document APIs will not work")

    # Connect to Kotaemon
    connect_to_kotaemon()

    yield

    # Shutdown
    print("🛑 Shutting down unified backend...")
    await close_database()


# Create FastAPI app
app = FastAPI(
    title="Kotaemon Proxy API",
    description="Proxy server for Kotaemon RAG integration with Dicoding Gen AI",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers from Express.js migration
app.include_router(chats_router)
app.include_router(documents_router)

# Serve static files (uploads)
import os
from pathlib import Path
uploads_path = Path(os.getenv("UPLOAD_DIR", "./uploads"))
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "Kotaemon Proxy", "version": "1.0.0"}


@app.get("/api/kotaemon/status", response_model=StatusResponse)
async def get_status():
    """Check Kotaemon connection status."""
    if kotaemon_client is None:
        # Try to reconnect
        connected = connect_to_kotaemon()
        if not connected:
            return StatusResponse(
                connected=False,
                kotaemon_url=KOTAEMON_URL,
                message="Failed to connect to Kotaemon. Make sure it's running."
            )

    return StatusResponse(
        connected=True,
        kotaemon_url=KOTAEMON_URL,
        message="Connected to Kotaemon successfully"
    )


@app.get("/api/kotaemon/api-info")
async def get_api_info():
    """Get available Kotaemon API endpoints."""
    if api_info is None:
        raise HTTPException(status_code=503, detail="Not connected to Kotaemon")

    return api_info


@app.post("/api/kotaemon/reconnect")
async def reconnect():
    """Force reconnection to Kotaemon."""
    connected = connect_to_kotaemon()
    if connected:
        return {"status": "connected", "message": "Reconnected successfully"}
    raise HTTPException(status_code=503, detail="Failed to reconnect to Kotaemon")


@app.get("/api/kotaemon/documents")
async def get_kotaemon_documents(user_id: str = Depends(require_auth)):
    """
    Get list of documents indexed in Kotaemon, filtered by user ownership.

    1. Fetches user's allowed documents from MongoDB.
    2. Reads Kotaemon's SQLite database.
    3. Filters Kotaemon results to only show documents the user owns.
    """
    try:
        # 1. Get user's allowed files from MongoDB
        # We need the 'title' (original filename) or 'path' to match
        user_docs_cursor = db.documents.find({"userId": user_id})
        user_docs = await user_docs_cursor.to_list(length=1000)
        
        # Create a set of allowed filenames (and clean names)
        # We match against the 'title' (filename) as that's what seems to be stored in Kotaemon 'name'
        allowed_filenames = set()
        for d in user_docs:
            if "title" in d:
                allowed_filenames.add(d["title"])
            if "path" in d:
                # Path is usually "userid/filename.ext", extract filename just in case
                allowed_filenames.add(os.path.basename(d["path"]))

        if not os.path.exists(KOTAEMON_DB_PATH):
            print(f"⚠️ Kotaemon database not found at: {KOTAEMON_DB_PATH}")
            return {"documents": [], "message": "Kotaemon database not found"}

        conn = sqlite3.connect(KOTAEMON_DB_PATH)
        cursor = conn.cursor()

        documents = []

        # Query all index source tables (index__1__source, index__2__source, index__3__source)
        # These contain the actual indexed documents
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'index__%__source'")
        source_tables = cursor.fetchall()

        for (table_name,) in source_tables:
            try:
                # Extract index number from table name
                parts = table_name.split('__')
                index_num = parts[1] if len(parts) >= 2 else "unknown"

                # Get index type name
                cursor.execute(f"SELECT name FROM ktem__index WHERE id = ?", (int(index_num),))
                index_info = cursor.fetchone()
                index_type = index_info[0] if index_info else f"Index {index_num}"

                # Query documents from this index
                cursor.execute(f"""
                    SELECT id, name, size, date_created, note
                    FROM {table_name}
                    ORDER BY date_created DESC
                """)
                rows = cursor.fetchall()

                for row in rows:
                    doc_id, name, size, date_created, note = row
                    
                    # FILTERING LOGIC: Check if this file belongs to the user
                    # 1. Check exact name match
                    # 2. Check if name is in allowed list (ignoring timestamp prefix if needed)
                    
                    is_allowed = False
                    
                    # Exact match
                    if name in allowed_filenames:
                        is_allowed = True
                    
                    # Check regex match if exact match fails (timestamps)
                    if not is_allowed:
                        import re
                        timestamp_match = re.match(r'^\d{8}_\d{6}_(.+)$', name)
                        if timestamp_match:
                            clean_name = timestamp_match.group(1)
                            if clean_name in allowed_filenames:
                                is_allowed = True
                    
                    if not is_allowed:
                        continue # Skip this document, not owned by user

                    # Parse note JSON for additional info
                    import json
                    try:
                        note_data = json.loads(note) if note else {}
                    except:
                        note_data = {}

                    # Create display name (without timestamp prefix)
                    display_name = name
                    import re
                    timestamp_match = re.match(r'^\d{8}_\d{6}_(.+)$', name)
                    if timestamp_match:
                        display_name = timestamp_match.group(1)

                    # Detect file type from extension
                    file_type = 'file'
                    if name.lower().endswith('.pdf'):
                        file_type = 'pdf'
                    elif name.lower().endswith(('.doc', '.docx')):
                        file_type = 'doc'
                    elif name.lower().endswith(('.xls', '.xlsx')):
                        file_type = 'xls'
                    elif name.lower().endswith(('.ppt', '.pptx')):
                        file_type = 'ppt'

                    documents.append({
                        "id": doc_id,
                        "name": name,  # This is the exact name to use for first_selector_choices
                        "display_name": display_name,  # User-friendly name without timestamp
                        "type": file_type,
                        "size": size,
                        "tokens": note_data.get("tokens"),
                        "loader": note_data.get("loader"),
                        "dateCreated": date_created,
                        "indexType": index_type,
                        "indexId": index_num,
                        "source": "kotaemon"
                    })
            except Exception as table_error:
                print(f"⚠️ Error reading table {table_name}: {table_error}")
                continue

        conn.close()

        print(f"📚 Found {len(documents)} documents for user {user_id}")
        return {"documents": documents, "total": len(documents)}

    except Exception as e:
        print(f"❌ Error reading Kotaemon documents: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to read Kotaemon documents: {str(e)}")


@app.get("/api/kotaemon/file-ids")
async def get_file_ids():
    """Get file IDs with UUID mapping from Kotaemon database."""
    try:
        if not os.path.exists(KOTAEMON_DB_PATH):
            return {"files": [], "message": "Kotaemon database not found"}

        # Get set of actual files on disk to filter out "ghost" entries
        # We need to check recursively because files are in user subdirectories
        actual_files = set()
        if UPLOAD_DIR:
            upload_path = Path(UPLOAD_DIR)
            if upload_path.exists():
                # Get all filenames in upload dir (recursive)
                for p in upload_path.rglob("*"):
                    if p.is_file():
                        actual_files.add(p.name)
        
        print(f"📂 Found {len(actual_files)} physical files in storage")

        conn = sqlite3.connect(KOTAEMON_DB_PATH)
        cursor = conn.cursor()
        files = []

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'index__%__source'")
        source_tables = cursor.fetchall()

        for (table_name,) in source_tables:
            try:
                parts = table_name.split('__')
                index_num = parts[1] if len(parts) >= 2 else "unknown"

                cursor.execute(f"SELECT name FROM ktem__index WHERE id = ?", (int(index_num),))
                index_info = cursor.fetchone()
                index_type = index_info[0] if index_info else f"Index {index_num}"

                cursor.execute(f"SELECT id, name, date_created FROM {table_name} ORDER BY date_created DESC")
                rows = cursor.fetchall()

                for row in rows:
                    file_id, name, date_created = row
                    
                    # Skip if file doesn't exist on disk (Ghost file)
                    if name not in actual_files:
                        print(f"👻 Ghost file found in DB but missing on disk: {name} (Skipping)")
                        continue
                        
                    display_name = name
                    timestamp_match = re.match(r'^\d{8}_\d{6}_(.+)$', name)
                    if timestamp_match:
                        display_name = timestamp_match.group(1)

                    files.append({
                        "uuid": file_id,
                        "filename": name,
                        "displayName": display_name,
                        "indexType": index_type,
                        "indexId": index_num,
                        "dateCreated": date_created
                    })
            except Exception as table_error:
                print(f"⚠️ Error reading table {table_name}: {table_error}")
                continue

        conn.close()
        return {"files": files, "total": len(files), "databasePath": KOTAEMON_DB_PATH}

    except Exception as e:
        print(f"❌ Error reading file IDs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to read file IDs: {str(e)}")


@app.post("/api/kotaemon/chat")
async def chat(request: ChatRequest, user_id: str = Depends(require_auth)):
    """
    Send a chat message to Kotaemon RAG.

    This endpoint:
    1. Checks if agent style is set AND message is a question generation request
    2. If so, routes to the agent system
    3. Otherwise, sends to Kotaemon for normal RAG chat
    4. Returns the response with optional sources and question data
    """
    global question_agent

    # Check if this is an agent request
    agent_style = (request.agentStyle or "none").lower()

    # Route to agent if agent mode is enabled (Agent decides intent)
    if agent_style != "none":
        print(f"🤖 Agent active: style={agent_style}")
        print(f"🤖 Agent active: Delegating to Agent Router for decision...")

        try:
            # Determine documents to use (passed to agent, Kotaemon handles RAG)
            docs_to_query = []
            if request.selectedDocuments and len(request.selectedDocuments) > 0:
                docs_to_query = request.selectedDocuments
            elif request.document and request.document != "none":
                docs_to_query = [request.document]

            # Note: We don't retrieve RAG context here anymore
            # Kotaemon handles both RAG and LLM processing
            print(f"📚 Documents selected: {docs_to_query if docs_to_query else 'none'}")

            # Initialize agent if needed
            if question_agent is None:
                question_agent = get_agent(model=request.model or "gemini-2.5-flash")

            # Create agent request (Kotaemon will handle RAG internally)
            # Create agent request (Kotaemon will handle RAG internally)
            # Append Image URL to message if present
            final_message = request.chatInput
            if request.imageUrl:
                final_message = f"{final_message}\n\n[Sematan Gambar: {request.imageUrl}]"

            agent_request = AgentRequest(
                agent_style=AgentStyle.GENERATE_QUESTION,
                message=final_message,
                session_id=request.sessionId,
                context=None,  # Kotaemon handles RAG
                document=docs_to_query[0] if docs_to_query else None,
                documents=docs_to_query,  # Pass all selected documents for RAG
                history=request.history or [],
                language="id",
                image_url=request.imageUrl
            )

            # Process with agent (sends to Kotaemon)
            print(f"🚀 Sending to Kotaemon via agent...")
            agent_response = await question_agent.process_request(
                agent_request,
                kotaemon_client
            )

            return ChatResponse(
                output=agent_response.output,
                sources=agent_response.sources,
                sessionId=request.sessionId,
                questions=agent_response.questions.model_dump() if agent_response.questions else None,
                exportJson=agent_response.export_json,
                exportMarkdown=agent_response.export_markdown,
                editable=agent_response.editable
            )

        except Exception as e:
            print(f"❌ Question generation error: {e}")
            import traceback
            traceback.print_exc()
            print("⚠️ Falling back to normal Kotaemon chat")

    # Normal Kotaemon RAG chat
    if kotaemon_client is None:
        # Try to reconnect
        if not connect_to_kotaemon():
            raise HTTPException(
                status_code=503,
                detail="Not connected to Kotaemon. Please ensure Kotaemon is running at " + KOTAEMON_URL
            )

    try:
        # Format chat history for Kotaemon
        # Kotaemon expects: [[user_msg1, bot_msg1], [user_msg2, bot_msg2], ...]
        history = []
        if request.history:
            for h in request.history:
                if isinstance(h, list) and len(h) >= 2:
                    history.append([h[0], h[1]])

        # Map LLM provider from request model name
        model_name = (request.model or "").lower()

        # Detect LLM type based on model name
        if "gemini" in model_name or "google" in model_name or "bison" in model_name or "learnlm" in model_name:
            llm_type = "google"
        elif "gpt" in model_name or "openai" in model_name or "o1" in model_name:
            llm_type = "openai"
        elif "claude" in model_name or "anthropic" in model_name:
            llm_type = "claude"
        elif "llama" in model_name or "ollama" in model_name or "mistral" in model_name or "hf.co" in model_name or "qwen" in model_name:
            llm_type = "ollama"
        elif "cohere" in model_name or "command" in model_name:
            llm_type = "cohere"
        elif "groq" in model_name:
            llm_type = "groq"
        else:
            llm_type = "google"  # Default to Google/Gemini

        print(f"📝 Chat request: model={request.model} -> llm_type={llm_type}")

        # Determine which documents to use
        docs_for_rag = []
        if request.selectedDocuments and len(request.selectedDocuments) > 0:
            docs_for_rag = request.selectedDocuments
            print(f"📚 Using selected documents: {docs_for_rag}")
        elif request.document and request.document != "none":
            docs_for_rag = [request.document]
            print(f"📚 Using single document: {docs_for_rag}")

        # Convert filenames to UUIDs and categorize by Index Source
        file_index_uuids = []
        lightrag_uuids = []
        docs_with_uuids = [] # Keep track of all valid UUIDs
        
        if docs_for_rag:
            try:
                conn = sqlite3.connect(KOTAEMON_DB_PATH)
                cursor = conn.cursor()
                
                # Get all index tables first
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'index__%__source'")
                all_tables = cursor.fetchall()
                
                for doc in docs_for_rag:
                    found_uuid = None
                    found_table = None

                    # Check if it's already a UUID
                    if re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', doc, re.I):
                        # If it's already a UUID, we need to find WHERE it lives to categorize it
                        # If we assume it's from LightRAG (dashboard default), we might be wrong.
                        # Ideally search for the UUID in ID column?
                        # For safety/speed, dashboard files are usually LightRAG.
                        # But let's try to verify if we can.
                        # For now, let's treat explicit UUIDs as LightRAG default unless we find them elsewhere?
                        # Actually, searching by ID is fast.
                        found_in_search = False
                        for (table_name,) in all_tables:
                             cursor.execute(f"SELECT id FROM {table_name} WHERE id = ?", (doc,))
                             if cursor.fetchone():
                                 found_uuid = doc
                                 found_table = table_name
                                 found_in_search = True
                                 break
                        
                        if not found_in_search:
                             # Default to LightRAG if not found (or if passed as raw UUID)
                             lightrag_uuids.append(doc)
                             docs_with_uuids.append(doc)
                             print(f"✅ Preserving UUID (defaulting to LightRAG): {doc}")
                             continue
                    
                    if not found_uuid:
                        # Convert filename to UUID - search all tables
                        for (table_name,) in all_tables:
                            # 1. Exact match
                            cursor.execute(f"SELECT id FROM {table_name} WHERE name = ?", (doc,))
                            result = cursor.fetchone()
                            
                            # 2. Try with LIKE pattern
                            if not result:
                                cursor.execute(f"SELECT id FROM {table_name} WHERE name LIKE ?", (f"%{doc}%",))
                                result = cursor.fetchone()
                            
                            # 3. Try reverse (clean filename)
                            if not result:
                                clean_doc = re.sub(r'^\d{8}_\d{6}_', '', doc)
                                cursor.execute(f"SELECT id FROM {table_name} WHERE name LIKE ?", (f"%{clean_doc}%",))
                                result = cursor.fetchone()

                            if result:
                                found_uuid = result[0]
                                found_table = table_name
                                break
                    
                    if found_uuid and found_table:
                        docs_with_uuids.append(found_uuid)
                        print(f"✅ Found '{doc}' in {found_table} -> {found_uuid}")
                        
                        if "index__1" in found_table:
                            file_index_uuids.append(found_uuid)
                        else:
                            lightrag_uuids.append(found_uuid)
                    else:
                        print(f"⚠️ Could not find UUID for '{doc}', skipping")
                
                conn.close()
            except Exception as e:
                print(f"⚠️ UUID conversion error: {e}")
                # Fallback: assume LightRAG for everything if DB fails
                lightrag_uuids = docs_for_rag
                docs_with_uuids = docs_for_rag
        
        # Determine file selection mode based on whether documents are selected
        # If ANY documents are selected, we go into 'select' mode for both (filtering others out)
        # If NO documents are selected, we go into 'full' mode for both
        file_selection_mode = 'select' if docs_with_uuids else 'full'

        # Step 1: Login before each request (Kotaemon Gradio is stateless)
        try:
            kotaemon_client.predict(KOTAEMON_USERNAME, KOTAEMON_PASSWORD, api_name="/login_1")
            print(f"✅ Logged in as {KOTAEMON_USERNAME}")
        except Exception as login_error:
            print(f"⚠️ Login warning: {login_error} (continuing without login)")

        # Step 2: Load selected files for LightRAG (index 3) - use UUIDs
        if docs_with_uuids:
            try:
                kotaemon_client.predict(selected_files=docs_with_uuids, api_name="/load_files_2")
                print(f"📂 Loaded files for LightRAG (UUIDs): {docs_with_uuids}")
            except Exception as load_error:
                print(f"⚠️ Load files warning: {load_error} (continuing)")

        # Step 3: Submit message using /submit_msg - use UUIDs
        files_to_send = []
        
        # Handle Image Download & Indexing if present
        if request.imageUrl:
            try:
                import requests
                import tempfile

                # Run blocking prediction in a thread to avoid blocking the async event loop
                loop = asyncio.get_running_loop()
                
                # Create a temp file
                suffix = ".png" if ".png" in request.imageUrl.lower() else ".jpg"
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
                    print(f"⬇️ Downloading image from {request.imageUrl} for normal chat...")
                    # Run requests.get in executor to avoid blocking
                    response = await loop.run_in_executor(None, requests.get, request.imageUrl)
                    if response.status_code == 200:
                        tmp_file.write(response.content)
                        temp_image_path = tmp_file.name
                        print(f"📸 Image saved to {temp_image_path}")

                        # Upload to Kotaemon to index it (LightRAG)
                        try:
                            from gradio_client import handle_file
                            print(f"📤 Indexing image to Kotaemon: {temp_image_path}")
                            await loop.run_in_executor(
                                None,
                                lambda: kotaemon_client.predict(
                                    files=[handle_file(temp_image_path)],
                                    urls="",
                                    reindex=True,
                                    api_name="/index_fn"
                                )
                            )
                            
                            # Retrieve UUID from DB
                            image_filename = os.path.basename(temp_image_path)
                            
                            if os.path.exists(KOTAEMON_DB_PATH):
                                conn_img = sqlite3.connect(KOTAEMON_DB_PATH)
                                cursor_img = conn_img.cursor()
                                
                                # Dynamic Search in ALL indices
                                print(f"🔍 Searching for '{image_filename}' in ALL indices...")
                                
                                # Get all index tables
                                cursor_img.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'index__%__source'")
                                tables = cursor_img.fetchall()
                                
                                found_uuid = None
                                found_table = None
                                
                                for (table_name,) in tables:
                                    # Search in this table
                                    cursor_img.execute(f"SELECT id FROM {table_name} WHERE name = ?", (image_filename,))
                                    result_img = cursor_img.fetchone()
                                    
                                    if not result_img:
                                        cursor_img.execute(f"SELECT id FROM {table_name} WHERE name LIKE ?", (f"%{image_filename}%",))
                                        result_img = cursor_img.fetchone()
                                    
                                    if result_img:
                                        found_uuid = result_img[0]
                                        found_table = table_name
                                        print(f"✅ FOUND in {table_name}: {found_uuid}")
                                        docs_with_uuids.append(found_uuid)
                                        
                                        if "index__1" in found_table:
                                            file_index_uuids.append(found_uuid)
                                        else:
                                            lightrag_uuids.append(found_uuid)
                                        # found it!
                                        break
                                
                                if found_uuid:
                                    # SUCCESS: Image indexed and found.
                                    # NOW SAVE OWNERSHIP TO MONGODB
                                    try:
                                        from datetime import datetime
                                        now = datetime.utcnow()
                                        
                                        # Create relative path consistent with uploads
                                        # Note: This file is in a temp dir, not the user's upload dir.
                                        # Ideally we should move it to user's dir, but for now we just track it.
                                        # Documents list filters by 'title' (filename) OR 'path'.
                                        # Let's verify what documents.py stores: "userId/filename".
                                        
                                        # We will store it with just the filename as title, so the filter matches.
                                        doc_record = {
                                            "userId": user_id,
                                            "title": image_filename,
                                            "path": f"chat_images/{image_filename}", # Virtual path
                                            "size": os.path.getsize(temp_image_path),
                                            "type": "png" if ".png" in image_filename else "jpg",
                                            "uploadDate": now,
                                            "createdAt": now,
                                            "updatedAt": now,
                                            "source": "chat_upload"
                                        }
                                        await db.documents.insert_one(doc_record)
                                        print(f"✅ Saved image ownership for {image_filename} to MongoDB for user {user_id}")
                                        
                                    except Exception as db_err:
                                        print(f"⚠️ Failed to save image ownership to MongoDB: {db_err}")

                                if not found_uuid:
                                    print(f"❌ Could not find UUID for {image_filename} in ANY of {len(tables)} indices: {[t[0] for t in tables]}")
                                    # DEBUG: Show what IS in the database to help troubleshooting
                                    if tables:
                                        first_table = tables[0][0]
                                        cursor_img.execute(f"SELECT name FROM {first_table} ORDER BY id DESC LIMIT 5")
                                        recent_files = cursor_img.fetchall()
                                        print(f"📋 Recent files in {first_table}: {recent_files}")
                                    
                                conn_img.close()
                            else:
                                print(f"⚠️ DB Path not found: {KOTAEMON_DB_PATH}")

                        except Exception as upload_err:
                            print(f"⚠️ Image indexing failed: {upload_err}")
                            # Fallback: send as file attachment as before
                            files_to_send.append(temp_image_path)

                    else:
                        print(f"⚠️ Failed to download image: {response.status_code}")
            except Exception as e:
                print(f"⚠️ Image download error: {e}")

        chat_input = {'text': request.chatInput, 'files': files_to_send}
        print(f"📤 Submitting to Kotaemon with UUIDs: {docs_with_uuids}, files: {files_to_send}, mode: {file_selection_mode}")
        submit_result = kotaemon_client.predict(
            chat_input=chat_input,
            chat_history=history,
            conv_name=None,
            first_selector_choices=docs_with_uuids,
            api_name="/submit_msg"
        )
        print(f"📥 Submit result length: {len(submit_result) if submit_result else 0}")

        # submit_result is a tuple: (cleared_input, updated_history, ...)
        # updated_history is at index 1
        updated_history = submit_result[1] if len(submit_result) > 1 else [[request.chatInput, None]]

        # Step 4: Get response using /chat_fn with file selection parameters
        # Determine params based on where items are found
        # If docs_with_uuids is empty, use 'full' (all context)
        # If docs_with_uuids is NOT empty, restrict to selected items (even if empty in one index)
        # Use 'select' with specific UUIDs for each index
        
        param_11_mode = 'select' if docs_with_uuids else 'full' # File Index mode
        param_17_mode = 'select' if docs_with_uuids else 'full' # LightRAG mode
        
        # Override to 'select' if we have specific items for that index, OR if we have items for the OTHER index (to exclude noise)
        # Actually, simpler: if docs_with_uuids has ANY content, we are in "Selection Mode".
        # In Selection Mode, we pass the specific lists. If a list is empty, it means "don't select anything from this index".
        
        print(f"\n{'='*60}")
        print(f"🔍 KOTAEMON QUERY PARAMETERS (Dynamic Split)")
        print(f"{'='*60}")
        print(f"Total Selected UUIDs: {docs_with_uuids}")
        print(f"File Index UUIDs (Index 1): {file_index_uuids}")
        print(f"LightRAG UUIDs (Index 3): {lightrag_uuids}")
        print(f"File Index (param_11): '{param_11_mode}', (param_12): {file_index_uuids}")
        print(f"LightRAG (param_17): '{param_17_mode}', (param_18): {lightrag_uuids}")
        print(f"{'='*60}\n")
        
        # Run blocking prediction in a thread to avoid blocking the async event loop
        loop = asyncio.get_running_loop()
        
        print(f"⏳ Sending request to Kotaemon (in thread pool)...")
        chat_result = await loop.run_in_executor(
            None,
            lambda: kotaemon_client.predict(
                chat_history=updated_history,
                llm_type=llm_type,
                use_citation="highlight",
                language="id",  # Indonesian for better response
                param_11=param_11_mode,        # File Index Mode
                param_12=file_index_uuids,     # File Index UUIDs
                param_14='full',               # GraphRAG
                param_15=[],                   # GraphRAG
                param_17=param_17_mode,        # LightRAG Mode
                param_18=lightrag_uuids,       # LightRAG UUIDs
                api_name="/chat_fn"
            )
        )
        print(f"📥 Chat result type: {type(chat_result)}, length: {len(chat_result) if hasattr(chat_result, '__len__') else 'N/A'}")

        # Parse the result
        # chat_result is typically: (chat_history, evidence_html, ...)
        output = ""
        sources = None

        if isinstance(chat_result, tuple) and len(chat_result) > 0:
            # First element is the updated chat history
            result_history = chat_result[0]
            if isinstance(result_history, list) and len(result_history) > 0:
                # Get the last response
                last_exchange = result_history[-1]
                if isinstance(last_exchange, list) and len(last_exchange) > 1:
                    output = last_exchange[1] or ""

            # Second element is evidence/sources HTML
            if len(chat_result) > 1 and chat_result[1]:
                sources_html = chat_result[1]
                if isinstance(sources_html, str) and "No evidence" not in sources_html:
                    sources = [{"evidence": sources_html}]
        elif isinstance(chat_result, str):
            output = chat_result
        else:
            output = str(chat_result)

        # DO NOT strip markdown code fences - they are needed for proper rendering
        # Only strip if the entire response is wrapped in ```json ... ``` (for quiz format)
        if isinstance(output, str):
            stripped = output.strip()
            if stripped.startswith("```json") and stripped.endswith("```"):
                # This is a JSON response wrapped in code fence, strip it
                output = stripped[7:].strip()  # Remove ```json
                if output.endswith("```"):
                    output = output[:-3].strip()  # Remove trailing ```

        return ChatResponse(
            output=output,
            sources=sources if isinstance(sources, list) else None,
            sessionId=request.sessionId
        )

    except HTTPException:
        raise
    except Exception as e:
        error_str = str(e).lower()
        print(f"❌ Chat error: {e}")

        # Check for quota/rate limit errors
        quota_keywords = ["quota", "rate limit", "exceeded", "429", "resource exhausted"]
        if any(keyword in error_str for keyword in quota_keywords):
            return ChatResponse(
                output=(
                    "⚠️ **Quota API Exceeded!**\n\n"
                    "Batas penggunaan API Gemini telah tercapai. Silakan:\n"
                    "1. Tunggu beberapa menit dan coba lagi\n"
                    "2. Atau hubungi administrator untuk upgrade quota\n\n"
                    "💡 *Tip: Kotaemon menggunakan Gemini API yang memiliki batas penggunaan harian.*"
                ),
                sources=None,
                sessionId=request.sessionId
            )

        # Check for Gradio upstream errors (usually quota-related)
        if "upstream gradio app has raised an exception" in error_str:
            return ChatResponse(
                output=(
                    "⚠️ **Kotaemon Error**\n\n"
                    "Terjadi kesalahan pada server Kotaemon. Kemungkinan penyebab:\n"
                    "1. **Quota API Gemini habis** - tunggu beberapa menit\n"
                    "2. Model LLM tidak tersedia - cek konfigurasi Kotaemon\n"
                    "3. Server Kotaemon overload - restart jika perlu\n\n"
                    "💡 *Coba lagi dalam beberapa saat.*"
                ),
                sources=None,
                sessionId=request.sessionId
            )

        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@app.get("/api/upload")
async def get_imagekit_auth(token: Optional[str] = None, expire: Optional[str] = None):
    """
    Get authentication parameters for ImageKit client-side upload.
    """
    private_key = os.getenv("VITE_IMAGE_KIT_PRIVATE_KEY") or os.getenv("IMAGE_KIT_PRIVATE_KEY")
    public_key = os.getenv("VITE_IMAGE_KIT_PUBLIC_KEY") or os.getenv("IMAGE_KIT_PUBLIC_KEY")
    url_endpoint = os.getenv("VITE_IMAGE_KIT_ENDPOINT") or os.getenv("IMAGE_KIT_ENDPOINT")

    if not private_key or not public_key or not url_endpoint:
        raise HTTPException(
            status_code=500, 
            detail="ImageKit configuration missing (PRIVATE_KEY, PUBLIC_KEY, or ENDPOINT)"
        )

    token = token or str(uuid.uuid4())
    expire = expire or str(int(time.time() + 1800)) # 30 mins
    
    # Signature generation
    # HMAC-SHA1 of token + expire using private key
    signature_string = f"{token}{expire}"
    signature = hmac.new(
        private_key.encode(),
        signature_string.encode(),
        hashlib.sha1
    ).hexdigest()

    return {
        "token": token,
        "expire": expire,
        "signature": signature
    }


@app.post("/api/kotaemon/upload")
async def upload_document(request: UploadRequest, user_id: str = Depends(require_auth)):
    """
    Upload a document to Kotaemon for indexing.

    The file should already be saved to disk by the Express backend.
    This endpoint tells Kotaemon to index the file.
    """
    if kotaemon_client is None:
        if not connect_to_kotaemon():
            raise HTTPException(status_code=503, detail="Not connected to Kotaemon")

    try:
        file_path = request.filePath
        print(f"📁 Received file path: {file_path}")

        # If relative path, make it absolute using UPLOAD_DIR
        if not os.path.isabs(file_path):
            if UPLOAD_DIR:
                # Keep the full relative path (including user subdirectory)
                file_path = os.path.join(UPLOAD_DIR, file_path)
            else:
                # Try to find in common locations
                for base in ["./uploads", "../uploads", "../../uploads"]:
                    test_path = os.path.join(base, file_path)
                    if os.path.exists(test_path):
                        file_path = os.path.abspath(test_path)
                        break

        print(f"📁 Resolved file path: {file_path}")

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

        # Use the correct Kotaemon endpoint for file indexing
        # The /index_fn_2 endpoint is used for uploading files to Kotaemon
        print(f"📤 Uploading file to Kotaemon: {file_path}")
        
        loop = asyncio.get_running_loop()

        try:
            # Normalize path for Kotaemon (use forward slashes)
            normalized_path = file_path.replace("\\", "/")

            # Use /index_fn_2 which is the correct endpoint for file indexing
            # Run in thread pool to avoid blocking
            result = await loop.run_in_executor(
                None,
                lambda: kotaemon_client.predict(
                    files=[handle_file(normalized_path)],  # List of FileData
                    urls="",  # No URLs
                    reindex=False,  # Don't reindex existing
                    api_name="/index_fn_2"
                )
            )
            print(f"✅ Kotaemon indexing result: {result}")

            # Try to fetch UUID from Kotaemon and store in MongoDB
            filename = os.path.basename(file_path)
            try:
                kotaemon_uuid = await fetch_kotaemon_file_uuid(filename)
                if kotaemon_uuid:
                    await store_kotaemon_uuid_in_mongodb(user_id, filename, kotaemon_uuid)
                    print(f"✅ Stored Kotaemon UUID in MongoDB: {kotaemon_uuid}")
                else:
                    print(f"⚠️ Could not get UUID from Kotaemon API for {filename}")
            except Exception as uuid_error:
                print(f"⚠️ UUID storage warning: {uuid_error}")

            return {
                "status": "success",
                "message": "Document uploaded and indexed successfully",
                "filePath": file_path,
                "result": str(result)
            }
        except Exception as index_error:
            print(f"⚠️ Primary indexing failed: {index_error}")

            # Fallback: try alternative endpoints
            possible_endpoints = ["/upload", "/index", "/add_file"]
            for endpoint in possible_endpoints:
                if api_info and endpoint in api_info.get("named_endpoints", {}):
                    try:
                        # Run fallback in thread pool too
                        result = await loop.run_in_executor(
                            None,
                            lambda: kotaemon_client.predict(
                                handle_file(file_path),
                                api_name=endpoint
                            )
                        )
                        print(f"✅ Fallback endpoint {endpoint} succeeded")
                        return {
                            "status": "success",
                            "message": f"Document indexed via {endpoint}",
                            "filePath": file_path,
                            "result": str(result)
                        }
                    except Exception as e:
                        print(f"⚠️ Fallback endpoint {endpoint} failed: {e}")
                        continue

            # If all endpoints fail, return pending status
            return {
                "status": "pending",
                "message": "File saved. Indexing may require manual action in Kotaemon UI.",
                "filePath": file_path,
                "error": str(index_error)
            }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")


@app.post("/api/kotaemon/delete")
async def delete_document(request: DeleteRequest):
    """
    Delete a document from Kotaemon's database and storage.
    
    This function:
    1. Deletes from Kotaemon SQLite database (all indices)
    2. Deletes physical file from storage
    3. Returns success status
    """
    try:
        file_name = request.filePath
        print(f"🗑️ Delete request for: {file_name}")
        
        # Step 1: Delete from Kotaemon database
        deleted_count = 0
        deleted_from = []
        
        if os.path.exists(KOTAEMON_DB_PATH):
            conn = sqlite3.connect(KOTAEMON_DB_PATH)
            cursor = conn.cursor()
            
            # Get all index source tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'index__%__source'")
            source_tables = cursor.fetchall()
            
            for (table_name,) in source_tables:
                try:
                    # Delete by filename (with or without timestamp)
                    cursor.execute(f"DELETE FROM {table_name} WHERE name = ? OR name LIKE ?", 
                                 (file_name, f"%{file_name}"))
                    if cursor.rowcount > 0:
                        deleted_count += cursor.rowcount
                        deleted_from.append(table_name)
                        print(f"✅ Deleted {cursor.rowcount} entries from {table_name}")
                except Exception as table_error:
                    print(f"⚠️ Error deleting from {table_name}: {table_error}")
            
            conn.commit()
            conn.close()
            print(f"📊 Total deleted: {deleted_count} entries from {len(deleted_from)} tables")
        else:
            print(f"⚠️ Kotaemon database not found at: {KOTAEMON_DB_PATH}")
        
        # Step 2: Delete physical file from storage (optional)
        file_deleted = False
        if UPLOAD_DIR:
            # Try to find and delete the physical file
            possible_paths = [
                os.path.join(UPLOAD_DIR, file_name),
                os.path.join(UPLOAD_DIR, os.path.basename(file_name))
            ]
            
            for path in possible_paths:
                if os.path.exists(path):
                    try:
                        os.remove(path)
                        file_deleted = True
                        print(f"🗑️ Deleted physical file: {path}")
                        break
                    except Exception as file_error:
                        print(f"⚠️ Could not delete file {path}: {file_error}")
        
        # Return result
        if deleted_count > 0:
            return {
                "status": "success",
                "message": f"Document deleted from {len(deleted_from)} indices",
                "filePath": file_name,
                "deletedCount": deleted_count,
                "deletedFrom": deleted_from,
                "fileDeleted": file_deleted
            }
        else:
            return {
                "status": "not_found",
                "message": "Document not found in Kotaemon database",
                "filePath": file_name,
                "fileDeleted": file_deleted
            }

    except Exception as e:
        print(f"❌ Delete error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Delete error: {str(e)}")


@app.post("/api/kotaemon/discover")
async def discover_api():
    """
    Discover and test Kotaemon API endpoints.
    Useful for debugging and understanding what's available.
    """
    if kotaemon_client is None:
        if not connect_to_kotaemon():
            raise HTTPException(status_code=503, detail="Not connected to Kotaemon")

    try:
        # Get full API info
        full_api = kotaemon_client.view_api(return_format="dict", all_endpoints=True)

        return {
            "named_endpoints": full_api.get("named_endpoints", {}),
            "unnamed_endpoints": full_api.get("unnamed_endpoints", {}),
            "kotaemon_url": KOTAEMON_URL
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Discovery error: {str(e)}")


# ========================
# Agent-Specific Endpoints
# ========================

class AgentChatRequest(BaseModel):
    """Request for agent-based chat."""
    message: str = Field(..., description="User message")
    sessionId: str = Field(..., description="Session identifier")
    agentStyle: str = Field("generate-question", description="Agent style")
    model: Optional[str] = Field("gemini-2.5-flash", description="LLM model to use")
    document: Optional[str] = Field(None, description="Document for RAG context")
    selectedDocuments: Optional[List[str]] = Field(default_factory=list, description="List of documents for RAG")
    questionType: Optional[str] = Field("multiple_choice", description="Type of questions to generate")
    numQuestions: Optional[int] = Field(5, description="Number of questions")
    difficulty: Optional[str] = Field("medium", description="Question difficulty")
    language: Optional[str] = Field("id", description="Language (id/en)")
    history: Optional[List[List[str]]] = Field(default_factory=list, description="Chat history")


class TestAnswerRequest(BaseModel):
    """Request to test an answer."""
    sessionId: str
    questionNumber: int
    answer: str


class EditQuestionAPIRequest(BaseModel):
    """Request to edit a question."""
    sessionId: str
    questionId: str
    field: str
    newValue: str


class ExportRequest(BaseModel):
    """Request to export questions."""
    sessionId: str
    format: str = "json"
    includeAnswers: bool = True


@app.post("/api/agent/chat")
async def agent_chat(request: AgentChatRequest):
    """
    Send a message to an AI agent.

    This endpoint handles specialized agent behaviors:
    - generate-question: Creates educational questions from RAG
    - chat-forum: General discussion mode
    """
    global question_agent

    try:
        agent_style = (request.agentStyle or "generate-question").lower().replace("_", "-")

        # Initialize agent if needed (using LangChain)
        if question_agent is None:
            question_agent = get_agent(model=request.model or "gemini-2.5-flash")

        # Collect documents for RAG (support both single and multi-select)
        docs_to_query = []
        if request.selectedDocuments and len(request.selectedDocuments) > 0:
            docs_to_query = request.selectedDocuments
        elif request.document and request.document != "none":
            docs_to_query = [request.document]

        print(f"📚 Agent chat - Documents for RAG: {docs_to_query}")

        # Convert filenames to UUIDs (same as main chat endpoint)
        docs_with_uuids = []
        if docs_to_query:
            try:
                conn = sqlite3.connect(KOTAEMON_DB_PATH)
                cursor = conn.cursor()
                
                for doc in docs_to_query:
                    # Check if it's already a UUID
                    if re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', doc, re.I):
                        docs_with_uuids.append(doc)
                    else:
                        # Try multiple patterns to find UUID
                        cursor.execute("SELECT id FROM index__3__source WHERE name = ?", (doc,))
                        result = cursor.fetchone()
                        
                        if not result:
                            cursor.execute("SELECT id FROM index__3__source WHERE name LIKE ?", (f"%{doc}%",))
                            result = cursor.fetchone()
                        
                        if not result:
                            clean_doc = re.sub(r'^\d{8}_\d{6}_', '', doc)
                            cursor.execute("SELECT id FROM index__3__source WHERE name LIKE ?", (f"%{clean_doc}%",))
                            result = cursor.fetchone()
                        
                        if result:
                            docs_with_uuids.append(result[0])
                            print(f"🔄 Agent: Converted '{doc}' to UUID '{result[0]}'")
                        else:
                            docs_with_uuids.append(doc)
                            print(f"⚠️ Agent: Could not find UUID for '{doc}'")
                
                conn.close()
            except Exception as e:
                print(f"⚠️ Agent UUID conversion error: {e}")
                docs_with_uuids = docs_to_query

        # Get RAG context if documents are selected
        rag_context = None
        if docs_with_uuids and kotaemon_client:
            try:
                # Login before each request (Kotaemon Gradio is stateless)
                try:
                    kotaemon_client.predict(KOTAEMON_USERNAME, KOTAEMON_PASSWORD, api_name="/login_1")
                except:
                    pass  # Ignore login errors

                # Load files for LightRAG (index 3) - use UUIDs
                try:
                    kotaemon_client.predict(selected_files=docs_with_uuids, api_name="/load_files_2")
                    print(f"📂 Agent: Loaded files for LightRAG (UUIDs): {docs_with_uuids}")
                except:
                    pass  # Ignore load errors

                file_selection_mode = 'select'
                print(f"🔍 Agent getting RAG context with UUIDs: {docs_with_uuids}")

                # Query Kotaemon for context with document selection - use UUIDs
                submit_result = kotaemon_client.predict(
                    chat_input={'text': request.message, 'files': []},
                    chat_history=[],
                    conv_name=None,
                    first_selector_choices=docs_with_uuids,
                    api_name="/submit_msg"
                )
                updated_history = submit_result[1] if len(submit_result) > 1 else [[request.message, None]]

                # Get RAG response - SKIP File Index & GraphRAG, only use LightRAG
                print(f"🔍 Agent: Querying with LightRAG only (File Index & GraphRAG skipped)")
                chat_result = kotaemon_client.predict(
                    chat_history=updated_history,
                    llm_type="google",
                    use_citation="highlight",
                    language="id",
                    param_11='full',               # File Index - SKIP
                    param_12=[],                   # File Index - empty
                    param_14='full',               # GraphRAG - SKIP
                    param_15=[],                   # GraphRAG - empty
                    param_17=file_selection_mode,  # LightRAG - use SELECT
                    param_18=docs_with_uuids,      # LightRAG - use UUIDs
                    api_name="/chat_fn"
                )

                if isinstance(chat_result, tuple) and len(chat_result) > 0:
                    result_history = chat_result[0]
                    if isinstance(result_history, list) and len(result_history) > 0:
                        last_exchange = result_history[-1]
                        if isinstance(last_exchange, list) and len(last_exchange) > 1:
                            rag_context = last_exchange[1]
                            print(f"✅ Got RAG context: {rag_context[:200] if rag_context else 'None'}...")
            except Exception as e:
                print(f"⚠️ Failed to get RAG context: {e}")
                import traceback
                traceback.print_exc()

        # Determine question type
        q_type = None
        if request.questionType:
            try:
                q_type = QuestionType(request.questionType.lower().replace("-", "_"))
            except ValueError:
                q_type = QuestionType.MULTIPLE_CHOICE

        # Create agent request with documents list
        agent_request = AgentRequest(
            agent_style=AgentStyle.GENERATE_QUESTION if "question" in agent_style else AgentStyle.CHAT_FORUM,
            message=request.message,
            session_id=request.sessionId,
            context=rag_context,
            document=docs_to_query[0] if docs_to_query else None,
            documents=docs_to_query,  # Pass full list
            history=request.history or [],
            question_type=q_type,
            num_questions=request.numQuestions or 5,
            difficulty=request.difficulty or "medium",
            language=request.language or "id"
        )

        # Process with agent
        agent_response = await question_agent.process_request(
            agent_request,
            kotaemon_client
        )

        return {
            "output": agent_response.output,
            "sessionId": request.sessionId,
            "agentStyle": agent_response.agent_style.value,
            "questions": agent_response.questions.model_dump() if agent_response.questions else None,
            "exportJson": agent_response.export_json,
            "exportMarkdown": agent_response.export_markdown,
            "editable": agent_response.editable
        }

    except Exception as e:
        print(f"❌ Agent chat error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")


@app.post("/api/agent/test-answer")
async def test_answer(request: TestAnswerRequest):
    """
    Test a user's answer to a generated question.
    """
    try:
        question_set = question_skills.get_session_questions(request.sessionId)

        if not question_set:
            raise HTTPException(status_code=404, detail="No questions found for this session")

        if request.questionNumber < 1 or request.questionNumber > len(question_set.questions):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid question number. Must be between 1 and {len(question_set.questions)}"
            )

        question = question_set.questions[request.questionNumber - 1]
        result = question_skills.test_question(question, request.answer)

        return {
            "isCorrect": result["is_correct"],
            "feedback": result["feedback"],
            "explanation": result.get("explanation"),
            "pointsEarned": result["points_earned"],
            "maxPoints": result["max_points"]
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Test answer error: {e}")
        raise HTTPException(status_code=500, detail=f"Error testing answer: {str(e)}")


@app.post("/api/agent/edit-question")
async def edit_question(request: EditQuestionAPIRequest):
    """
    Edit a generated question.
    """
    try:
        question_set = question_skills.get_session_questions(request.sessionId)

        if not question_set:
            raise HTTPException(status_code=404, detail="No questions found for this session")

        updated = question_skills.edit_question(
            question_set,
            request.questionId,
            {request.field: request.newValue}
        )

        if not updated:
            raise HTTPException(status_code=404, detail=f"Question {request.questionId} not found")

        # Store updated questions
        question_skills.store_questions(request.sessionId, question_set)

        return {
            "success": True,
            "message": f"Question {request.questionId} updated successfully",
            "question": updated.model_dump()
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Edit question error: {e}")
        raise HTTPException(status_code=500, detail=f"Error editing question: {str(e)}")


@app.post("/api/agent/export")
async def export_questions(request: ExportRequest):
    """
    Export generated questions to specified format.
    """
    try:
        question_set = question_skills.get_session_questions(request.sessionId)

        if not question_set:
            raise HTTPException(status_code=404, detail="No questions found for this session")

        try:
            export_format = ExportFormat(request.format.lower())
        except ValueError:
            export_format = ExportFormat.JSON

        content = question_skills.export_questions(
            question_set,
            export_format,
            include_answers=request.includeAnswers,
            include_explanations=request.includeAnswers
        )

        # Return with appropriate content type
        content_types = {
            ExportFormat.JSON: "application/json",
            ExportFormat.MARKDOWN: "text/markdown",
            ExportFormat.MOODLE_XML: "application/xml",
            ExportFormat.AIKEN: "text/plain"
        }

        return {
            "format": export_format.value,
            "content": content,
            "contentType": content_types.get(export_format, "text/plain"),
            "filename": f"questions_{request.sessionId}.{export_format.value}"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Export error: {e}")
        raise HTTPException(status_code=500, detail=f"Error exporting questions: {str(e)}")


@app.get("/api/agent/questions/{session_id}")
async def get_questions(session_id: str, show_answers: bool = False):
    """
    Get the current questions for a session.
    """
    try:
        question_set = question_skills.get_session_questions(session_id)

        if not question_set:
            return {"questions": None, "message": "No questions found for this session"}

        display = question_skills.format_questions_for_display(
            question_set,
            show_answers=show_answers,
            interactive=True
        )

        return {
            "questions": question_set.model_dump(),
            "display": display,
            "count": len(question_set.questions),
            "totalPoints": question_set.total_points
        }

    except Exception as e:
        print(f"❌ Get questions error: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting questions: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    print(f"""
╔════════════════════════════════════════════════════════════╗
║              Kotaemon Proxy Server                         ║
║                                                            ║
║  Connecting to Kotaemon at: {KOTAEMON_URL:<25} ║
║  Proxy running at: http://{PROXY_HOST}:{PROXY_PORT:<24} ║
║                                                            ║
║  Agent Endpoints:                                          ║
║    POST /api/agent/chat        - Agent chat                ║
║    POST /api/agent/test-answer - Test answers              ║
║    POST /api/agent/edit        - Edit questions            ║
║    POST /api/agent/export      - Export questions          ║
╚════════════════════════════════════════════════════════════╝
    """)

    uvicorn.run(
        "main:app",
        host=PROXY_HOST,
        port=PROXY_PORT,
        reload=True,
        log_level="info"
    )
