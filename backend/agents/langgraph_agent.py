"""
Kotaemon Question Generator Agent
==================================
Agent implementation that uses Kotaemon for both RAG and LLM processing.
No direct Gemini API calls - all processing goes through Kotaemon.

Features:
- Build prompts with skill instructions
- Send to Kotaemon for processing
- Parse JSON responses for question generation
- Session storage for quiz state
- Score tracking for quiz sessions
"""

import os
import json
import uuid
import re
import asyncio
import time
from typing import Optional, List, Dict, Any
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

# Pydantic imports for models
from pydantic import BaseModel, Field

# Local imports
from .models import (
    QuestionType,
    QuestionOption,
    Question,
    QuestionSet,
    AgentStyle,
    AgentRequest,
    AgentResponse,
    GenerateQuestionParams,
    TestQuestionParams,
    ExportParams,
    ExportFormat,
    QuestionOptionOutput,
    QuestionOutput,
    QuestionSetOutput,
    AnswerFeedback,
    AnswerCheckOutput,
    IntentType,
    RouterDecision,
)


# ============================================================================
# Skill Loading
# ============================================================================

def _load_skill_content(skill_name: str = "question-generator") -> str:
    """Load skill content from SKILL.md file."""
    skill_path = Path(__file__).parent / "skills" / skill_name / "SKILL.md"
    if skill_path.exists():
        content = skill_path.read_text(encoding="utf-8")
        # Remove YAML frontmatter
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                return parts[2].strip()
        return content
    return ""


# ============================================================================
# Session Storage
# ============================================================================

# In-memory storage for generated questions per session
_session_questions: Dict[str, List[Dict]] = {}
_session_question_sets: Dict[str, Dict] = {}
_session_quiz_scores: Dict[str, Dict[str, int]] = {}  # {session_id: {"correct": n, "answered": m, "total": t}}
_session_answered: Dict[str, set] = {}  # Track which questions have been answered


def get_session_questions(session_id: str) -> List[Dict]:
    """Get questions for a session."""
    return _session_questions.get(session_id, [])


def save_session_questions(session_id: str, questions: List[Dict]):
    """Save questions for a session."""
    _session_questions[session_id] = questions
    # Reset score when new questions are generated
    _session_quiz_scores[session_id] = {"correct": 0, "answered": 0, "total": len(questions)}
    _session_answered[session_id] = set()


def get_session_question_set(session_id: str) -> Optional[Dict]:
    """Get question set for a session."""
    return _session_question_sets.get(session_id)


def save_session_question_set(session_id: str, question_set: Dict):
    """Save question set for a session."""
    _session_question_sets[session_id] = question_set


def get_session_score(session_id: str) -> Dict:
    """Get quiz score for a session."""
    return _session_quiz_scores.get(session_id, {"correct": 0, "answered": 0, "total": 0})


def update_session_score(session_id: str, question_num: int, is_correct: bool):
    """Update quiz score for a session."""
    if session_id not in _session_quiz_scores:
        _session_quiz_scores[session_id] = {"correct": 0, "answered": 0, "total": 0}

    # Check if already answered
    if session_id not in _session_answered:
        _session_answered[session_id] = set()

    if question_num not in _session_answered[session_id]:
        _session_answered[session_id].add(question_num)
        _session_quiz_scores[session_id]["answered"] += 1
        if is_correct:
            _session_quiz_scores[session_id]["correct"] += 1


def is_question_answered(session_id: str, question_num: int) -> bool:
    """Check if a question has been answered."""
    return question_num in _session_answered.get(session_id, set())


# ============================================================================
# Kotaemon Question Agent
# ============================================================================

class LangGraphQuestionAgent:
    """
    Question generation agent that uses Kotaemon for LLM processing.

    Architecture:
    1. Build prompt with skill instructions + user request
    2. Send to Kotaemon via API
    3. Parse JSON response
    4. Return structured data

    Note: Named LangGraphQuestionAgent for backward compatibility,
    but no longer uses LangGraph or direct LLM calls.
    """

    def __init__(self, model: str = "gemini-2.5-flash"):
        """
        Initialize the agent.

        Args:
            model: Model name (passed to Kotaemon, which handles LLM selection)
        """
        self.model_name = model
        self.skill_content = _load_skill_content("question-generator")
        print(f"[OK] Kotaemon Question Agent initialized (model: {model})")

    def _get_llm_type(self, model: str) -> str:
        """Map model name to Kotaemon llm_type."""
        model_lower = model.lower()

        if "gemini" in model_lower or "google" in model_lower or "bison" in model_lower or "learnlm" in model_lower:
            return "google"
        elif "gpt" in model_lower or "openai" in model_lower or "o1" in model_lower:
            return "openai"
        elif "claude" in model_lower or "anthropic" in model_lower:
            return "claude"
        elif "llama" in model_lower or "ollama" in model_lower or "mistral" in model_lower:
            return "ollama"
        elif "cohere" in model_lower or "command" in model_lower:
            return "cohere"
        elif "groq" in model_lower:
            return "groq"
        else:
            return "google"  # Default

    def _build_question_prompt(self, message: str, rag_context: Optional[str] = None) -> str:
        """
        Build a comprehensive prompt for question generation using strict Pydantic Schema.
        """
        # 1. Extract metadata from user message (from old logic)
        message_lower = message.lower()
        
        # Language detection
        language = 'Indonesia'
        if any(k in message_lower for k in ['english', 'inggris']):
            language = 'English'
            
        # Difficulty detection
        difficulty = "medium"
        if 'hots' in message_lower or 'sulit' in message_lower:
            difficulty = "hard (HOTS)"
        elif 'lots' in message_lower or 'mudah' in message_lower:
            difficulty = "easy (LOTS)"
            
        # 2. Get Pydantic schema
        schema = QuestionSet.model_json_schema()
        
        # 3. Construct the prompt
        prompt = f"""You are a professional educational content generator.
        
USER REQUEST: {message}

TASK:
Generate a set of high-quality questions based on the user's request.
You MUST output the result as a STRICT Valid JSON object matching the following schema.

JSON SCHEMA:
{json.dumps(schema, indent=2)}

GENERAL REQUIREMENTS:
1. Output MUST be valid JSON. No conversational filler.
2. Language: {language}. Output all questions, options, and explanations in this language.
3. Difficulty: Aim for {difficulty} level.
4. "id": Use sequential IDs like "q1", "q2".

TYPE-SPECIFIC REQUIREMENTS:
- **true_false**: 
  - The "question" field should be a clear statement.
  - "correct_answer": Use strings "true" or "false" ONLY.
- **matching**:
  - Use the "matching_pairs" field OR fill "items" and "matches" lists directly.
  - Provide a list of pairs where each pair has "left" (the specific term) and "right" (the matching definition/result).
  - Aim for 3-5 pairs per matching question.
  - CRITICAL: Do NOT use placeholders like "item1", "item2", "match1". Use actual technical terms from the document.
  - The "correct_answer" for matching MUST be a mapping of item ID to match ID, e.g., {{"1": "A", "2": "C"}}.
- **multiple_choice**:
  - Provide 4 options (A, B, C, D).
  - "correct_answer": Use the letter (e.g. "A").

CONTEXT SEARCH:
Use the provided context information to ensure questions are accurate and relevant.
"""
        
        if rag_context:
            prompt += f"\n\nCONTEXT INFORMATION:\n{rag_context}\n\n"
            
        return prompt

    def _is_answer_check(self, message: str) -> tuple:
        """
        Check if the message is an answer submission.

        Returns:
            Tuple of (is_answer, question_num, answer) or (False, 0, "")
        """
        message_lower = message.strip().lower()

        # Pattern: "jawab 1 B" or "jawab 2 A,C,D"
        # Prioritize keywords over option letters
        match = re.match(r'jawab\s*(\d+)\s+(benar|salah|true|false|[a-e,\s]+)', message_lower, re.IGNORECASE)
        if match:
            val = match.group(2).strip()
            # If it's a single letter, uppercase it, otherwise keep as is (normalize later)
            if len(val) == 1 and val.isalpha():
                val = val.upper()
            return (True, int(match.group(1)), val)

        # Pattern: "1. A" or "1: B"
        match = re.match(r'(\d+)\s*[.:]\s*(benar|salah|true|false|[a-e,\s]+)', message_lower, re.IGNORECASE)
        if match:
            val = match.group(2).strip()
            if len(val) == 1 and val.isalpha():
                val = val.upper()
            return (True, int(match.group(1)), val)

        return (False, 0, "")

    async def _send_to_kotaemon(
        self,
        prompt: str,
        kotaemon_client: Any,
        history: Optional[List] = None,
        documents: Optional[List[str]] = None,
        image_url: Optional[str] = None
    ) -> str:
        """
        Send prompt to Kotaemon and get response.
        """
        if kotaemon_client is None:
            raise ValueError("Kotaemon client not available")

        docs_for_rag = documents or []
        print(f"🔍 Agent sending to Kotaemon with documents: {docs_for_rag}, image: {image_url}")

        loop = asyncio.get_running_loop()

        # Handle Image Download & Indexing if present
        if image_url:
            try:
                import requests
                import tempfile
                
                # Create a temp file
                suffix = ".png" if ".png" in image_url.lower() else ".jpg"
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
                    print(f"⬇️ Downloading image from {image_url}...")
                    # Run requests.get in executor to avoid blocking
                    response = await loop.run_in_executor(None, requests.get, image_url)
                    if response.status_code == 200:
                        tmp_file.write(response.content)
                        temp_image_path = tmp_file.name
                        print(f"📸 Image saved to {temp_image_path}")

                        # Upload to Kotaemon logic (similar to document upload)
                        # We must upload it so it gets indexed in LightRAG (Index 3)
                        try:
                            # Use /index_fn_2 to upload and index
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
                            
                            # Now retrieve the UUID from the database
                            # We search by the filename (basename)
                            image_filename = os.path.basename(temp_image_path)
                            
                            # Get database path from environment or use default
                            db_path = os.getenv("KOTAEMON_DB_PATH",
                                os.path.join(os.path.dirname(__file__), "..", "..", "ktem_app_data", "user_data", "sql.db"))
                            
                            conn_img = sqlite3.connect(db_path)
                            cursor_img = conn_img.cursor()
                            
                            # Dynamic Search in ALL indices
                            print(f"🔍 Searching for '{image_filename}' in ALL indices...")
                            
                            # Get all index tables
                            cursor_img.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'index__%__source'")
                            tables = cursor_img.fetchall()
                            
                            found_uuid = None
                            
                            for (table_name,) in tables:
                                # Search in this table
                                cursor_img.execute(f"SELECT id FROM {table_name} WHERE name = ?", (image_filename,))
                                result_img = cursor_img.fetchone()
                                
                                if not result_img:
                                    cursor_img.execute(f"SELECT id FROM {table_name} WHERE name LIKE ?", (f"%{image_filename}%",))
                                    result_img = cursor_img.fetchone()
                                
                                if result_img:
                                    found_uuid = result_img[0]
                                    
                                    # Track UUIDs
                                    docs_with_uuids.append(found_uuid)
                                    if "index__1" in table_name:
                                        file_index_uuids.append(found_uuid)
                                    else:
                                        lightrag_uuids.append(found_uuid)
                                        
                                    print(f"✅ FOUND in {table_name}: {found_uuid}")
                                    docs_for_rag.append(found_uuid)
                                    # found it!
                                    break
                            
                            if not found_uuid:
                                print(f"❌ Could not find UUID for {image_filename} in ANY of {len(tables)} indices: {[t[0] for t in tables]}")
                                # DEBUG: Show what IS in the database to help troubleshooting
                                if tables:
                                    first_table = tables[0][0]
                                    cursor_img.execute(f"SELECT name FROM {first_table} ORDER BY id DESC LIMIT 5")
                                    recent_files = cursor_img.fetchall()
                                    print(f"📋 Recent files in {first_table}: {recent_files}")
                                
                            conn_img.close()
                                
                        except Exception as upload_err:
                            print(f"⚠️ Image indexing failed: {upload_err}")

                    else:
                        print(f"⚠️ Failed to download image: {response.status_code}")
            except Exception as e:
                print(f"⚠️ Image processing error: {e}")

        # Convert filenames to UUIDs and categorize by Index Source
        file_index_uuids = []
        lightrag_uuids = []
        docs_with_uuids = [] # Keep track of all valid UUIDs
        
        if docs_for_rag:
            try:
                import sqlite3
                import re
                import os
                
                # Get database path from environment or use default
                db_path = os.getenv("KOTAEMON_DB_PATH", 
                    os.path.join(os.path.dirname(__file__), "..", "..", "ktem_app_data", "user_data", "sql.db"))

                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                
                # Get all index tables first
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'index__%__source'")
                all_tables = cursor.fetchall()

                for doc in docs_for_rag:
                    found_uuid = None
                    found_table = None

                    # Check if it's already a UUID
                    if re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', doc, re.I):
                        # Verify where it lives if possible
                        found_in_search = False
                        for (table_name,) in all_tables:
                             cursor.execute(f"SELECT id FROM {table_name} WHERE id = ?", (doc,))
                             if cursor.fetchone():
                                 found_uuid = doc
                                 found_table = table_name
                                 found_in_search = True
                                 break
                        
                        if not found_in_search:
                             # Default to LightRAG if not found
                             lightrag_uuids.append(doc)
                             docs_with_uuids.append(doc)
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
                        print(f"🔄 LangGraph Agent: Found '{doc}' in {found_table} -> {found_uuid}")
                        
                        if "index__1" in found_table:
                            file_index_uuids.append(found_uuid)
                        else:
                            lightrag_uuids.append(found_uuid)
                    else:
                        print(f"⚠️ LangGraph Agent: Could not find UUID for '{doc}'")

                conn.close()
            except Exception as e:
                print(f"⚠️ LangGraph Agent UUID conversion error: {e}")
                docs_with_uuids = docs_for_rag
                lightrag_uuids = docs_for_rag

        # Determine file selection mode
        file_selection_mode = 'select' if docs_with_uuids else 'all'

        try:
            # Login before each request (Kotaemon Gradio is stateless)
            try:
                await loop.run_in_executor(None, lambda: kotaemon_client.predict("admin", "admin", api_name="/login_1"))
                print("🔑 Logged in to Kotaemon")
            except Exception as login_err:
                print(f"⚠️ Login warning: {login_err}")

            # Load files for LightRAG (index 3) - use UUIDs
            if docs_with_uuids:
                try:
                    await loop.run_in_executor(None, lambda: kotaemon_client.predict(selected_files=docs_with_uuids, api_name="/load_files_2"))
                    print(f"📂 Loaded files for LightRAG (UUIDs): {docs_with_uuids}")
                except Exception as load_err:
                    print(f"⚠️ Load files warning: {load_err}")

            # Step 1: Submit message using /submit_msg - use UUIDs
            # Image is now part of docs_with_uuids (RAG context), so we don't need 'files' here
            chat_input = {'text': prompt, 'files': []}
            
            submit_result = await loop.run_in_executor(
                None,
                lambda: kotaemon_client.predict(
                    chat_input=chat_input,
                    chat_history=history or [],
                    conv_name=None,
                    first_selector_choices=docs_with_uuids,
                    api_name="/submit_msg"
                )
            )

            # Get updated history
            updated_history = submit_result[1] if len(submit_result) > 1 else [[prompt, None]]

            # Step 2: Get response using /chat_fn
            # Use Dynamic Split params
            llm_type = self._get_llm_type(self.model_name)
            
            param_11_mode = 'select' if docs_with_uuids else 'full' # File Index mode
            param_17_mode = 'select' if docs_with_uuids else 'full' # LightRAG mode

            print(f"🔍 LangGraph Agent: Querying with Dynamic Split")
            print(f"   File Index (param_12): {file_index_uuids}")
            print(f"   LightRAG (param_18): {lightrag_uuids}")

            chat_result = await loop.run_in_executor(
                None,
                lambda: kotaemon_client.predict(
                    chat_history=updated_history,
                    llm_type=llm_type,
                    use_citation="highlight",
                    language="id",
                    param_11=param_11_mode,        # File Index Mode
                    param_12=file_index_uuids,     # File Index UUIDs
                    param_14='full',               # GraphRAG
                    param_15=[],                   # GraphRAG
                    param_17=param_17_mode,        # LightRAG Mode
                    param_18=lightrag_uuids,       # LightRAG UUIDs
                    api_name="/chat_fn"
                )
            )

            # Parse result
            output = ""
            if isinstance(chat_result, tuple) and len(chat_result) > 0:
                result_history = chat_result[0]
                if isinstance(result_history, list) and len(result_history) > 0:
                    last_exchange = result_history[-1]
                    if isinstance(last_exchange, list) and len(last_exchange) > 1:
                        output = last_exchange[1] or ""
            elif isinstance(chat_result, str):
                output = chat_result
            else:
                output = str(chat_result)

            return output.strip()

        except Exception as e:
            error_str = str(e).lower()
            print(f"[ERROR] Kotaemon API error: {e}")
            import traceback
            traceback.print_exc()

            # Check for quota/rate limit errors
            quota_keywords = ["quota", "rate limit", "exceeded", "429", "resource exhausted"]
            if any(keyword in error_str for keyword in quota_keywords):
                raise ValueError(
                    "⚠️ **Quota API Exceeded!**\n\n"
                    "Batas penggunaan API telah tercapai. Silakan:\n"
                    "1. Tunggu beberapa menit dan coba lagi\n"
                    "2. Atau hubungi administrator untuk upgrade quota\n\n"
                    "Kotaemon menggunakan Gemini API yang memiliki batas penggunaan harian."
                )

            # Check for Gradio upstream errors (usually quota-related in Kotaemon)
            if "upstream gradio app has raised an exception" in error_str:
                raise ValueError(
                    "⚠️ **Kotaemon Error**\n\n"
                    "Terjadi kesalahan pada server Kotaemon. Kemungkinan penyebab:\n"
                    "1. **Quota API Gemini habis** - tunggu beberapa menit\n"
                    "2. Model LLM tidak tersedia - cek konfigurasi Kotaemon\n"
                    "3. Server Kotaemon overload - restart jika perlu\n\n"
                    "💡 *Coba lagi dalam beberapa saat.*"
                )
            raise

    def _extract_json_from_response(self, response: str) -> Optional[Dict]:
        """
        Extract JSON from Kotaemon response.

        Handles cases where JSON is wrapped in markdown code fences.
        """
        # Clean up response
        text = response.strip()

        # Remove markdown code fences if present
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]

        if text.endswith("```"):
            text = text[:-3]

        text = text.strip()

        # Try to parse as JSON
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON object in the text
            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass

        return None

    def _save_questions_from_json(self, data: Dict, session_id: str):
        """Save questions from parsed JSON to session."""
        questions = []

        if "questions" in data:
            for i, q in enumerate(data["questions"]):
                q_type = str(q.get("type", "multiple_choice")).lower()
                
                # Base question data - be robust with field names
                raw_q_text = q.get("question", q.get("question_text", q.get("content", "")))
                
                question_data = {
                    "id": q.get("id", f"q{i+1}"), 
                    "number": i + 1,
                    "question": raw_q_text, 
                    "question_text": raw_q_text,
                    "content": json.dumps(q),
                    "correct_answer": q.get("correct_answer", ""),
                    "explanation": q.get("explanation", ""),
                    "type": q_type,
                    "options": q.get("options", [])
                }
                
                # Handle True/False Normalization for Frontend
                if q_type == "true_false":
                    raw_ans = str(q.get("correct_answer", "")).lower()
                    if raw_ans in ["true", "benar", "yes", "1"]:
                        question_data["correct_answer"] = "Benar"
                    else:
                        question_data["correct_answer"] = "Salah"
                
                # Handle Matching Questions Transformation
                if q_type == "matching":
                    # Check if items/matches are already provided correctly by AI
                    items = q.get("items", [])
                    matches = q.get("matches", [])
                    
                    if items and matches and isinstance(items, list) and isinstance(matches, list):
                        print(f"✅ AI provided direct items and matches for matching")
                        question_data["items"] = items
                        question_data["matches"] = matches
                        # Keep correct_answer as is if it's already a dict mapping
                        if isinstance(q.get("correct_answer"), dict):
                            question_data["correct_answer"] = q.get("correct_answer")
                        else:
                            # Re-map if it's just a string or list
                            print(f"⚠️ Re-mapping correct_answer for direct items/matches")
                            correct_map = {}
                            for idx in range(len(items)):
                                correct_map[str(items[idx].get("id", idx+1))] = str(matches[idx].get("id", chr(65+idx)))
                            question_data["correct_answer"] = correct_map
                    else:
                        # Try to transform from matching_pairs fallback
                        matching_pairs = q.get("matching_pairs", q.get("pairs", []))
                        
                        # Fallback: If no matching_pairs but correct_answer is a dict/mapping
                        if not matching_pairs and isinstance(q.get("correct_answer"), dict):
                            print(f"🔄 Reconstructing matching pairs from correct_answer dict")
                            matching_pairs = []
                            for k, v in q.get("correct_answer").items():
                                matching_pairs.append({"left": str(k), "right": str(v)})
                        
                        if matching_pairs:
                             print(f"📦 Processing matching pairs: {matching_pairs}")
                             transformed_items = []
                             transformed_matches = []
                             for idx, pair in enumerate(matching_pairs):
                                item_id = str(idx + 1)
                                match_id = chr(65 + idx)
                                
                                left_text = pair.get("left", pair.get("item", ""))
                                right_text = pair.get("right", pair.get("match", ""))
                                
                                transformed_items.append({"id": item_id, "text": left_text})
                                transformed_matches.append({"id": match_id, "text": right_text})
                            
                             # Strict Correct mapping: { item_id: match_id }
                             correct_map = {}
                             for idx in range(len(matching_pairs)):
                                  correct_map[str(idx + 1)] = chr(65 + idx)
                             
                             question_data["items"] = transformed_items
                             question_data["matches"] = transformed_matches
                             question_data["correct_answer"] = correct_map
                        else:
                            question_data["items"] = []
                            question_data["matches"] = []

                questions.append(question_data)

        if questions:
            # Ensure the structure passed to QuestionSet is complete
            final_data = {
                "id": data.get("id", f"set_{session_id}"),
                "title": data.get("title", "Quiz Generated"),
                "description": data.get("description", "Quiz based on search context"),
                "questions": questions,
                "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
            }
            save_session_questions(session_id, questions)
            save_session_question_set(session_id, final_data)
            print(f"[INFO] Saved {len(questions)} questions for session {session_id}")
            return questions

    def is_available(self) -> bool:
        """Check if the agent is available (always true, depends on Kotaemon)."""
        return True

    async def _classify_intent(self, message: str, kotaemon_client: Any) -> IntentType:
        """Classify user intent using LLM."""
        prompt = f"""You are an intent classifier for an educational quiz system.
        Classify the user message into one of these categories:
        - GENERATE_QUESTION: User wants to create/make/generate new quiz questions or material.
        - CHECK_ANSWER: User is answering a question or asking to check their response (e.g., "jawab 1 A", "nomor 2 benar").
        - GENERAL_CHAT: Anything else (asking for help, greetings, general knowledge non-quiz request).

        USER MESSAGE: {message}

        Output ONLY the category name in UPPERCASE.
        """
        try:
            response = await self._send_to_kotaemon(prompt, kotaemon_client)
            response = response.upper().strip()
            
            # Use fuzzy matching for reliability
            if "GENERATE_QUESTION" in response:
                return IntentType.GENERATE_QUESTION
            elif "CHECK_ANSWER" in response:
                return IntentType.CHECK_ANSWER
            elif "GENERAL_CHAT" in response:
                return IntentType.GENERAL_CHAT
            
            # Default fallback based on common keywords if LLM is vague
            msg_lower = message.lower()
            if any(k in msg_lower for k in ["buat", "soal", "quiz", "generate", "tanya"]):
                return IntentType.GENERATE_QUESTION
            if any(k in msg_lower for k in ["jawab", "benar", "salah", "check"]):
                return IntentType.CHECK_ANSWER
                
            return IntentType.GENERAL_CHAT
        except Exception as e:
            print(f"⚠️ Intent classification failed: {e}")
            return IntentType.GENERAL_CHAT

    async def process_message(
        self,
        message: str,
        session_id: str,
        rag_context: Optional[str] = None,
        history: Optional[List[List[str]]] = None,
        kotaemon_client: Any = None,
        documents: Optional[List[str]] = None,
        image_url: Optional[str] = None
    ) -> str:
        """
        Process a message and generate a response via Kotaemon.
        Using LLM-based Intent Routing.
        """
        # Step 1: Classify Intent
        intent = await self._classify_intent(message, kotaemon_client)
        print(f"🧠 Agent Intent: {intent}")

        # Step 2: Route based on intent
        if intent == IntentType.CHECK_ANSWER:
            # Attempt to extract answer parameters locally first (regex is faster/reliable for simple formats)
            is_answer, q_num, answer_val = self._is_answer_check(message)
            if is_answer:
                 return self._check_answer_locally(q_num, answer_val, session_id)
            
            # If regex failed but intent is check_answer, maybe the user replied "True" to the last question?
            # For now, we Fallback to General Chat if we can't parse the answer format, 
            # OR we could ask the LLM to extract parameters. 
            # Let's try to extract basic "True/False" or "A/B" from the message
            # Naive fallback:
            cleaned = message.strip().upper()
            if cleaned in ["A", "B", "C", "D", "TRUE", "FALSE", "BENAR", "SALAH"]:
                # Assume answering the last unanswered question? 
                # For safety, let's just return a help message or fallback to chat
                pass

        if intent == IntentType.GENERATE_QUESTION:
            print(f"[INFO] Question generation request detected")
            print(f"[INFO] Documents for RAG: {documents}")

            # Build prompt with Pydantic Schema
            prompt = self._build_question_prompt(message, rag_context)

            try:
                # Send to Kotaemon with documents for RAG
                response = await self._send_to_kotaemon(prompt, kotaemon_client, history, documents, image_url)

                # Try to extract JSON
                json_data = self._extract_json_from_response(response)

                if json_data:
                    # Save questions to session AND get processed list (with transformations for matching)
                    processed_questions = self._save_questions_from_json(json_data, session_id)
                    
                    # Update json_data['questions'] with processed versions to ensure frontend gets 'items'/'matches'
                    json_data["questions"] = processed_questions
                    
                    # Save the complete question set for session persistence
                    save_session_question_set(session_id, json_data)
                    
                    # Return clean JSON string
                    return json.dumps(json_data, ensure_ascii=False, indent=2)
                else:
                    print(f"[WARN] Could not parse JSON from response")
                    return response

            except ValueError as e:
                return str(e)
            except Exception as e:
                print(f"[ERROR] Question generation failed: {e}")
                return f"Maaf, terjadi kesalahan saat membuat soal: {str(e)}"

        # Default: General Chat
        # Regular chat - just forward to Kotaemon with documents
        try:
            response = await self._send_to_kotaemon(message, kotaemon_client, history, documents, image_url)
            return response
        except ValueError as e:
            return str(e)
        except Exception as e:
            print(f"[ERROR] Chat failed: {e}")
            return f"Maaf, terjadi kesalahan: {str(e)}"

    def _normalize_tf_value(self, val: Any) -> str:
        """
        Unifies all True/False related values (A, B, True, False, Benar, Salah).
        Returns 'TRUE', 'FALSE', or original if no match.
        """
        # Handle list inputs (e.g. ["true"]) - take first element
        if isinstance(val, list):
            if len(val) > 0:
                val = val[0]
            else:
                return "FALSE"

        if isinstance(val, bool):
            return 'TRUE' if val else 'FALSE'
            
        s = str(val).upper().strip()
        
        # A, Benar, True variations
        if s in ['A', 'TRUE', 'BENAR', 'T', 'YES', 'YA', 'CORRECT', 'BETUL', '1', 'IYA']:
            return 'TRUE'
            
        # B, Salah, False variations
        if s in ['B', 'FALSE', 'SALAH', 'F', 'NO', 'TIDAK', 'INCORRECT', 'WRONG', '0', 'S']:
            return 'FALSE'
            
        return s

    def _normalize_boolean_answer(self, answer: str) -> str:
        return self._normalize_tf_value(answer)

    def _check_answer_locally(self, question_num: int, user_answer: str, session_id: str) -> str:
        """Check user's answer against stored questions (no LLM call needed)."""
        questions = get_session_questions(session_id)

        if not questions:
            return "❌ Tidak ada soal yang tersimpan. Silakan buat soal terlebih dahulu dengan perintah seperti 'buat 3 soal pilihan ganda tentang Python'."

        if question_num < 1 or question_num > len(questions):
            return f"❌ Nomor soal tidak valid. Tersedia soal 1-{len(questions)}."

        if is_question_answered(session_id, question_num):
            return f"⚠️ Soal {question_num} sudah dijawab sebelumnya."

        q = questions[question_num - 1]
        q_type = q.get('type', 'multiple_choice')
        correct_answer_raw = q.get('correct_answer', '')

        # Normalize boolean answers for true/false questions
        # OR if the user provides a boolean answer (handling cases where q_type might be missing/wrong)
        is_user_bool = self._normalize_tf_value(user_answer) in ['TRUE', 'FALSE']
        
        if q_type in ['true_false', 'benar_salah'] or is_user_bool:
            correct_answer = self._normalize_tf_value(correct_answer_raw)
            user_answer_norm = self._normalize_tf_value(user_answer)
        else:
            correct_answer = str(correct_answer_raw).upper().strip()
            user_answer_norm = user_answer.upper().strip()

        # Handle multiple select (comma-separated)
        if ',' in str(correct_answer_raw) or isinstance(correct_answer_raw, list):
            # If we already obtained a boolean 'correct_answer' from _normalize_tf_value, we might skip this
            # UNLESS it was actually a list we flattened.
            # But specific check: if it's true_false type, we use the single value comparison
            if q_type in ['true_false', 'benar_salah'] or (is_user_bool and correct_answer in ['TRUE', 'FALSE']):
                is_correct = correct_answer == user_answer_norm
            else:
                if isinstance(correct_answer_raw, list):
                    correct_set = set([str(a).upper().strip() for a in correct_answer_raw])
                else:
                    correct_set = set([a.strip() for a in str(correct_answer_raw).split(',')])
                user_set = set([a.strip() for a in user_answer_norm.split(',')])
                is_correct = correct_set == user_set
        else:
            is_correct = correct_answer == user_answer_norm
            
        # Update score
        update_session_score(session_id, question_num, is_correct)
        score = get_session_score(session_id)
        percentage = (score['correct'] / score['total'] * 100) if score['total'] > 0 else 0

        q_text = q.get('question_text', q.get('question', 'N/A'))
        explanation = q.get('explanation', '')

        # Display original user answer, not normalized
        display_user_answer = user_answer.strip()
        display_correct_answer = str(correct_answer_raw).strip()

        if is_correct:
            return f"""✅ **BENAR!**

**Soal {question_num}:** {q_text}
**Jawaban Anda:** {display_user_answer}

💡 **Penjelasan:** {explanation}

📊 **Skor:** {score['correct']}/{score['total']} ({percentage:.0f}%)"""
        else:
            return f"""❌ **SALAH!**

**Soal {question_num}:** {q_text}
**Jawaban Anda:** {display_user_answer}
**Jawaban Benar:** {display_correct_answer}

💡 **Penjelasan:** {explanation}

📊 **Skor:** {score['correct']}/{score['total']} ({percentage:.0f}%)"""

    async def process_request(
        self,
        request: AgentRequest,
        kotaemon_client: Optional[Any] = None,
    ) -> AgentResponse:
        """
        Process an AgentRequest and return AgentResponse.

        Provides compatibility with the existing API.
        """
        # Get documents for RAG - combine documents list and single document
        documents = []
        if request.documents:
            documents = request.documents
        elif request.document:
            documents = [request.document]

        print(f"[INFO] process_request - Documents for RAG: {documents}")

        # Process the message with documents
        output = await self.process_message(
            message=request.message,
            session_id=request.session_id,
            rag_context=request.context,
            history=request.history,
            kotaemon_client=kotaemon_client,
            documents=documents,
            image_url=request.image_url
        )

        # Check if this is a question-related response
        # Check if this is a question-related response
        # Since process_message handles everything, we can check if we have a question set
        question_set = get_session_question_set(request.session_id)
        is_question_response = question_set is not None

        # Get any stored question set
        question_set = get_session_question_set(request.session_id)

        return AgentResponse(
            output=output,
            agent_style=request.agent_style,
            session_id=request.session_id,
            sources=None,
            questions=QuestionSet(**question_set) if question_set else None,
            export_json=None,
            export_markdown=None,
            editable=is_question_response,
        )

    def clear_session(self, session_id: str):
        """Clear all data for a session."""
        if session_id in _session_questions:
            del _session_questions[session_id]
        if session_id in _session_question_sets:
            del _session_question_sets[session_id]
        if session_id in _session_quiz_scores:
            del _session_quiz_scores[session_id]
        if session_id in _session_answered:
            del _session_answered[session_id]


# ============================================================================
# Singleton Instance
# ============================================================================

_agent_instance: Optional[LangGraphQuestionAgent] = None


def get_agent(model: str = "gemini-2.5-flash") -> LangGraphQuestionAgent:
    """Get or create the singleton agent instance."""
    global _agent_instance

    if _agent_instance is None:
        _agent_instance = LangGraphQuestionAgent(model=model)

    return _agent_instance


def reset_agent():
    """Reset the agent instance."""
    global _agent_instance
    _agent_instance = None
