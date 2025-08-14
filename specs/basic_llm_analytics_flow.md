# Basic LLM Analytics Flow

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

## Data Flow

### 1. Session Creation Flow

```python
User uploads CSV → Parse CSV → Store in MongoDB → Return session ID
                       ↓
                Extract metadata:
                - Column names
                - Data types
                - Row count
                - Sample rows (first 5)
                - Full data (as JSON)
```

### 2. Query Analysis Flow

```python
User asks question → Send to LLM with context → LLM generates code
                            ↓
                    Context includes:
                    - Data structure
                    - Column names
                    - Data types
                    - Sample rows
                    - User question
                            ↓
                    Execute generated code
                            ↓
                    Return results to LLM
                            ↓
                    LLM interprets results
                            ↓
                    Send interpretation to user
```

## Technical Implementation

### Data Models

```python
from pydantic import BaseModel
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
    data_sample: List[Dict[str, Any]]  # First 5 rows

class Query(BaseModel):
    """User's question about the data"""
    question: str

class CodeGeneration(BaseModel):
    """LLM-generated code and explanation"""
    code: str
    explanation: str

class ExecutionResult(BaseModel):
    """Result from code execution"""
    success: bool
    output: Optional[Any]
    error: Optional[str]
    execution_time: float

class AnalysisResponse(BaseModel):
    """Complete response to user"""
    question: str
    generated_code: str
    raw_result: Any
    interpretation: str
    visualization: Optional[str]  # Base64 encoded image
    error: Optional[str]
```

### Session Creation Endpoint

```python
@app.post("/api/session/create")
async def create_session(file: UploadFile = File(...)):
    """
    Create analysis session from uploaded CSV
    """
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files supported")

    try:
        # Read CSV
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))

        # Extract metadata
        session_id = str(uuid.uuid4())
        session_data = {
            "_id": session_id,
            "filename": file.filename,
            "created_at": datetime.now(),
            "columns": df.columns.tolist(),
            "dtypes": df.dtypes.astype(str).to_dict(),
            "row_count": len(df),
            "column_count": len(df.columns),
            "data_sample": df.head(5).to_dict('records'),
            "full_data": df.to_dict('records'),  # Store for execution
            "queries": []  # Track conversation history
        }

        # Store in MongoDB
        db = get_database()
        await db.sessions.insert_one(session_data)

        return {
            "session_id": session_id,
            "message": f"Successfully uploaded {file.filename}",
            "data_info": {
                "rows": session_data["row_count"],
                "columns": session_data["column_count"],
                "column_names": session_data["columns"],
                "sample": session_data["data_sample"]
            }
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing CSV: {str(e)}")
```

### Code Generation Prompt Template

```python
def create_code_generation_prompt(df_info: dict, question: str) -> str:
    """
    Create prompt for LLM to generate pandas code
    """
    return f"""You are a data analyst writing Python code to analyze data.

You have a pandas DataFrame called 'df' with the following structure:

Shape: {df_info['row_count']} rows × {df_info['column_count']} columns

Columns and types:
{format_column_info(df_info['columns'], df_info['dtypes'])}

First 3 rows of data:
{format_sample_data(df_info['data_sample'][:3])}

User question: {question}

Generate Python code that:
1. Uses the existing 'df' DataFrame (already loaded)
2. Answers the user's question
3. Stores the final answer in a variable called 'result'
4. Uses pandas operations efficiently
5. Handles potential errors gracefully

Return ONLY executable Python code, no explanations or markdown.
"""

def format_column_info(columns: list, dtypes: dict) -> str:
    """Format column information for prompt"""
    return "\n".join([f"- {col}: {dtypes[col]}" for col in columns])

def format_sample_data(sample: list) -> str:
    """Format sample data as readable table"""
    if not sample:
        return "No data available"
    df_sample = pd.DataFrame(sample)
    return df_sample.to_string()
```

### Analysis Endpoint with Code Execution

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

# Create executor for running potentially blocking code
executor = ThreadPoolExecutor(max_workers=2)

@app.post("/api/session/{session_id}/analyze")
async def analyze_data(session_id: str, query: Query):
    """
    Analyze data by generating and executing Python code
    """
    # 1. Retrieve session
    db = get_database()
    session = await db.sessions.find_one({"_id": session_id})

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 2. Load data into DataFrame
    df = pd.DataFrame(session['full_data'])

    # 3. Generate code using LLM
    code_prompt = create_code_generation_prompt(
        df_info={
            'row_count': session['row_count'],
            'column_count': session['column_count'],
            'columns': session['columns'],
            'dtypes': session['dtypes'],
            'data_sample': session['data_sample']
        },
        question=query.question
    )

    try:
        # Call OpenAI API
        openai_response = await openai.chat.completions.create(
            model="gpt-4",
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
            temperature=0.1  # Lower temperature for more consistent code
        )

        generated_code = openai_response.choices[0].message.content
        generated_code = clean_code_response(generated_code)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating code: {str(e)}")

    # 4. Execute generated code
    execution_result = await execute_code_safely(df, generated_code)

    # 5. Interpret results
    if execution_result['success']:
        interpretation = await interpret_results(
            question=query.question,
            code=generated_code,
            result=execution_result['output']
        )
    else:
        interpretation = f"The analysis failed with error: {execution_result['error']}"

    # 6. Store query in session history
    query_record = {
        "timestamp": datetime.now(),
        "question": query.question,
        "generated_code": generated_code,
        "execution_success": execution_result['success'],
        "result": str(execution_result['output']) if execution_result['success'] else None,
        "error": execution_result['error'],
        "interpretation": interpretation
    }

    await db.sessions.update_one(
        {"_id": session_id},
        {"$push": {"queries": query_record}}
    )

    # 7. Return response
    return {
        "question": query.question,
        "code": generated_code,
        "result": execution_result['output'] if execution_result['success'] else None,
        "interpretation": interpretation,
        "error": execution_result['error'],
        "execution_time": execution_result['execution_time']
    }

def clean_code_response(code: str) -> str:
    """Remove markdown formatting if present"""
    code = code.strip()
    if code.startswith("```python"):
        code = code[9:]
    if code.startswith("```"):
        code = code[3:]
    if code.endswith("```"):
        code = code[:-3]
    return code.strip()

async def execute_code_safely(df: pd.DataFrame, code: str, timeout: int = 5):
    """
    Execute generated code in a restricted environment
    """
    import time
    start_time = time.time()

    # Create restricted namespace
    namespace = {
        'df': df.copy(),  # Use copy to prevent modifications
        'pd': pd,
        'np': np,
        'plt': plt,
        'result': None,
        # Don't include: os, subprocess, open, requests, etc.
    }

    # Capture output
    output_buffer = io.StringIO()

    try:
        # Run in executor with timeout
        loop = asyncio.get_event_loop()

        def run_code():
            with redirect_stdout(output_buffer):
                exec(code, namespace)
            return namespace.get('result', output_buffer.getvalue())

        future = loop.run_in_executor(executor, run_code)
        result = await asyncio.wait_for(future, timeout=timeout)

        execution_time = time.time() - start_time

        return {
            'success': True,
            'output': format_result(result),
            'error': None,
            'execution_time': execution_time
        }

    except asyncio.TimeoutError:
        return {
            'success': False,
            'output': None,
            'error': f"Code execution timed out after {timeout} seconds",
            'execution_time': timeout
        }
    except Exception as e:
        return {
            'success': False,
            'output': None,
            'error': f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}",
            'execution_time': time.time() - start_time
        }

def format_result(result: Any) -> Any:
    """Format execution result for JSON serialization"""
    if isinstance(result, pd.DataFrame):
        return {
            'type': 'dataframe',
            'data': result.to_dict('records'),
            'shape': result.shape
        }
    elif isinstance(result, pd.Series):
        return {
            'type': 'series',
            'data': result.to_dict()
        }
    elif isinstance(result, (np.ndarray, np.generic)):
        return {
            'type': 'array',
            'data': result.tolist()
        }
    elif isinstance(result, (int, float, str, bool, list, dict)):
        return result
    else:
        return str(result)

async def interpret_results(question: str, code: str, result: Any) -> str:
    """
    Ask LLM to interpret the execution results
    """
    interpretation_prompt = f"""
    The user asked: {question}

    You generated and ran this code:
    ```python
    {code}
    ```

    The result was:
    {format_result_for_interpretation(result)}

    Provide a clear, concise interpretation of these results in 2-3 sentences.
    Focus on answering the user's original question directly.
    """

    try:
        response = await openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": "You are a data analyst explaining results to a business user."
                },
                {
                    "role": "user",
                    "content": interpretation_prompt
                }
            ],
            temperature=0.3
        )

        return response.choices[0].message.content

    except Exception as e:
        return f"Results computed successfully: {result}"

def format_result_for_interpretation(result: Any) -> str:
    """Format result for LLM interpretation"""
    if isinstance(result, dict):
        if result.get('type') == 'dataframe':
            return f"DataFrame with shape {result['shape']}:\n{pd.DataFrame(result['data']).head(10).to_string()}"
        elif result.get('type') == 'series':
            return f"Series:\n{result['data']}"
    return str(result)[:1000]  # Limit length for token management
````

## Conversation Flow Examples

### Example 1: Basic Aggregation

**User**: "What's the total revenue by category?"

**System Context to LLM**:

```
DataFrame 'df' with 1000 rows × 4 columns
Columns: ['date', 'category', 'product', 'revenue']
Sample data: [shows 3 rows]
```

**LLM Generated Code**:

```python
result = df.groupby('category')['revenue'].sum().sort_values(ascending=False)
```

**Execution Result**:

```python
Electronics    45678.99
Furniture      23456.78
Clothing       12345.67
```

**LLM Interpretation**:
"Electronics generates the highest revenue at $45,678.99, followed by Furniture at $23,456.78 and Clothing at $12,345.67. Electronics accounts for over 55% of total revenue."

### Example 2: Complex Analysis

**User**: "Show me the monthly revenue trend and identify the best performing month"

**LLM Generated Code**:

```python
# Convert date to datetime
df['date'] = pd.to_datetime(df['date'])

# Extract month and year
df['month_year'] = df['date'].dt.to_period('M')

# Calculate monthly revenue
monthly_revenue = df.groupby('month_year')['revenue'].sum().reset_index()
monthly_revenue.columns = ['month', 'total_revenue']

# Find best month
best_month = monthly_revenue.loc[monthly_revenue['total_revenue'].idxmax()]

result = {
    'monthly_trend': monthly_revenue.to_dict('records'),
    'best_month': str(best_month['month']),
    'best_month_revenue': float(best_month['total_revenue'])
}
```

### Example 3: Error Handling

**User**: "Calculate the correlation between price and quantity"

**LLM Generated Code**:

```python
# Check if columns exist
required_cols = ['price', 'quantity']
missing_cols = [col for col in required_cols if col not in df.columns]

if missing_cols:
    result = f"Error: Missing columns {missing_cols}. Available columns: {df.columns.tolist()}"
else:
    result = df['price'].corr(df['quantity'])
```

## Security Considerations

### 1. Code Execution Sandbox

```python
# Restricted namespace - only safe libraries
ALLOWED_MODULES = {
    'pd': pd,
    'np': np,
    'datetime': datetime,
    'math': math,
    'statistics': statistics
}

# Forbidden operations
FORBIDDEN_IMPORTS = [
    'os', 'sys', 'subprocess', 'eval', 'exec',
    'open', 'file', '__import__', 'compile'
]
```

### 2. Resource Limits

```python
# Timeout for code execution
MAX_EXECUTION_TIME = 5  # seconds

# Memory limit
MAX_DATAFRAME_SIZE = 100_000_000  # cells (rows × columns)

# Output size limit
MAX_OUTPUT_SIZE = 10_000  # characters
```

### 3. Input Validation

```python
def validate_code(code: str) -> bool:
    """Check for dangerous patterns"""
    dangerous_patterns = [
        'import os',
        'import sys',
        'import subprocess',
        '__import__',
        'eval(',
        'exec(',
        'open(',
        'file(',
        '.read(',
        '.write('
    ]

    code_lower = code.lower()
    for pattern in dangerous_patterns:
        if pattern in code_lower:
            return False
    return True
```

## Token Optimization Strategies

### 1. Smart Context Selection

```python
def create_minimal_context(df: pd.DataFrame, question: str) -> dict:
    """Create minimal context based on question type"""

    context = {
        'shape': df.shape,
        'columns': df.columns.tolist()
    }

    # Determine what's needed based on question
    question_lower = question.lower()

    if any(word in question_lower for word in ['average', 'mean', 'sum', 'total']):
        # Only need numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        context['relevant_columns'] = numeric_cols
        context['sample'] = df[numeric_cols].head(2).to_dict('records')

    elif 'correlation' in question_lower:
        # Need numeric columns and basic stats
        numeric_df = df.select_dtypes(include=[np.number])
        context['numeric_columns'] = numeric_df.columns.tolist()
        context['stats'] = numeric_df.describe().to_dict()

    else:
        # Default: send minimal sample
        context['sample'] = df.head(3).to_dict('records')

    return context
```

### 2. Result Truncation

```python
def truncate_result(result: Any, max_size: int = 1000) -> Any:
    """Truncate large results for token efficiency"""

    if isinstance(result, pd.DataFrame):
        if len(result) > 10:
            return {
                'preview': result.head(10).to_dict('records'),
                'total_rows': len(result),
                'message': f'Showing first 10 of {len(result)} rows'
            }

    elif isinstance(result, str) and len(result) > max_size:
        return result[:max_size] + f'... (truncated, {len(result)} total chars)'

    return result
```

## Conversation History Management

```python
class ConversationManager:
    """Manage conversation context for better follow-up questions"""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.history = []

    async def add_interaction(self, question: str, code: str, result: Any):
        """Store interaction in history"""
        self.history.append({
            'question': question,
            'code': code,
            'result': summarize_result(result),
            'timestamp': datetime.now()
        })

        # Keep only last 10 interactions for context
        if len(self.history) > 10:
            self.history.pop(0)

    def get_context_for_followup(self) -> str:
        """Get relevant context for follow-up questions"""
        if not self.history:
            return ""

        recent = self.history[-3:]  # Last 3 interactions
        context = "Previous questions and answers:\n"

        for item in recent:
            context += f"Q: {item['question']}\n"
            context += f"Result: {item['result']}\n\n"

        return context
```

## Performance Optimizations

### 1. Caching Frequently Used Computations

```python
from functools import lru_cache
import hashlib

class ComputationCache:
    def __init__(self):
        self.cache = {}

    def get_cache_key(self, code: str, df_hash: str) -> str:
        """Generate cache key from code and data"""
        return hashlib.md5(f"{code}{df_hash}".encode()).hexdigest()

    def get(self, code: str, df_hash: str) -> Optional[Any]:
        """Retrieve cached result"""
        key = self.get_cache_key(code, df_hash)
        return self.cache.get(key)

    def set(self, code: str, df_hash: str, result: Any):
        """Cache computation result"""
        key = self.get_cache_key(code, df_hash)
        self.cache[key] = result

        # Limit cache size
        if len(self.cache) > 100:
            # Remove oldest entry
            oldest = next(iter(self.cache))
            del self.cache[oldest]
```

### 2. Parallel Processing for Multiple Queries

```python
async def batch_analyze(session_id: str, queries: List[Query]):
    """Process multiple queries in parallel"""

    tasks = []
    for query in queries:
        task = analyze_data(session_id, query)
        tasks.append(task)

    results = await asyncio.gather(*tasks, return_exceptions=True)

    return [
        result if not isinstance(result, Exception)
        else {"error": str(result)}
        for result in results
    ]
```

## Error Recovery Strategies

```python
async def analyze_with_retry(session_id: str, query: Query, max_retries: int = 3):
    """Retry analysis with improved prompts on failure"""

    for attempt in range(max_retries):
        try:
            result = await analyze_data(session_id, query)

            if result.get('error'):
                # Enhance prompt and retry
                enhanced_query = Query(
                    question=f"{query.question}. Please ensure the code handles missing columns and null values."
                )
                result = await analyze_data(session_id, enhanced_query)

            return result

        except Exception as e:
            if attempt == max_retries - 1:
                raise

            # Wait before retry
            await asyncio.sleep(2 ** attempt)

    return {"error": "Analysis failed after multiple attempts"}
```

## Future Enhancements

1. **Visualization Support**

   - Generate matplotlib/plotly code
   - Return base64 encoded images
   - Interactive charts with Plotly

2. **Multi-file Analysis**

   - Join operations across files
   - Relationship detection
   - Automated data profiling

3. **Query Optimization**

   - Learn from usage patterns
   - Suggest optimized queries
   - Pre-compute common aggregations

4. **Advanced Features**

   - Statistical testing
   - Machine learning predictions
   - Anomaly detection
   - Time series forecasting

5. **Export Capabilities**
   - Download generated code
   - Export results to Excel
   - Create automated reports

## Testing Strategy

```python
import pytest
from unittest.mock import Mock, patch

@pytest.mark.asyncio
async def test_code_generation():
    """Test that LLM generates valid Python code"""

    mock_session = {
        'columns': ['date', 'amount'],
        'dtypes': {'date': 'object', 'amount': 'float64'},
        'row_count': 100,
        'column_count': 2,
        'data_sample': [
            {'date': '2024-01-01', 'amount': 100.0},
            {'date': '2024-01-02', 'amount': 150.0}
        ]
    }

    question = "What is the total amount?"

    with patch('openai.chat.completions.create') as mock_openai:
        mock_openai.return_value.choices[0].message.content = "result = df['amount'].sum()"

        code = await generate_code(mock_session, question)

        assert 'result' in code
        assert 'sum()' in code
        assert 'df' in code

@pytest.mark.asyncio
async def test_safe_execution():
    """Test that dangerous code is blocked"""

    dangerous_code = "import os; os.system('rm -rf /')"

    result = await execute_code_safely(pd.DataFrame(), dangerous_code)

    assert not result['success']
    assert 'error' in result
```

## Conclusion

This architecture provides a scalable, efficient, and secure way to perform LLM-powered data analysis. By generating and executing code rather than analyzing data directly, the system can handle large datasets while maintaining accuracy and providing transparent, reproducible results.

The key advantages are:

- **Efficiency**: Only data structure is sent to LLM, not entire datasets
- **Accuracy**: Calculations done by pandas, not LLM
- **Transparency**: Users see the actual code being executed
- **Scalability**: Can handle datasets of any size
- **Security**: Code execution in sandboxed environment

This approach mirrors successful implementations like OpenAI's Code Interpreter while remaining simple enough for an MVP implementation.
