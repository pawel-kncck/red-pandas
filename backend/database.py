from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure
from config import settings
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Database:
    client: AsyncIOMotorClient = None
    database = None


db = Database()


async def connect_to_mongo():
    """Create database connection with connection pooling"""
    try:
        db.client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            maxPoolSize=10,
            minPoolSize=2,
            serverSelectionTimeoutMS=5000
        )
        db.database = db.client[settings.DATABASE_NAME]
        
        # Test connection
        await db.client.admin.command('ping')
        
        # Create indexes for better performance
        await create_indexes()
        
        logger.info("Connected to MongoDB successfully")
    except ConnectionFailure as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error connecting to MongoDB: {e}")
        raise


async def create_indexes():
    """Create indexes for session lookups"""
    try:
        sessions_collection = db.database.sessions
        
        # Create index on session ID
        await sessions_collection.create_index("_id")
        
        # Create index on created_at for sorting
        await sessions_collection.create_index([("created_at", -1)])
        
        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.warning(f"Failed to create indexes: {e}")


async def close_mongo_connection():
    """Close database connection"""
    if db.client:
        db.client.close()
        logger.info("Disconnected from MongoDB")


def get_database():
    """Get database instance for connection pooling"""
    if db.database is None:
        raise ConnectionError("Database not connected. Call connect_to_mongo() first.")
    return db.database
