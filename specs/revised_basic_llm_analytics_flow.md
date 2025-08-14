# Basic LLM Analytics Flow - Revised

## Overview

This document outlines the technical implementation and conversation flow for an LLM-powered data analytics application that mimics OpenAI's Code Interpreter approach. Instead of sending entire datasets to the LLM, the system generates and executes Python code to analyze data efficiently.

## Architecture Diagram

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend  │────▶│   FastAPI    │────▶│   MongoDB    │
│   (React)   │     │   Backend    │     │  (Sessions)  │
└─────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   OpenAI     │
                    │     API      │
                    └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │Python Runtime│
                    │  (pandas)    │
                    └──────────────┘
```

## Core Concept

Unlike traditional approaches that send entire datasets to LLMs, this system follows a three-stage process:

1. **Context Understanding**: LLM receives data structure and sample
2. **Code Generation**: LLM generates Python/pandas code to answer questions
3. **Execution & Interpretation**: System executes code and LLM interprets results

## Configuration Management

```python
# config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """Application settings with environment variable support"""

    # OpenAI Configuration
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_CODE_GENERATION_TEMPERATURE: float = 0.1
    OPENAI_INTERPRETATION_TEMPERATURE: float = 0.3

    # Execution Limits
    MAX_EXECUTION_TIMEOUT: int = 5  # seconds
    MAX_DATAFRAME_SIZE: int = 100_000_000  # cells (rows × columns)
    MAX_OUTPUT_SIZE: int = 10_000  # characters
    MAX_UPLOAD_SIZE: int = 104_857_600  # 100MB in bytes

    # Data Sampling
    DEFAULT_SAMPLE_ROWS: int = 5
    MAX_SAMPLE_ROWS: int = 10

    # Conversation History
    MAX_CONVERSATION_HISTORY: int = 10
    CONTEXT_LOOKBACK: int = 3  # Number of previous interactions to include

    # Database Configuration (handled separately as mentioned)
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "llm_analytics"

    # Security
    FORBIDDEN_IMPORTS: list = [
        'os', 'sys', 'subprocess', 'socket', 'requests',
        'urllib', 'http', 'ftplib', 'telnetlib', 'ssl',
        'importlib', 'pkgutil', 'inspect', 'ctypes'
    ]

    FORBIDDEN_BUILTINS: list = [
        'eval', 'exec', 'compile', '__import__',
        'open', 'input', 'help', 'globals', 'locals',
        'vars', 'dir', 'getattr', 'setattr', 'delattr'
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

## Data Flow

### 1. Session Creation Flow

```python
User uploads CSV → Parse CSV → Store in MongoDB → Return session ID
                       ↓
                Extract metadata:
                - Column names
                - Data types
                - Row count
                - Sample rows (configurable via settings)
                - Full data (as JSON for MVP)
```

### 2. Query Analysis Flow

```python
User asks question → Retrieve conversation history → Send to LLM with context
                            ↓
                    Context includes:
                    - Data structure
                    - Column names
                    - Data types
                    - Sample rows
                    - Previous Q&A pairs
                    - User question
                            ↓
                    Validate generated code (AST)
                            ↓
                    Execute generated code
                            ↓
                    Return results to LLM
                            ↓
                    LLM interprets results
                            ↓
                    Store in conversation history
                            ↓
                    Send interpretation to user
```

## Technical Implementation

### Data Models

```python
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional
from datetime import datetime

class Session(BaseModel):
    """Represents a data analysis session"""
    id: str
    filename: str
    created_at: datetime
    columns: List[str]
    dtypes: Dict[str, str]  # Column name -> data type
    row_count: int
    column_count: int
    data_sample: List[Dict[str, Any]]  # First N rows (from settings)

    @validator('row_count')
    def validate_dataframe_size(cls, v, values):
        """Ensure dataframe doesn't exceed size limits"""
        if 'column_count' in values:
            total_cells = v * values['column_count']
            if total_cells > settings.MAX_DATAFRAME_SIZE:
                raise ValueError(
                    f"DataFrame too large: {total_cells} cells exceeds "
                    f"limit of {settings.MAX_DATAFRAME_SIZE}"
                )
        return v

class Query(BaseModel):
    """User's question about the data"""
    question: str = Field(..., min_length=1, max_length=1000)

    @validator('question')
    def clean_question(cls, v):
        """Clean and validate question"""
        return v.strip()

class ConversationContext(BaseModel):
    """Previous conversation context"""
    question: str
    code: str
    result_summary: str
    timestamp: datetime

class CodeGeneration(BaseModel):
    """LLM-generated code and explanation"""
    code: str
    explanation: str
    is_valid: bool = False
    validation_message: Optional[str] = None

class ExecutionResult(BaseModel):
    """Result from code execution"""
    success: bool
    output: Optional[Any]
    error: Optional[str]
    execution_time: float
    truncated: bool = False

class AnalysisResponse(BaseModel):
    """Complete response to user"""
    question: str
    generated_code: str
    raw_result: Any
    interpretation: str
    visualization: Optional[str] = None  # Base64 encoded image
    error: Optional[str] = None
    execution_time: float
    conversation_id: str  # Reference to conversation history
```

### OpenAI Client Initialization

```python
# openai_client.py
from openai import AsyncOpenAI
from config import settings

class OpenAIManager:
    """Manages OpenAI API client"""

    _client: Optional[AsyncOpenAI] = None

    @classmethod
    def get_client(cls) -> AsyncOpenAI:
        """Get or create OpenAI client"""
        if cls._client is None:
            cls._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return cls._client

    @classmethod
    async def generate_completion(
        cls,
        messages: List[Dict[str, str]],
        temperature: float = None,
        model: str = None
    ) -> str:
        """Generate completion with error handling"""
        client = cls.get_client()
        model = model or settings.OPENAI_MODEL
        temperature = temperature if temperature is not None else settings.OPENAI_CODE_GENERATION_TEMPERATURE

        try:
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature
            )
            return response.choices[0].message.content
        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")
```

### Enhanced Code Validation with AST

```python
# code_validator.py
import ast
import sys
from typing import Tuple, Set, Optional
from config import settings

class CodeValidator:
    """AST-based code validation for secure execution"""

    def __init__(self):
        self.forbidden_imports = set(settings.FORBIDDEN_IMPORTS)
        self.forbidden_builtins = set(settings.FORBIDDEN_BUILTINS)

    def validate_code(self, code: str) -> Tuple[bool, Optional[str]]:
        """
        Validate code using AST parsing
        Returns: (is_valid, error_message)
        """
        # Check for basic issues
        if not code or not code.strip():
            return False, "Empty code provided"

        if len(code) > 10000:  # Reasonable code length limit
            return False, "Code exceeds maximum length of 10000 characters"

        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return False, f"Syntax error at line {e.lineno}: {e.msg}"

        # Walk through AST and check for forbidden patterns
        validator = ASTSecurityValidator(
            self.forbidden_imports,
            self.forbidden_builtins
        )

        try:
            validator.visit(tree)
        except SecurityError as e:
            return False, str(e)

        # Check for required 'result' variable assignment
        has_result = self._check_result_assignment(tree)
        if not has_result:
            return False, "Code must assign a value to variable 'result'"

        return True, None

    def _check_result_assignment(self, tree: ast.AST) -> bool:
        """Check if code assigns to 'result' variable"""
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == 'result':
                        return True
            elif isinstance(node, ast.AnnAssign):
                if isinstance(node.target, ast.Name) and node.target.id == 'result':
                    return True
        return False

class SecurityError(Exception):
    """Raised when code contains security violations"""
    pass

class ASTSecurityValidator(ast.NodeVisitor):
    """AST visitor to check for security issues"""

    def __init__(self, forbidden_imports: Set[str], forbidden_builtins: Set[str]):
        self.forbidden_imports = forbidden_imports
        self.forbidden_builtins = forbidden_builtins

    def visit_Import(self, node: ast.Import) -> None:
        """Check import statements"""
        for alias in node.names:
            module_name = alias.name.split('.')[0]
            if module_name in self.forbidden_imports:
                raise SecurityError(f"Forbidden import: {alias.name}")
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        """Check from ... import statements"""
        if node.module:
            module_name = node.module.split('.')[0]
            if module_name in self.forbidden_imports:
                raise SecurityError(f"Forbidden import: from {node.module}")
        self.generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        """Check for forbidden built-in functions"""
        if isinstance(node.ctx, ast.Load) and node.id in self.forbidden_builtins:
            raise SecurityError(f"Forbidden built-in function: {node.id}")
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        """Check function calls for dangerous patterns"""
        # Check for getattr/setattr/delattr with string literals
        if isinstance(node.func, ast.Name):
            if node.func.id in ['getattr', 'setattr', 'delattr', 'hasattr']:
                # These can be used to bypass restrictions
                raise SecurityError(f"Forbidden function call: {node.func.id}")

        # Check for string eval patterns like pd.eval()
        if isinstance(node.func, ast.Attribute):
            if node.func.attr in ['eval', 'query']:
                raise SecurityError(f"Forbidden method call: {node.func.attr}")

        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        """Check attribute access for dangerous patterns"""
        # Prevent access to __globals__, __code__, etc.
        if node.attr.startswith('__') and node.attr.endswith('__'):
            if node.attr not in ['__name__', '__doc__', '__class__', '__dict__']:
                raise SecurityError(f"Forbidden dunder attribute: {node.attr}")
        self.generic_visit(node)
```

### Conversation History Management

```python
# conversation_manager.py
from typing import List, Optional, Dict, Any
from datetime import datetime
from config import settings
import json

class ConversationManager:
    """Manage conversation context for better follow-up questions"""

    def __init__(self, db_connection):
        self.db = db_connection

    async def add_interaction(
        self,
        session_id: str,
        question: str,
        code: str,
        result: Any,
        interpretation: str,
        error: Optional[str] = None
    ) -> str:
        """Store interaction in session history"""
        interaction_id = f"{session_id}_{datetime.now().timestamp()}"

        interaction = {
            "id": interaction_id,
            "timestamp": datetime.now(),
            "question": question,
            "code": code,
            "result_summary": self._summarize_result(result),
            "interpretation": interpretation,
            "error": error,
            "full_result": result  # Store full result for reference
        }

        # Update session with new interaction
        await self.db.sessions.update_one(
            {"_id": session_id},
            {
                "$push": {
                    "conversation_history": {
                        "$each": [interaction],
                        "$slice": -settings.MAX_CONVERSATION_HISTORY  # Keep only last N
                    }
                }
            }
        )

        return interaction_id

    async def get_conversation_context(
        self,
        session_id: str,
        lookback: Optional[int] = None
    ) -> List[ConversationContext]:
        """Get relevant context from previous interactions"""
        lookback = lookback or settings.CONTEXT_LOOKBACK

        session = await self.db.sessions.find_one({"_id": session_id})
        if not session or 'conversation_history' not in session:
            return []

        history = session['conversation_history']
        recent_interactions = history[-lookback:] if len(history) > lookback else history

        context = []
        for interaction in recent_interactions:
            context.append(ConversationContext(
                question=interaction['question'],
                code=interaction['code'],
                result_summary=interaction['result_summary'],
                timestamp=interaction['timestamp']
            ))

        return context

    def _summarize_result(self, result: Any) -> str:
        """Create concise summary of result for context"""
        if result is None:
            return "No result"

        if isinstance(result, dict):
            if result.get('type') == 'dataframe':
                shape = result.get('shape', [0, 0])
                return f"DataFrame with {shape[0]} rows and {shape[1]} columns"
            elif result.get('type') == 'series':
                return f"Series with {len(result.get('data', {}))} values"
            else:
                return f"Dictionary with {len(result)} keys"

        elif isinstance(result, (list, tuple)):
            return f"List with {len(result)} items"

        elif isinstance(result, (int, float)):
            return f"Numeric value: {result}"

        elif isinstance(result, str):
            if len(result) > 100:
                return f"String (length: {len(result)}): {result[:100]}..."
            return f"String: {result}"

        else:
            return f"Result of type: {type(result).__name__}"

    def format_context_for_prompt(self, context: List[ConversationContext]) -> str:
        """Format conversation context for inclusion in LLM prompt"""
        if not context:
            return ""

        formatted = "Previous conversation context:\n"
        for i, ctx in enumerate(context, 1):
            formatted += f"\n{i}. Question: {ctx.question}\n"
            formatted += f"   Generated code snippet: {ctx.code[:200]}...\n" if len(ctx.code) > 200 else f"   Generated code: {ctx.code}\n"
            formatted += f"   Result: {ctx.result_summary}\n"

        formatted += "\nConsider this context when generating new code.\n"
        return formatted
```

### Session Creation Endpoint with Validation

```python
@app.post("/api/session/create")
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
        # Validate CSV structure with initial read
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
        db = get_database()  # Assuming this is defined elsewhere as mentioned
        await db.sessions.insert_one(session_data)

        return {
            "session_id": session_id,
            "message": f"Successfully uploaded {file.filename}",
            "data_info": {
                "rows": session_data["row_count"],
                "columns": session_data["column_count"],
                "column_names": session_data["columns"],
                "data_types": session_data["dtypes"],
                "numeric_columns": session_data["numeric_columns"],
                "categorical_columns": session_data["categorical_columns"],
                "null_counts": session_data["null_counts"],
                "sample": session_data["data_sample"]
            }
        }

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
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}"
        )
```

### Enhanced Code Generation with Context

```python
def create_code_generation_prompt(
    df_info: dict,
    question: str,
    context: Optional[List[ConversationContext]] = None
) -> str:
    """
    Create prompt for LLM to generate pandas code with conversation context
    """
    prompt = f"""You are a data analyst writing Python code to analyze data.

You have a pandas DataFrame called 'df' with the following structure:

Shape: {df_info['row_count']} rows × {df_info['column_count']} columns

Columns and types:
{format_column_info(df_info['columns'], df_info['dtypes'])}

Numeric columns: {', '.join(df_info.get('numeric_columns', []))}
Categorical columns: {', '.join(df_info.get('categorical_columns', []))}

First {len(df_info['data_sample'])} rows of data:
{format_sample_data(df_info['data_sample'])}

Null value counts per column:
{format_null_counts(df_info.get('null_counts', {}))}
"""

    # Add conversation context if available
    if context:
        conv_manager = ConversationManager(None)  # Just for formatting
        prompt += "\n" + conv_manager.format_context_for_prompt(context)

    prompt += f"""
Current question: {question}

Generate Python code that:
1. Uses the existing 'df' DataFrame (already loaded)
2. Answers the user's question
3. MUST store the final answer in a variable called 'result'
4. Uses pandas operations efficiently
5. Handles potential errors gracefully (check for column existence, handle NaN values)
6. Considers the context from previous questions if relevant

Important:
- The code MUST assign the final answer to a variable named 'result'
- Handle edge cases like missing columns or null values
- Use vectorized pandas operations when possible
- Do not use any imports (pandas is already imported as pd, numpy as np)

Return ONLY executable Python code, no explanations or markdown.
"""
    return prompt

def format_column_info(columns: list, dtypes: dict) -> str:
    """Format column information for prompt"""
    return "\n".join([f"- {col}: {dtypes[col]}" for col in columns])

def format_sample_data(sample: list) -> str:
    """Format sample data as readable table"""
    if not sample:
        return "No data available"
    df_sample = pd.DataFrame(sample)
    return df_sample.to_string()

def format_null_counts(null_counts: dict) -> str:
    """Format null counts for prompt"""
    if not null_counts:
        return "No null values"
    return "\n".join([f"- {col}: {count} null values" for col, count in null_counts.items() if count > 0])
```

### Analysis Endpoint with Full Integration

````python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import io
import base64
from contextlib import redirect_stdout
import traceback
import asyncio
from concurrent.futures import ThreadPoolExecutor
import time

# Create executor for running potentially blocking code
executor = ThreadPoolExecutor(max_workers=2)

@app.post("/api/session/{session_id}/analyze")
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
                    "content": "You are a data analyst. Generate only executable Python code."
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
        raise HTTPException(
            status_code=500,
            detail=f"Error generating code: {str(e)}"
        )

    # 5. Validate generated code
    validator = CodeValidator()
    is_valid, validation_message = validator.validate_code(generated_code)

    if not is_valid:
        # Try to regenerate with more specific instructions
        retry_prompt = code_prompt + f"\n\nPrevious attempt failed validation: {validation_message}\nPlease generate corrected code."

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
                raise HTTPException(
                    status_code=400,
                    detail=f"Generated code failed validation: {validation_message}"
                )
        except HTTPException:
            raise
        except Exception as e:
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

def clean_code_response(code: str) -> str:
    """Remove markdown formatting if present"""
    code = code.strip()

    # Remove markdown code blocks
    if code.startswith("```python"):
        code = code[9:]
    elif code.startswith("```"):
        code = code[3:]

    if code.endswith("```"):
        code = code[:-3]

    return code.strip()

async def execute_code_safely(
    df: pd.DataFrame,
    code: str,
    timeout: Optional[int] = None
) -> Dict[str, Any]:
    """
    Execute generated code in a restricted environment with comprehensive error handling
    """
    timeout = timeout or settings.MAX_EXECUTION_TIMEOUT
    start_time = time.time()

    # Validate code before execution (double-check)
    validator = CodeValidator()
    is_valid, validation_message = validator.validate_code(code)

    if not is_valid:
        return {
            'success': False,
            'output': None,
            'error': f"Code validation failed: {validation_message}",
            'execution_time': 0,
            'truncated': False
        }

    # Create restricted namespace
    namespace = {
        'df': df.copy(),  # Use copy to prevent modifications to original
        'pd': pd,
        'np': np,
        'plt': plt,
        'datetime': datetime,
        'result': None,
        # Explicitly do not include: os, sys, subprocess, open, requests, etc.
    }

    # Capture output
    output_buffer = io.StringIO()

    try:
        # Run in executor with timeout
        loop = asyncio.get_event_loop()

        def run_code():
            try:
                with redirect_stdout(output_buffer):
                    exec(code, namespace)
                return namespace.get('result', output_buffer.getvalue())
            except Exception as e:
                # Capture any execution errors
                raise Exception(f"Execution error: {str(e)}")

        future = loop.run_in_executor(executor, run_code)

        try:
            result = await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            return {
                'success': False,
                'output': None,
                'error': f"Code execution timed out after {timeout} seconds. The operation may be too complex.",
                'execution_time': timeout,
                'truncated': False
            }

        execution_time = time.time() - start_time

        # Format and potentially truncate result
        formatted_result, truncated = format_and_truncate_result(result)

        return {
            'success': True,
            'output': formatted_result,
            'error': None,
            'execution_time': execution_time,
            'truncated': truncated
        }

    except Exception as e:
        execution_time = time.time() - start_time
        error_message = str(e)

        # Clean up error messages for user-friendly display
        if "name" in error_message and "is not defined" in error_message:
            error_message = f"Variable or function not found: {error_message}"
        elif "KeyError" in error_message:
            error_message = f"Column not found in DataFrame: {error_message}"
        elif "TypeError" in error_message:
            error_message = f"Type error in operation: {error_message}"
        elif "ValueError" in error_message:
            error_message = f"Invalid value or operation: {error_message}"

        return {
            'success': False,
            'output': None,
            'error': error_message,
            'execution_time': execution_time,
            'truncated': False
        }

def format_and_truncate_result(result: Any) -> Tuple[Any, bool]:
    """
    Format execution result for JSON serialization and truncate if needed
    Returns: (formatted_result, was_truncated)
    """
    truncated = False

    if isinstance(result, pd.DataFrame):
        if len(result) > settings.MAX_SAMPLE_ROWS:
            truncated = True
            display_df = result.head(settings.MAX_SAMPLE_ROWS)
        else:
            display_df = result

        return {
            'type': 'dataframe',
            'data': display_df.to_dict('records'),
            'shape': result.shape,
            'truncated': truncated,
            'total_rows': len(result)
        }, truncated

    elif isinstance(result, pd.Series):
        if len(result) > settings.MAX_SAMPLE_ROWS:
            truncated = True
            display_series = result.head(settings.MAX_SAMPLE_ROWS)
        else:
            display_series = result

        return {
            'type': 'series',
            'data': display_series.to_dict(),
            'length': len(result),
            'truncated': truncated
        }, truncated

    elif isinstance(result, (np.ndarray, np.generic)):
        result_list = result.tolist()
        if isinstance(result_list, list) and len(str(result_list)) > settings.MAX_OUTPUT_SIZE:
            truncated = True
            # Truncate array representation
            return {
                'type': 'array',
                'shape': result.shape if hasattr(result, 'shape') else len(result),
                'data': str(result_list)[:settings.MAX_OUTPUT_SIZE] + '...',
                'truncated': truncated
            }, truncated

        return {
            'type': 'array',
            'data': result_list,
            'shape': result.shape if hasattr(result, 'shape') else None
        }, truncated

    elif isinstance(result, str):
        if len(result) > settings.MAX_OUTPUT_SIZE:
            truncated = True
            return result[:settings.MAX_OUTPUT_SIZE] + '...', truncated
        return result, truncated

    elif isinstance(result, (int, float, bool)):
        return result, truncated

    elif isinstance(result, (list, dict)):
        result_str = str(result)
        if len(result_str) > settings.MAX_OUTPUT_SIZE:
            truncated = True
            return {
                'type': type(result).__name__,
                'data': result_str[:settings.MAX_OUTPUT_SIZE] + '...',
                'truncated': truncated
            }, truncated
        return result, truncated

    else:
        # For unknown types, convert to string
        result_str = str(result)
        if len(result_str) > settings.MAX_OUTPUT_SIZE:
            truncated = True
            return result_str[:settings.MAX_OUTPUT_SIZE] + '...', truncated
        return result_str, truncated

async def interpret_results(
    question: str,
    code: str,
    result: Any,
    openai_manager: OpenAIManager
) -> str:
    """
    Ask LLM to interpret the execution results
    """
    # Format result for interpretation
    result_description = format_result_for_interpretation(result)

    interpretation_prompt = f"""
The user asked: {question}

You generated and ran this code:
```python
{code}
````

The result was:
{result_description}

Provide a clear, concise interpretation of these results in 2-3 sentences.
Focus on answering the user's original question directly.
If the result was truncated, mention that only a sample is shown.
Use business-friendly language and avoid technical jargon.
"""

    try:
        interpretation = await openai_manager.generate_completion(
            messages=[
                {
                    "role": "system",
                    "content": "You are a data analyst explaining results to a business user. Be concise and clear."
                },
                {
                    "role": "user",
                    "content": interpretation_prompt
                }
            ],
            temperature=settings.OPENAI_INTERPRETATION_TEMPERATURE
        )

        return interpretation

    except Exception as e:
        # Fallback to basic interpretation
        if isinstance(result, dict) and result.get('type') == 'dataframe':
            return f"Analysis completed successfully. The result is a table with {result['shape'][0]} rows and {result['shape'][1]} columns."
        elif isinstance(result, (int, float)):
            return f"The calculated result is: {result}"
        else:
            return "Analysis completed successfully. The results are shown above."

def format_result_for_interpretation(result: Any) -> str:
"""Format result for LLM interpretation with size limits"""
if isinstance(result, dict):
if result.get('type') == 'dataframe':
df_preview = pd.DataFrame(result['data']).head(5)
preview_str = df_preview.to_string()

            if result.get('truncated'):
                return f"DataFrame with shape {result['shape']} (showing first {len(result['data'])} rows):\n{preview_str}"
            else:
                return f"DataFrame with shape {result['shape']}:\n{preview_str}"

        elif result.get('type') == 'series':
            series_data = result['data']
            if len(series_data) > 10:
                preview_items = dict(list(series_data.items())[:10])
                return f"Series with {result.get('length', len(series_data))} values (showing first 10):\n{preview_items}"
            return f"Series:\n{series_data}"

        elif result.get('type') == 'array':
            return f"Array with shape {result.get('shape', 'unknown')}"

    result_str = str(result)
    if len(result_str) > 1000:
        return result_str[:1000] + "... (truncated)"
    return result_str

```

## Conversation Flow Examples

### Example 1: Basic Aggregation with Context

**User**: "What's the total revenue by category?"

**System Context to LLM**:
```

DataFrame 'df' with 1000 rows × 4 columns
Columns: ['date', 'category', 'product', 'revenue']
Sample data: [shows 5 rows]
No previous conversation context.

````

**LLM Generated Code**:
```python
# Check if required columns exist
if 'category' not in df.columns or 'revenue' not in df.columns:
    result = "Error: Required columns 'category' or 'revenue' not found"
else:
    # Calculate total revenue by category
    result = df.groupby('category')['revenue'].sum().sort_values(ascending=False)
````

**Execution Result**:

```python
Electronics    45678.99
Furniture      23456.78
Clothing       12345.67
```

**LLM Interpretation**:
"Electronics generates the highest revenue at $45,678.99, followed by Furniture at $23,456.78 and Clothing at $12,345.67. Electronics accounts for the majority of total revenue."

### Example 2: Follow-up Question with Context

**User**: "Now show me the average order value for Electronics"

**System Context to LLM**:

```
Previous conversation context:
1. Question: What's the total revenue by category?
   Generated code snippet: df.groupby('category')['revenue'].sum()...
   Result: Series with 3 values

Current question: Now show me the average order value for Electronics
```

**LLM Generated Code**:

```python
# Filter for Electronics category based on previous analysis
electronics_df = df[df['category'] == 'Electronics']

if electronics_df.empty:
    result = "No data found for Electronics category"
else:
    # Calculate average order value (revenue per transaction)
    result = electronics_df['revenue'].mean()
```

### Example 3: Error Handling

**User**: "Calculate the correlation between price and quantity"

**LLM Generated Code**:

```python
# Check if columns exist
required_cols = ['price', 'quantity']
missing_cols = [col for col in required_cols if col not in df.columns]

if missing_cols:
    available_cols = df.columns.tolist()
    result = f"Missing columns: {missing_cols}. Available columns: {available_cols}"
else:
    # Remove null values before correlation
    clean_df = df[['price', 'quantity']].dropna()

    if len(clean_df) < 2:
        result = "Not enough data points for correlation calculation"
    else:
        result = clean_df['price'].corr(clean_df['quantity'])
```

## Security Considerations

### 1. Code Execution Sandbox

The system uses AST-based validation before execution and a restricted namespace during execution:

- **Pre-execution validation**: AST parsing to detect forbidden imports and dangerous patterns
- **Restricted namespace**: Only safe libraries (pandas, numpy) available
- **No file system access**: No open(), os, or sys modules
- **No network access**: No requests, urllib, or socket modules
- **No subprocess execution**: No subprocess or os.system calls

### 2. Resource Limits

All limits are configurable via environment variables:

- **Execution timeout**: Default 5 seconds (MAX_EXECUTION_TIMEOUT)
- **DataFrame size limit**: 100M cells (MAX_DATAFRAME_SIZE)
- **Output size limit**: 10,000 characters (MAX_OUTPUT_SIZE)
- **Upload size limit**: 100MB (MAX_UPLOAD_SIZE)

### 3. Input Validation

Comprehensive validation at multiple levels:

- **File upload validation**: Type, size, and structure checks
- **Code validation**: AST-based security analysis
- **Query validation**: Length and content restrictions
- **DataFrame validation**: Size and structure checks

## Testing Strategy

```python
import pytest
from unittest.mock import Mock, patch, AsyncMock

@pytest.mark.asyncio
async def test_code_validation():
    """Test that code validator catches dangerous patterns"""
    validator = CodeValidator()

    # Test valid code
    valid_code = "result = df['column'].mean()"
    is_valid, error = validator.validate_code(valid_code)
    assert is_valid is True
    assert error is None

    # Test forbidden import
    dangerous_code = "import os\nresult = os.listdir()"
    is_valid, error = validator.validate_code(dangerous_code)
    assert is_valid is False
    assert "Forbidden import" in error

    # Test forbidden builtin
    dangerous_code = "result = eval('1+1')"
    is_valid, error = validator.validate_code(dangerous_code)
    assert is_valid is False
    assert "Forbidden built-in" in error

    # Test missing result assignment
    invalid_code = "df['column'].mean()"
    is_valid, error = validator.validate_code(invalid_code)
    assert is_valid is False
    assert "must assign a value to variable 'result'" in error

@pytest.mark.asyncio
async def test_conversation_context():
    """Test conversation history management"""
    mock_db = Mock()
    mock_db.sessions.update_one = AsyncMock()
    mock_db.sessions.find_one = AsyncMock(return_value={
        "_id": "test_session",
        "conversation_history": [
            {
                "question": "Previous question",
                "code": "result = df.head()",
                "result_summary": "DataFrame with 5 rows",
                "timestamp": datetime.now()
            }
        ]
    })

    conv_manager = ConversationManager(mock_db)

    # Test getting context
    context = await conv_manager.get_conversation_context("test_session")
    assert len(context) == 1
    assert context[0].question == "Previous question"

    # Test adding interaction
    interaction_id = await conv_manager.add_interaction(
        session_id="test_session",
        question="New question",
        code="result = df.tail()",
        result={"type": "dataframe", "shape": [5, 3]},
        interpretation="Shows last 5 rows"
    )

    assert interaction_id.startswith("test_session_")
    mock_db.sessions.update_one.assert_called_once()

@pytest.mark.asyncio
async def test_safe_execution():
    """Test that code execution properly sandboxes dangerous code"""
    df = pd.DataFrame({'col1': [1, 2, 3]})

    # Test successful execution
    safe_code = "result = df['col1'].sum()"
    result = await execute_code_safely(df, safe_code)
    assert result['success'] is True
    assert result['output'] == 6

    # Test timeout
    infinite_code = "while True: pass\nresult = 1"
    result = await execute_code_safely(df, infinite_code, timeout=1)
    assert result['success'] is False
    assert "timed out" in result['error']

    # Test error handling
    error_code = "result = df['nonexistent'].mean()"
    result = await execute_code_safely(df, error_code)
    assert result['success'] is False
    assert "Column not found" in result['error'] or "KeyError" in result['error']
```

## Conclusion

This revised architecture provides a scalable, efficient, and secure way to perform LLM-powered data analysis with the following improvements:

### Key Enhancements Made:

1. **Comprehensive Configuration Management**: All hardcoded values moved to settings with environment variable support
2. **AST-based Code Validation**: Robust security validation using Python's AST module
3. **Integrated Conversation History**: Full conversation context management with proper database integration
4. **Enhanced Error Handling**: Multiple levels of validation and user-friendly error messages
5. **OpenAI Client Management**: Proper client initialization and error handling
6. **Input Validation**: Comprehensive validation for file uploads and user queries
7. **Result Truncation**: Smart truncation of large results to manage token usage

### Architecture Advantages:

- **Efficiency**: Only data structure sent to LLM, not entire datasets
- **Accuracy**: Calculations done by pandas, not LLM
- **Transparency**: Users see the actual code being executed
- **Scalability**: Can handle datasets within MongoDB limits (file-based storage can be added later)
- **Security**: Multiple layers of validation and sandboxed execution
- **Context-Aware**: Maintains conversation history for better follow-up responses

The system is now ready for MVP implementation with production-ready error handling, security measures, and conversation management.
