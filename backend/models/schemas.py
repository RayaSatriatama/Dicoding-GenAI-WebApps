"""
Pydantic schemas for MongoDB documents.
These mirror the Mongoose schemas from the Express.js backend.
"""

from datetime import datetime
from typing import Optional, List, Union
from pydantic import BaseModel, Field
from bson import ObjectId


class PyObjectId(str):
    """Custom type for MongoDB ObjectId"""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v, *args):
        if isinstance(v, ObjectId):
            return str(v)
        if isinstance(v, str):
            if ObjectId.is_valid(v):
                return v
        raise ValueError("Invalid ObjectId")


# ============== Chat Models ==============

class ChatPart(BaseModel):
    """Part of a chat message (text content)"""
    text: str


class ChatMessage(BaseModel):
    """A single message in chat history"""
    role: str  # "user" or "model"
    parts: List[ChatPart]
    img: Optional[str] = None


class Chat(BaseModel):
    """Chat document schema"""
    id: Optional[str] = Field(None, alias="_id")
    userId: str
    history: List[ChatMessage] = []
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class ChatCreate(BaseModel):
    """Request body for creating a new chat"""
    text: str


class ChatUpdate(BaseModel):
    """Request body for updating a chat"""
    question: Optional[str] = None
    answer: str
    img: Optional[str] = None


# ============== UserChats Models ==============

class UserChatItem(BaseModel):
    """A chat item in user's chat list"""
    id: str = Field(..., alias="_id")
    title: str
    createdAt: Optional[datetime] = Field(default_factory=datetime.now)
    
    class Config:
        populate_by_name = True


class UserChats(BaseModel):
    """UserChats document schema - list of user's chats"""
    id: Optional[str] = Field(None, alias="_id")
    userId: str
    chats: List[UserChatItem] = []
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


# ============== Document Models ==============

ALLOWED_DOCUMENT_TYPES = [
    "txt", "pdf", "docx", "rtf", "html", "xml", 
    "json", "csv", "md", "epub", "odt", "pptx", 
    "tsv", "yaml", "log"
]


class Document(BaseModel):
    """Document schema for uploaded files"""
    id: Optional[str] = Field(None, alias="_id")
    userId: str
    size: int
    title: str
    path: str
    type: str  # File extension
    uploadDate: Optional[datetime] = Field(default_factory=datetime.now)
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class DocumentCreate(BaseModel):
    """Request body for creating a document record"""
    title: str
    size: int
    type: str
    path: Optional[str] = None


# ============== Auth Models ==============

class TokenPayload(BaseModel):
    """JWT token payload from Clerk"""
    sub: str  # User ID
    exp: Optional[int] = None
    iat: Optional[int] = None
    azp: Optional[str] = None  # Authorized party
    
    @property
    def user_id(self) -> str:
        return self.sub
