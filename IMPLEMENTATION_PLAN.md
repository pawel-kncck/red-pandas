# Red Pandas MVP Implementation Plan

## Overview
This document provides a step-by-step implementation plan for the Red Pandas LLM-powered data analytics application MVP. The plan focuses on delivering core functionality with robust security while deferring advanced features for future iterations.

## Core Architecture Principles
- **Code Generation Approach**: LLM generates pandas code instead of analyzing raw data
- **Security First**: AST-based validation and sandboxed execution
- **Token Efficiency**: Only send data structure/samples to LLM, not entire datasets
- **Stateless Design**: Each query is independent with optional conversation context

## Implementation Phases

---

## Phase 1: Backend Foundation (Days 1-2)

### 1.1 Project Setup
**File**: `backend/requirements.txt`
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
motor==3.3.2
pandas==2.1.3
numpy==1.25.2
openai==1.3.5
pydantic==2.5.2
pydantic-settings==2.1.0
python-multipart==0.0.6
python-dotenv==1.0.0
```

### 1.2 Configuration Management
**File**: `backend/config.py`

**Implementation Steps**:
1. Create `Settings` class using pydantic-settings
2. Define all configuration parameters with defaults:
   - OpenAI settings (API key, model, temperatures)
   - Execution limits (timeout, dataframe size, output size)
   - Data sampling parameters
   - Security settings (forbidden imports/builtins)
3. Load from `.env` file with proper validation
4. Export singleton `settings` instance

**Key Configuration Values**:
```python
OPENAI_MODEL = "gpt-4o-mini"  # Cost-effective for MVP
MAX_EXECUTION_TIMEOUT = 5  # seconds
MAX_DATAFRAME_SIZE = 100_000_000  # cells
MAX_UPLOAD_SIZE = 104_857_600  # 100MB
DEFAULT_SAMPLE_ROWS = 5
```

### 1.3 Database Connection
**File**: `backend/database.py`

**Implementation Steps**:
1. Create async MongoDB client using Motor
2. Implement `get_database()` function for connection pooling
3. Handle connection errors gracefully
4. Create indexes for session lookups

**Required Collections**:
- `sessions`: Store session data, uploaded data, and conversation history

---

## Phase 2: Data Models (Day 3)

### 2.1 Pydantic Models
**File**: `backend/models.py`

**Core Models to Implement**:

1. **Session Model**:
   - id, filename, created_at
   - columns, dtypes, row_count, column_count
   - data_sample, full_data (JSON)
   - conversation_history array
   - Validator for dataframe size limits

2. **Query Model**:
   - question (1-1000 chars)
   - Validator for cleaning/trimming

3. **ExecutionResult Model**:
   - success, output, error
   - execution_time, truncated flag

4. **AnalysisResponse Model**:
   - question, generated_code, raw_result
   - interpretation, error, execution_time
   - conversation_id reference

5. **ConversationContext Model**:
   - question, code, result_summary, timestamp

---

## Phase 3: Security Layer (Days 4-5)

### 3.1 Code Validator
**File**: `backend/code_validator.py`

**Implementation Steps**:

1. **AST-based Validation**:
   - Parse code using Python's `ast` module
   - Create `ASTSecurityValidator` visitor class
   - Check for forbidden imports (os, sys, subprocess, etc.)
   - Check for forbidden builtins (eval, exec, open, etc.)
   - Check for dangerous dunder attributes
   - Verify 'result' variable assignment

2. **Validation Rules**:
   - Max code length: 10,000 characters
   - Must assign to 'result' variable
   - No file system access
   - No network operations
   - No subprocess execution

**Critical Security Checks**:
```python
FORBIDDEN_IMPORTS = ['os', 'sys', 'subprocess', 'socket', 'requests']
FORBIDDEN_BUILTINS = ['eval', 'exec', 'compile', '__import__', 'open']
```

### 3.2 Safe Code Execution
**File**: `backend/executor.py`

**Implementation Steps**:

1. **Sandboxed Environment**:
   - Create restricted namespace with only safe libraries
   - Include: pandas, numpy, datetime, math
   - Exclude: os, sys, subprocess, requests, etc.

2. **Execution Controls**:
   - Use ThreadPoolExecutor for isolation
   - Implement timeout using asyncio.wait_for
   - Copy dataframe to prevent modifications
   - Capture stdout/stderr

3. **Error Handling**:
   - Catch and sanitize error messages
   - Handle timeout gracefully
   - Return structured error information

---

## Phase 4: OpenAI Integration (Day 6)

### 4.1 OpenAI Client Manager
**File**: `backend/openai_client.py`

**Implementation Steps**:

1. **Client Management**:
   - Singleton pattern for client instance
   - Async OpenAI client initialization
   - Error handling and retry logic

2. **Prompt Engineering**:
   - Create code generation prompt template
   - Include data structure, sample rows, column types
   - Add conversation context when available
   - Specify output requirements (assign to 'result')

3. **Response Processing**:
   - Clean markdown formatting from responses
   - Handle edge cases (empty response, invalid format)

**Code Generation Prompt Structure**:
```
1. DataFrame structure (shape, columns, types)
2. Sample data (first 5 rows)
3. Null value information
4. Previous conversation context (if any)
5. Current question
6. Requirements (use 'result' variable, handle errors)
```

---

## Phase 5: Core API Endpoints (Days 7-9)

### 5.1 Session Creation Endpoint
**File**: `backend/main.py` - `/api/session/create`

**Implementation Steps**:

1. **File Validation**:
   - Check file extension (.csv only)
   - Validate file size (< 100MB)
   - Handle encoding issues (UTF-8, Latin-1)

2. **Data Processing**:
   - Parse CSV with pandas
   - Extract metadata (columns, types, shape)
   - Generate session ID (UUID)
   - Store sample rows (first 5)
   - Store full data as JSON

3. **Response**:
   - Return session_id
   - Include data summary
   - List numeric/categorical columns

### 5.2 Analysis Endpoint
**File**: `backend/main.py` - `/api/session/{session_id}/analyze`

**Implementation Flow**:

1. Retrieve session from MongoDB
2. Load dataframe from stored JSON
3. Get conversation history (last 3 interactions)
4. Generate code using OpenAI
5. Validate code with AST validator
6. Execute code in sandbox
7. Format results for response
8. Generate interpretation with OpenAI
9. Store interaction in conversation history
10. Return analysis response

**Error Recovery**:
- If code generation fails: Return friendly error
- If validation fails: Retry with enhanced prompt
- If execution fails: Return sanitized error message

### 5.3 Supporting Endpoints

**Health Check** (`/api/health`):
- Database connectivity check
- OpenAI API availability

**Get Session** (`/api/session/{session_id}`):
- Return session metadata
- Include conversation history

**List Sessions** (`/api/sessions`):
- Return all sessions (limit 100 for MVP)
- Sort by created_at descending

---

## Phase 6: Conversation Management (Day 10)

### 6.1 Conversation Manager
**File**: `backend/conversation_manager.py`

**Implementation Steps**:

1. **History Storage**:
   - Store in session document as array
   - Keep last 10 interactions (configurable)
   - Include question, code, result summary

2. **Context Retrieval**:
   - Get last 3 interactions for context
   - Format for LLM prompt inclusion
   - Summarize results for token efficiency

3. **Result Summarization**:
   - DataFrames: Shape and preview
   - Series: Length and sample values
   - Scalars: Direct values
   - Truncate long strings

---

## Phase 7: Testing (Days 11-12)

### 7.1 Unit Tests
**File**: `backend/tests/test_*.py`

**Test Coverage Required**:

1. **Code Validation Tests**:
   - Valid pandas operations
   - Forbidden imports detection
   - Forbidden builtins detection
   - Missing result assignment

2. **Execution Tests**:
   - Successful execution
   - Timeout handling
   - Error handling
   - Result formatting

3. **API Tests**:
   - File upload validation
   - Session creation
   - Query analysis
   - Error responses

### 7.2 Integration Tests

**Critical Paths to Test**:
1. Upload CSV → Create Session → Analyze Data
2. Multiple queries with conversation context
3. Error recovery and retry logic
4. Large file handling

---

## Phase 8: Deployment Preparation (Day 13)

### 8.1 Environment Configuration

**Production Settings**:
```env
OPENAI_API_KEY=<production_key>
MONGODB_URL=<atlas_connection_string>
DATABASE_NAME=red_pandas_db
```

### 8.2 Performance Optimization

1. **Database Indexes**:
   - Session ID index
   - Created_at index for listing

2. **Connection Pooling**:
   - MongoDB connection pool
   - ThreadPoolExecutor for code execution

3. **Response Optimization**:
   - Truncate large results
   - Limit sample data in prompts
   - Cache OpenAI client

---

## Implementation Guidelines

### Do's ✅
1. **Start with happy path** - Get basic flow working first
2. **Test security early** - Validate code sandboxing thoroughly
3. **Use existing code examples** - Reference spec documents for implementation details
4. **Handle errors gracefully** - User-friendly messages for all errors
5. **Log important events** - Session creation, code execution, errors
6. **Validate all inputs** - File uploads, queries, session IDs

### Don'ts ❌
1. **Don't implement advanced features** - No visualizations, ML predictions, or multi-file analysis
2. **Don't add authentication** - Not required for MVP
3. **Don't optimize prematurely** - Focus on functionality first
4. **Don't store sensitive data** - No PII in logs or error messages
5. **Don't exceed token limits** - Keep prompts concise

---

## Success Metrics

### MVP Completion Checklist
- [ ] Users can upload CSV files up to 100MB
- [ ] System extracts and stores data structure
- [ ] Users can ask natural language questions
- [ ] System generates valid pandas code
- [ ] Code executes safely in sandbox
- [ ] Results are interpreted in plain language
- [ ] Conversation history provides context
- [ ] All dangerous code is blocked
- [ ] Errors are handled gracefully
- [ ] Basic tests pass (>80% coverage)

### Performance Targets
- Session creation: < 2 seconds for 10MB file
- Query analysis: < 5 seconds average
- Code execution: < 5 seconds timeout
- Memory usage: < 500MB per session

---

## Post-MVP Enhancements (Future)

**Phase 2 Features** (Not in current scope):
- Data visualizations (matplotlib/plotly)
- Export functionality (Excel, PDF)
- Multi-file analysis
- Advanced statistics
- User authentication
- Query optimization with caching
- Batch query processing

---

## Development Timeline

**Week 1 (Days 1-5)**:
- Backend foundation
- Data models
- Security implementation

**Week 2 (Days 6-10)**:
- OpenAI integration
- Core API endpoints
- Conversation management

**Week 3 (Days 11-13)**:
- Testing
- Bug fixes
- Deployment preparation

**Total Estimated Time**: 13 working days for backend MVP

---

## Notes for Developers

1. **Security is paramount** - Never trust LLM-generated code without validation
2. **Keep it simple** - MVP focuses on core functionality only
3. **Use the specs** - Detailed code examples are in the specification files
4. **Test edge cases** - Empty files, large files, malicious queries
5. **Document assumptions** - Add comments for non-obvious decisions

This plan provides a backend-first approach. Frontend implementation should follow using the API endpoints defined here, maintaining the same MVP philosophy of simplicity and core functionality.