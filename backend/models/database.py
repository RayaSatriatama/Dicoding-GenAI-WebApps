"""
MongoDB database connection using Motor (async MongoDB driver).
"""

import os
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from dotenv import load_dotenv

load_dotenv()

# Database connection string
MONGODB_URL = os.getenv("MONGO", os.getenv("MONGODB_URL", "mongodb://localhost:27017"))
DATABASE_NAME = os.getenv("DATABASE_NAME", "chatapp")

# Global database instances
_client: Optional[AsyncIOMotorClient] = None
_database: Optional[AsyncIOMotorDatabase] = None


class DatabaseManager:
    """Manages MongoDB connection lifecycle."""
    
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.database: Optional[AsyncIOMotorDatabase] = None
    
    async def connect(self) -> None:
        """Initialize MongoDB connection."""
        if self.client is None:
            try:
                self.client = AsyncIOMotorClient(MONGODB_URL)
                self.database = self.client[DATABASE_NAME]
                # Test connection
                await self.client.admin.command('ping')
                print(f"✅ Connected to MongoDB: {DATABASE_NAME}")
            except Exception as e:
                print(f"❌ Failed to connect to MongoDB: {e}")
                self.client = None
                self.database = None
                raise
    
    async def disconnect(self) -> None:
        """Close MongoDB connection."""
        if self.client:
            self.client.close()
            self.client = None
            self.database = None
            print("🔌 Disconnected from MongoDB")
    
    def get_db(self) -> AsyncIOMotorDatabase:
        """Get the database instance."""
        if self.database is None:
            raise RuntimeError("Database not initialized. Call connect() first.")
        return self.database
    
    # Collection accessors
    @property
    def chats(self):
        """Get chats collection."""
        return self.get_db().chats
    
    @property
    def userchats(self):
        """Get userchats collection."""
        return self.get_db().userchats
    
    @property
    def documents(self):
        """Get documents collection."""
        return self.get_db().documents


# Global database manager instance
db = DatabaseManager()


async def init_database() -> None:
    """Initialize database connection (call on startup)."""
    await db.connect()


async def close_database() -> None:
    """Close database connection (call on shutdown)."""
    await db.disconnect()


def get_database() -> AsyncIOMotorDatabase:
    """Dependency for getting database in route handlers."""
    return db.get_db()
