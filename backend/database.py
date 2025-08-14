from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure
import os
from dotenv import load_dotenv

load_dotenv()


class Database:
    client: AsyncIOMotorClient = None
    database = None


db = Database()


async def connect_to_mongo():
    """Create database connection"""
    try:
        db.client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
        db.database = db.client[os.getenv("DATABASE_NAME", "red_pandas_db")]
        # Test connection
        await db.client.admin.command('ping')
        print("✅ Connected to MongoDB")
    except ConnectionFailure:
        print("❌ Could not connect to MongoDB")
        raise


async def close_mongo_connection():
    """Close database connection"""
    if db.client:
        db.client.close()
        print("👋 Disconnected from MongoDB")


def get_database():
    """Get database instance"""
    return db.database
