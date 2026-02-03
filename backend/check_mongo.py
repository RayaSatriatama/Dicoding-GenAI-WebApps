
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO", "mongodb://localhost:27017/aichat")

async def check():
    print(f"Testing connection to: {MONGO_URL}")
    try:
        client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=2000)
        await client.admin.command('ping')
        print("✅ SUCCESS: Connected to MongoDB!")
    except Exception as e:
        print(f"❌ FAILURE: Could not connect to MongoDB.\nError: {e}")

if __name__ == "__main__":
    asyncio.run(check())
