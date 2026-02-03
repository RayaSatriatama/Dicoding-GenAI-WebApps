# MongoDB Models for FastAPI
from .schemas import (
    ChatMessage,
    ChatPart,
    Chat,
    ChatCreate,
    ChatUpdate,
    UserChats,
    UserChatItem,
    Document,
    DocumentCreate,
)
from .database import (
    get_database,
    init_database,
    close_database,
    db,
)

__all__ = [
    # Schemas
    "ChatMessage",
    "ChatPart",
    "Chat",
    "ChatCreate",
    "ChatUpdate",
    "UserChats",
    "UserChatItem",
    "Document",
    "DocumentCreate",
    # Database
    "get_database",
    "init_database",
    "close_database",
    "db",
]
