"""
Chat API Routes
================
Migrated from Express.js backend to FastAPI.
Handles CRUD operations for chats and user chat lists.
"""

from datetime import datetime
from typing import List, Optional
from bson import ObjectId

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from models import db, Chat, ChatCreate, ChatUpdate, ChatMessage, ChatPart, UserChatItem
from middleware import require_auth

router = APIRouter(prefix="/api", tags=["chats"])


# ============== Request/Response Models ==============

class CreateChatRequest(BaseModel):
    text: str
    img: Optional[str] = None


class UpdateChatRequest(BaseModel):
    question: Optional[str] = None
    answer: str
    img: Optional[str] = None


class ChatListItem(BaseModel):
    _id: str
    title: str
    createdAt: Optional[datetime] = None


# ============== Helper Functions ==============

def generate_chat_title(text: str) -> str:
    """Generate chat title: cut at first period, or max 64 chars."""
    period_index = text.find('.')
    if 0 < period_index <= 64:
        return text[:period_index + 1]
    return text[:64]


# ============== Routes ==============

@router.post("/chats", status_code=201)
async def create_chat(
    request: CreateChatRequest,
    user_id: str = Depends(require_auth)
):
    """Create a new chat."""
    try:
        if db.database is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        # Create new chat document
        now = datetime.utcnow()
        
        initial_parts = [{"text": request.text}]
        initial_msg = {
            "role": "user",
            "parts": initial_parts
        }
        
        if request.img:
            initial_msg["img"] = request.img

        chat_doc = {
            "userId": user_id,
            "history": [initial_msg],
            "createdAt": now,
            "updatedAt": now
        }
        
        result = await db.chats.insert_one(chat_doc)
        chat_id = str(result.inserted_id)
        
        # Generate chat title
        chat_title = generate_chat_title(request.text)
        
        # Check if user has existing chats list
        user_chats = await db.userchats.find_one({"userId": user_id})
        
        chat_item = {
            "_id": chat_id,
            "title": chat_title,
            "createdAt": now
        }
        
        if not user_chats:
            # Create new userchats document
            await db.userchats.insert_one({
                "userId": user_id,
                "chats": [chat_item],
                "createdAt": now,
                "updatedAt": now
            })
        else:
            # Add to existing chats array
            await db.userchats.update_one(
                {"userId": user_id},
                {
                    "$push": {"chats": chat_item},
                    "$set": {"updatedAt": now}
                }
            )
        
        return chat_id
    
    except Exception as e:
        print(f"Error creating chat: {e}")
        raise HTTPException(status_code=500, detail="Error creating chat!")


@router.get("/userchats")
async def get_user_chats(user_id: str = Depends(require_auth)) -> List[dict]:
    """Get all chats for the current user."""
    try:
        # Graceful handling if DB is not connected
        if db.database is None:
            return []

        user_chats = await db.userchats.find_one({"userId": user_id})
        
        if not user_chats or "chats" not in user_chats:
            return []
        
        return user_chats["chats"]
    
    except Exception as e:
        print(f"Error fetching userchats: {e}")
        raise HTTPException(status_code=500, detail="Error fetching userchats!")


@router.get("/chats/{chat_id}")
async def get_chat(
    chat_id: str,
    user_id: str = Depends(require_auth)
) -> Optional[dict]:
    """Get a specific chat by ID."""
    try:
        if db.database is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        chat = await db.chats.find_one({
            "_id": ObjectId(chat_id),
            "userId": user_id
        })
        
        if chat:
            chat["_id"] = str(chat["_id"])
        
        return chat
    
    except Exception as e:
        print(f"Error fetching chat: {e}")
        raise HTTPException(status_code=500, detail="Error fetching chat!")


@router.put("/chats/{chat_id}")
async def update_chat(
    chat_id: str,
    request: UpdateChatRequest,
    user_id: str = Depends(require_auth)
):
    """Add messages to a chat."""
    try:
        if db.database is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        new_items = []
        
        # Add user message if question provided
        if request.question:
            user_msg = {
                "role": "user",
                "parts": [{"text": request.question}]
            }
            if request.img:
                user_msg["img"] = request.img
            new_items.append(user_msg)
        
        # Add model response
        new_items.append({
            "role": "model",
            "parts": [{"text": request.answer}]
        })
        
        result = await db.chats.find_one_and_update(
            {"_id": ObjectId(chat_id), "userId": user_id},
            {
                "$push": {"history": {"$each": new_items}},
                "$set": {"updatedAt": datetime.utcnow()}
            },
            return_document=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Chat not found.")
        
        result["_id"] = str(result["_id"])
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating chat: {e}")
        raise HTTPException(status_code=500, detail="Error adding conversation!")


@router.delete("/chats/{chat_id}")
async def delete_chat(
    chat_id: str,
    user_id: str = Depends(require_auth)
):
    """Delete a chat."""
    try:
        if db.database is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        # Delete the chat document
        result = await db.chats.delete_one({
            "_id": ObjectId(chat_id),
            "userId": user_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Chat not found!")
        
        # Remove from userchats list
        await db.userchats.update_one(
            {"userId": user_id},
            {"$pull": {"chats": {"_id": chat_id}}}
        )
        
        return {"message": "Chat deleted successfully!"}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting chat: {e}")
        raise HTTPException(status_code=500, detail="Error deleting chat!")
