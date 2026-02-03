"""
Document API Routes
====================
Migrated from Express.js backend to FastAPI.
Handles file upload, deletion, and document listing.
"""

import os
import shutil
from datetime import datetime
from typing import List, Optional
from pathlib import Path

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
import sqlite3
from pydantic import BaseModel
from dotenv import load_dotenv

from models import db, Document, DocumentCreate
from middleware import require_auth

load_dotenv()

router = APIRouter(prefix="/api", tags=["documents"])

# Configuration
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
ALLOWED_EXTENSIONS = {
    "txt", "pdf", "docx", "rtf", "html", "xml",
    "json", "csv", "md", "epub", "odt", "pptx",
    "tsv", "yaml", "log"
}


# ============== Helper Functions ==============

def get_file_extension(filename: str) -> str:
    """Extract file extension from filename."""
    if '.' in filename:
        return filename.rsplit('.', 1)[1].lower()
    return ""


def is_allowed_file(filename: str) -> bool:
    """Check if file extension is allowed."""
    return get_file_extension(filename) in ALLOWED_EXTENSIONS


def ensure_upload_dir():
    """Ensure upload directory exists."""
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


# ============== Request/Response Models ==============

class DocumentResponse(BaseModel):
    _id: str
    userId: str
    title: str
    path: str
    size: int
    type: str
    uploadDate: Optional[datetime] = None


class UploadResponse(BaseModel):
    message: str
    filePath: str
    fileName: str
    documentId: Optional[str] = None


# ============== Routes ==============

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user_id: str = Depends(require_auth)
) -> UploadResponse:
    """Upload a file and create a document record."""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Validate file extension
        if not is_allowed_file(file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Ensure upload directory exists
        ensure_upload_dir()
        
        # Create user-specific subdirectory
        user_upload_dir = Path(UPLOAD_DIR) / user_id
        user_upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename to avoid conflicts
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{timestamp}_{file.filename}"
        file_path = user_upload_dir / safe_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
            file_size = len(content)
        
        # Create relative path for storage
        relative_path = f"{user_id}/{safe_filename}"
        
        # Create document record in MongoDB
        now = datetime.utcnow()
        doc = {
            "userId": user_id,
            "title": file.filename,
            "path": relative_path,
            "size": file_size,
            "type": get_file_extension(file.filename),
            "uploadDate": now,
            "createdAt": now,
            "updatedAt": now
        }
        
        result = await db.documents.insert_one(doc)
        
        return UploadResponse(
            message="File uploaded and document saved successfully",
            filePath=relative_path,
            fileName=file.filename,
            documentId=str(result.inserted_id)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


@router.get("/documents")
async def get_documents(user_id: str = Depends(require_auth)) -> List[dict]:
    """Get all documents for the current user."""
    try:
        cursor = db.documents.find({"userId": user_id})
        documents = await cursor.to_list(length=100)
        
        # Convert ObjectId to string
        for doc in documents:
            doc["_id"] = str(doc["_id"])
        
        return documents
    
    except Exception as e:
        print(f"Error fetching documents: {e}")
        raise HTTPException(status_code=500, detail="Error fetching documents")


@router.post("/documents")
async def create_document(
    request: DocumentCreate,
    user_id: str = Depends(require_auth)
) -> dict:
    """Create a document record (without file upload)."""
    try:
        now = datetime.utcnow()
        doc = {
            "userId": user_id,
            "title": request.title,
            "size": request.size,
            "type": request.type,
            "path": request.path or "",
            "uploadDate": now,
            "createdAt": now,
            "updatedAt": now
        }
        
        result = await db.documents.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        
        return doc
    
    except Exception as e:
        print(f"Error creating document: {e}")
        raise HTTPException(status_code=500, detail="Error creating document")


@router.delete("/delete/{user_id}/{file_path:path}")
async def delete_document(
    user_id: str,
    file_path: str,
    auth_user_id: str = Depends(require_auth)
):
    """Delete a document and its file."""
    try:
        # Verify user owns the document
        if user_id != auth_user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this document")
        
        # Find and delete document from MongoDB
        result = await db.documents.find_one_and_delete({
            "userId": user_id,
            "path": file_path
        })
        
        if not result:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Delete file from filesystem
        full_path = Path(UPLOAD_DIR) / file_path
        if full_path.exists():
            full_path.unlink()
            
        # Delete from Kotaemon SQLite database
        try:
            # Resolve database path relative to this file
            # backend/routes/documents.py -> backend/routes -> backend -> root -> ktem_app_data
            db_path = os.getenv(
                "KOTAEMON_DB_PATH",
                str(Path(__file__).parent.parent.parent / "ktem_app_data" / "user_data" / "sql.db")
            )
            
            if os.path.exists(db_path):
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                
                # Get filename from path (userId/filename)
                target_filename = Path(file_path).name
                
                # Get all index source tables
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'index__%__source'")
                source_tables = cursor.fetchall()
                
                deleted_count = 0
                for (table_name,) in source_tables:
                    try:
                        # Delete by filename (exact match or partial match for consistency)
                        cursor.execute(f"DELETE FROM {table_name} WHERE name = ? OR name LIKE ?", 
                                     (target_filename, f"%{target_filename}"))
                        deleted_count += cursor.rowcount
                    except Exception as e:
                        print(f"Error deleting from Kotaemon table {table_name}: {e}")
                
                conn.commit()
                conn.close()
                print(f"Deleted {deleted_count} entries from Kotaemon indices for {target_filename}")
            else:
                print(f"Kotaemon DB not found at {db_path}, skipping index cleanup")
                
        except Exception as db_err:
            print(f"Error cleaning up Kotaemon DB: {db_err}")
            # Continue - file is already deleted
        
        return {"message": "Document and file deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting document: {e}")
        raise HTTPException(status_code=500, detail="Error deleting document")


@router.get("/uploads/{file_path:path}")
async def serve_file(file_path: str):
    """Serve uploaded files."""
    try:
        full_path = Path(UPLOAD_DIR) / file_path
        
        if not full_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(full_path)
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error serving file: {e}")
        raise HTTPException(status_code=500, detail="Error serving file")
