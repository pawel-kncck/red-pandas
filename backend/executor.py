import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import io
from contextlib import redirect_stdout, redirect_stderr
import asyncio
from concurrent.futures import ThreadPoolExecutor
import time
from typing import Dict, Any, Tuple, Optional
from datetime import datetime
import math
import statistics
import logging

from config import settings
from code_validator import CodeValidator
from models import ExecutionResult

logger = logging.getLogger(__name__)

# Create thread pool executor for code execution
executor = ThreadPoolExecutor(max_workers=2)


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
            'total_rows': len(result),
            'columns': result.columns.tolist()
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
            'truncated': truncated,
            'name': result.name
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
                'truncated': truncated,
                'length': len(result)
            }, truncated
        return result, truncated

    else:
        # For unknown types, convert to string
        result_str = str(result)
        if len(result_str) > settings.MAX_OUTPUT_SIZE:
            truncated = True
            return result_str[:settings.MAX_OUTPUT_SIZE] + '...', truncated
        return result_str, truncated


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
        logger.warning(f"Code validation failed: {validation_message}")
        return ExecutionResult(
            success=False,
            output=None,
            error=f"Code validation failed: {validation_message}",
            execution_time=0,
            truncated=False
        ).dict()

    # Create restricted namespace with only safe libraries
    namespace = {
        'df': df.copy(),  # Use copy to prevent modifications to original
        'pd': pd,
        'np': np,
        'plt': plt,
        'datetime': datetime,
        'math': math,
        'statistics': statistics,
        'result': None,
        # Explicitly do not include: os, sys, subprocess, open, requests, etc.
    }

    # Capture output
    output_buffer = io.StringIO()
    error_buffer = io.StringIO()

    try:
        # Run in executor with timeout
        loop = asyncio.get_event_loop()

        def run_code():
            try:
                with redirect_stdout(output_buffer), redirect_stderr(error_buffer):
                    exec(code, namespace)
                
                # Get the result variable
                result = namespace.get('result')
                
                # If no result but there's output, use the output
                if result is None and output_buffer.getvalue():
                    return output_buffer.getvalue().strip()
                
                return result
            except Exception as e:
                # Capture any execution errors
                raise Exception(f"Execution error: {str(e)}")

        future = loop.run_in_executor(executor, run_code)

        try:
            result = await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning(f"Code execution timed out after {timeout} seconds")
            return ExecutionResult(
                success=False,
                output=None,
                error=f"Code execution timed out after {timeout} seconds. The operation may be too complex.",
                execution_time=timeout,
                truncated=False
            ).dict()

        execution_time = time.time() - start_time

        # Format and potentially truncate result
        formatted_result, truncated = format_and_truncate_result(result)

        logger.info(f"Code executed successfully in {execution_time:.2f} seconds")
        
        return ExecutionResult(
            success=True,
            output=formatted_result,
            error=None,
            execution_time=execution_time,
            truncated=truncated
        ).dict()

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
        elif "AttributeError" in error_message:
            error_message = f"Attribute error: {error_message}"

        logger.error(f"Code execution failed: {error_message}")

        return ExecutionResult(
            success=False,
            output=None,
            error=error_message,
            execution_time=execution_time,
            truncated=False
        ).dict()