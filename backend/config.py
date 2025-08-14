from pydantic_settings import BaseSettings
from typing import List, Optional


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

    # Database Configuration
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "red_pandas_db"

    # Security
    FORBIDDEN_IMPORTS: List[str] = [
        'os', 'sys', 'subprocess', 'socket', 'requests',
        'urllib', 'http', 'ftplib', 'telnetlib', 'ssl',
        'importlib', 'pkgutil', 'inspect', 'ctypes',
        'shutil', 'glob', 'pathlib', 'tempfile'
    ]

    FORBIDDEN_BUILTINS: List[str] = [
        'eval', 'exec', 'compile', '__import__',
        'open', 'input', 'help', 'globals', 'locals',
        'vars', 'dir', 'getattr', 'setattr', 'delattr',
        'breakpoint', 'memoryview', 'bytearray'
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True


# Create singleton settings instance
settings = Settings()