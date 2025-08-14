from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional
from datetime import datetime
from config import settings


class Session(BaseModel):
    """Represents a data analysis session"""
    id: str
    filename: str
    created_at: datetime
    columns: List[str]
    dtypes: Dict[str, str]  # Column name -> data type
    row_count: int
    column_count: int
    data_sample: List[Dict[str, Any]]  # First N rows
    full_data: Optional[List[Dict[str, Any]]] = None  # Store for MVP
    conversation_history: List[Dict[str, Any]] = []
    null_counts: Dict[str, int] = {}
    numeric_columns: List[str] = []
    categorical_columns: List[str] = []

    @validator('row_count')
    def validate_dataframe_size(cls, v, values):
        """Ensure dataframe doesn't exceed size limits"""
        if 'column_count' in values:
            total_cells = v * values['column_count']
            if total_cells > settings.MAX_DATAFRAME_SIZE:
                raise ValueError(
                    f"DataFrame too large: {total_cells:,} cells exceeds "
                    f"limit of {settings.MAX_DATAFRAME_SIZE:,}"
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


class ExecutionResult(BaseModel):
    """Result from code execution"""
    success: bool
    output: Optional[Any] = None
    error: Optional[str] = None
    execution_time: float
    truncated: bool = False


class AnalysisResponse(BaseModel):
    """Complete response to user"""
    question: str
    generated_code: str
    raw_result: Optional[Any] = None
    interpretation: str
    error: Optional[str] = None
    execution_time: float
    conversation_id: str


class SessionCreate(BaseModel):
    """Response when creating a new session"""
    session_id: str
    message: str
    data_info: Dict[str, Any]


class SessionList(BaseModel):
    """List of sessions"""
    sessions: List[Dict[str, Any]]
    total: int


class HealthCheck(BaseModel):
    """Health check response"""
    status: str
    database: str
    openai: str
    timestamp: datetime