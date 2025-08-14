from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import pandas as pd
import numpy as np
import io
import uuid
from datetime import datetime
import logging

from config import settings
from database import connect_to_mongo, close_mongo_connection, get_database
from models import (
    Query, SessionCreate, SessionList, HealthCheck,
    AnalysisResponse, Session
)
from code_validator import CodeValidator
from executor import execute_code_safely
from conversation_manager import ConversationManager
from openai_client import (
    OpenAIManager, create_code_generation_prompt,
    clean_code_response, interpret_results
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    # Startup
    await connect_to_mongo()
    logger.info("Application startup complete")
    yield
    # Shutdown
    await close_mongo_connection()
    logger.info("Application shutdown complete")


app = FastAPI(
    title="Red Pandas API",
    description="LLM-powered data analytics API",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthCheck)
async def health_check():
    """Check health status of the API and its dependencies"""
    db_status = "healthy"
    openai_status = "healthy"
    
    # Check database connection
    try:
        db = get_database()
        await db.command('ping')
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = "unhealthy"
    
    # Check OpenAI API key
    try:
        if not settings.OPENAI_API_KEY:
            openai_status = "missing API key"
    except Exception:
        openai_status = "configuration error"
    
    overall_status = "healthy" if db_status == "healthy" and openai_status == "healthy" else "degraded"
    
    return HealthCheck(
        status=overall_status,
        database=db_status,
        openai=openai_status,
        timestamp=datetime.now()
    )


@app.post("/api/session/create", response_model=SessionCreate)
async def create_session(file: UploadFile = File(...)):
    """
    Create analysis session from uploaded CSV with comprehensive validation
    """
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported. Please upload a .csv file."
        )

    # Check file size
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset to beginning

    if file_size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE / 1024 / 1024:.1f}MB"
        )

    if file_size == 0:
        raise HTTPException(
            status_code=400,
            detail="File is empty"
        )

    try:
        # Read file contents
        contents = await file.read()

        # Try to parse CSV
        try:
            df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        except UnicodeDecodeError:
            # Try with different encoding
            df = pd.read_csv(io.StringIO(contents.decode('latin-1')))

        # Validate dataframe
        if df.empty:
            raise HTTPException(
                status_code=400,
                detail="CSV file contains no data"
            )

        if len(df.columns) == 0:
            raise HTTPException(
                status_code=400,
                detail="CSV file contains no columns"
            )

        # Check for size limits
        total_cells = len(df) * len(df.columns)
        if total_cells > settings.MAX_DATAFRAME_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"Dataset too large: {total_cells:,} cells exceeds limit of {settings.MAX_DATAFRAME_SIZE:,}"
            )

        # Extract metadata
        session_id = str(uuid.uuid4())

        # Get sample rows (configurable)
        sample_size = min(settings.DEFAULT_SAMPLE_ROWS, len(df))

        session_data = {
            "_id": session_id,
            "filename": file.filename,
            "created_at": datetime.now(),
            "columns": df.columns.tolist(),
            "dtypes": df.dtypes.astype(str).to_dict(),
            "row_count": len(df),
            "column_count": len(df.columns),
            "data_sample": df.head(sample_size).to_dict('records'),
            "full_data": df.to_dict('records'),  # MVP: Store in MongoDB
            "conversation_history": [],  # Initialize empty conversation history
            "null_counts": df.isnull().sum().to_dict(),  # Track null values
            "numeric_columns": df.select_dtypes(include=[np.number]).columns.tolist(),
            "categorical_columns": df.select_dtypes(include=['object']).columns.tolist()
        }

        # Store in MongoDB
        db = get_database()
        await db.sessions.insert_one(session_data)

        logger.info(f"Created session {session_id} for file {file.filename}")

        return SessionCreate(
            session_id=session_id,
            message=f"Successfully uploaded {file.filename}",
            data_info={
                "rows": session_data["row_count"],
                "columns": session_data["column_count"],
                "column_names": session_data["columns"],
                "data_types": session_data["dtypes"],
                "numeric_columns": session_data["numeric_columns"],
                "categorical_columns": session_data["categorical_columns"],
                "null_counts": session_data["null_counts"],
                "sample": session_data["data_sample"]
            }
        )

    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except pd.errors.EmptyDataError:
        raise HTTPException(
            status_code=400,
            detail="CSV file is empty or invalid"
        )
    except pd.errors.ParserError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error parsing CSV: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error processing file: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}"
        )


@app.post("/api/session/{session_id}/analyze", response_model=AnalysisResponse)
async def analyze_data(session_id: str, query: Query):
    """
    Analyze data by generating and executing Python code with full context
    """
    # 1. Retrieve session
    db = get_database()
    session = await db.sessions.find_one({"_id": session_id})

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 2. Load data into DataFrame
    try:
        df = pd.DataFrame(session['full_data'])
    except Exception as e:
        logger.error(f"Error loading data: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error loading data: {str(e)}"
        )

    # 3. Get conversation context
    conv_manager = ConversationManager(db)
    context = await conv_manager.get_conversation_context(session_id)

    # 4. Generate code using LLM with context
    code_prompt = create_code_generation_prompt(
        df_info={
            'row_count': session['row_count'],
            'column_count': session['column_count'],
            'columns': session['columns'],
            'dtypes': session['dtypes'],
            'data_sample': session['data_sample'],
            'numeric_columns': session.get('numeric_columns', []),
            'categorical_columns': session.get('categorical_columns', []),
            'null_counts': session.get('null_counts', {})
        },
        question=query.question,
        context=context  # Pass conversation context
    )

    try:
        # Call OpenAI API
        openai_manager = OpenAIManager()
        generated_code = await openai_manager.generate_completion(
            messages=[
                {
                    "role": "system",
                    "content": "You are a data analyst. Generate only executable Python code with comments."
                },
                {
                    "role": "user",
                    "content": code_prompt
                }
            ],
            temperature=settings.OPENAI_CODE_GENERATION_TEMPERATURE
        )

        generated_code = clean_code_response(generated_code)

    except Exception as e:
        logger.error(f"Error generating code: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating code: {str(e)}"
        )

    # 5. Validate generated code
    validator = CodeValidator()
    is_valid, validation_message = validator.validate_code(generated_code)

    if not is_valid:
        # Try to regenerate with more specific instructions
        retry_prompt = code_prompt + f"\n\nPrevious attempt failed validation: {validation_message}\nPlease generate corrected code that assigns the result to 'result' variable."

        try:
            generated_code = await openai_manager.generate_completion(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a data analyst. Generate only valid, executable Python code that assigns result to 'result' variable."
                    },
                    {
                        "role": "user",
                        "content": retry_prompt
                    }
                ],
                temperature=settings.OPENAI_CODE_GENERATION_TEMPERATURE
            )

            generated_code = clean_code_response(generated_code)
            is_valid, validation_message = validator.validate_code(generated_code)

            if not is_valid:
                logger.error(f"Code validation failed: {validation_message}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Generated code failed validation: {validation_message}"
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error regenerating code: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Error regenerating code: {str(e)}"
            )

    # 6. Execute generated code
    execution_result = await execute_code_safely(df, generated_code)

    # 7. Interpret results
    if execution_result['success']:
        interpretation = await interpret_results(
            question=query.question,
            code=generated_code,
            result=execution_result['output'],
            openai_manager=openai_manager
        )
        error = None
    else:
        interpretation = f"The analysis encountered an error. Please try rephrasing your question."
        error = execution_result['error']

    # 8. Store interaction in conversation history
    conversation_id = await conv_manager.add_interaction(
        session_id=session_id,
        question=query.question,
        code=generated_code,
        result=execution_result['output'] if execution_result['success'] else None,
        interpretation=interpretation,
        error=error
    )

    logger.info(f"Completed analysis for session {session_id}: {query.question[:50]}...")

    # 9. Return response
    return AnalysisResponse(
        question=query.question,
        generated_code=generated_code,
        raw_result=execution_result['output'] if execution_result['success'] else None,
        interpretation=interpretation,
        error=error,
        execution_time=execution_result['execution_time'],
        conversation_id=conversation_id
    )


@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    """Get session details and conversation history"""
    db = get_database()
    session = await db.sessions.find_one({"_id": session_id})
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Remove full_data from response (too large)
    session_response = {
        "id": session["_id"],
        "filename": session["filename"],
        "created_at": session["created_at"],
        "columns": session["columns"],
        "dtypes": session["dtypes"],
        "row_count": session["row_count"],
        "column_count": session["column_count"],
        "data_sample": session["data_sample"],
        "conversation_history": session.get("conversation_history", []),
        "numeric_columns": session.get("numeric_columns", []),
        "categorical_columns": session.get("categorical_columns", [])
    }
    
    return session_response


@app.get("/api/sessions", response_model=SessionList)
async def list_sessions(limit: int = 100, skip: int = 0):
    """List all sessions (limited for MVP)"""
    db = get_database()
    
    # Get sessions sorted by created_at descending
    cursor = db.sessions.find(
        {},
        {
            "_id": 1,
            "filename": 1,
            "created_at": 1,
            "row_count": 1,
            "column_count": 1
        }
    ).sort("created_at", -1).skip(skip).limit(min(limit, 100))
    
    sessions = []
    async for session in cursor:
        sessions.append({
            "id": session["_id"],
            "filename": session["filename"],
            "created_at": session["created_at"],
            "row_count": session["row_count"],
            "column_count": session["column_count"]
        })
    
    # Get total count
    total = await db.sessions.count_documents({})
    
    return SessionList(sessions=sessions, total=total)


@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its data"""
    db = get_database()
    result = await db.sessions.delete_one({"_id": session_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    logger.info(f"Deleted session {session_id}")
    
    return {"message": "Session deleted successfully"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)