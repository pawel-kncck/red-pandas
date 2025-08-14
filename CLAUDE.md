# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Red Pandas is an LLM-powered data analytics application that follows OpenAI's Code Interpreter approach. Instead of sending entire datasets to the LLM, it generates and executes Python/pandas code to analyze data efficiently.

## Commands

### Backend Development

```bash
# Start backend server (includes venv setup and dependency installation)
./run.sh

# Or manually:
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The backend runs at `http://localhost:8000` with API docs at `http://localhost:8000/docs`

### Environment Setup

Create a `.env` file in the backend directory with:
- `OPENAI_API_KEY`: Your OpenAI API key
- `MONGODB_URL`: MongoDB connection string (local or Atlas)
- `DATABASE_NAME`: Database name (default: red_pandas_db)

## Architecture

### Core Flow
1. **Context Understanding**: LLM receives data structure and sample rows
2. **Code Generation**: LLM generates Python/pandas code to answer questions  
3. **Execution & Interpretation**: System executes code safely and LLM interprets results

### Key Components

- **FastAPI Backend** (`backend/main.py`): API endpoints for session management and data analysis
- **MongoDB Integration** (`backend/database.py`): Stores sessions and conversation history using Motor (async MongoDB driver)
- **Code Validation**: AST-based validation ensures generated code is safe to execute (checks for forbidden imports, dangerous builtins)
- **Sandboxed Execution**: Code runs in restricted namespace with only pandas, numpy, and safe libraries available
- **Conversation Management**: Maintains context from previous queries for better follow-up responses

### Security Considerations

The system implements multiple security layers:
- Pre-execution AST validation to detect dangerous patterns
- Restricted execution namespace (no file system, network, or subprocess access)
- Configurable resource limits (execution timeout, output size, dataframe size)
- Input validation at all levels (file uploads, queries, generated code)

### API Endpoints

- `POST /api/session/create`: Upload CSV and create analysis session
- `POST /api/session/{session_id}/analyze`: Analyze data with natural language query
- `GET /api/session/{session_id}`: Get session details and history
- `GET /api/sessions`: List all sessions
- `GET /api/health`: Health check

## Development Notes

- The backend uses FastAPI with async/await patterns throughout
- All OpenAI interactions use configurable temperature settings for code generation vs interpretation
- Conversation history is stored in MongoDB with configurable retention limits
- The system validates that generated code assigns results to a 'result' variable
- Error messages are sanitized for user-friendly display