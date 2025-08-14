from openai import AsyncOpenAI
from typing import List, Dict, Optional, Any
import pandas as pd
import logging
from config import settings
from models import ConversationContext

logger = logging.getLogger(__name__)


class OpenAIManager:
    """Manages OpenAI API client and prompt generation"""

    _client: Optional[AsyncOpenAI] = None

    @classmethod
    def get_client(cls) -> AsyncOpenAI:
        """Get or create OpenAI client (singleton pattern)"""
        if cls._client is None:
            cls._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            logger.info("OpenAI client initialized")
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
                temperature=temperature,
                max_tokens=2000
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise Exception(f"OpenAI API error: {str(e)}")


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

Numeric columns: {', '.join(df_info.get('numeric_columns', [])) or 'None'}
Categorical columns: {', '.join(df_info.get('categorical_columns', [])) or 'None'}

First {len(df_info['data_sample'])} rows of data:
{format_sample_data(df_info['data_sample'])}

Null value counts per column:
{format_null_counts(df_info.get('null_counts', {}))}
"""

    # Add conversation context if available
    if context:
        prompt += "\n" + format_context_for_prompt(context)

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
- Include comments to explain what the code does

Return ONLY executable Python code, no explanations or markdown.
"""
    return prompt


def format_column_info(columns: list, dtypes: dict) -> str:
    """Format column information for prompt"""
    return "\n".join([f"- {col}: {dtypes.get(col, 'unknown')}" for col in columns])


def format_sample_data(sample: list) -> str:
    """Format sample data as readable table"""
    if not sample:
        return "No data available"
    try:
        df_sample = pd.DataFrame(sample)
        return df_sample.to_string()
    except Exception as e:
        logger.error(f"Error formatting sample data: {e}")
        return str(sample)[:500]  # Fallback to string representation


def format_null_counts(null_counts: dict) -> str:
    """Format null counts for prompt"""
    if not null_counts:
        return "No information about null values"
    
    nulls_present = [f"- {col}: {count} null values" for col, count in null_counts.items() if count > 0]
    
    if nulls_present:
        return "\n".join(nulls_present)
    else:
        return "No null values in the dataset"


def format_context_for_prompt(context: List[ConversationContext]) -> str:
    """Format conversation context for inclusion in LLM prompt"""
    if not context:
        return ""

    formatted = "Previous conversation context:\n"
    for i, ctx in enumerate(context, 1):
        formatted += f"\n{i}. Question: {ctx.question}\n"
        code_preview = ctx.code[:200] + "..." if len(ctx.code) > 200 else ctx.code
        formatted += f"   Generated code snippet: {code_preview}\n"
        formatted += f"   Result: {ctx.result_summary}\n"

    formatted += "\nConsider this context when generating new code.\n"
    return formatted


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


async def interpret_results(
    question: str,
    code: str,
    result: Any,
    openai_manager: Optional[OpenAIManager] = None
) -> str:
    """
    Ask LLM to interpret the execution results
    """
    if openai_manager is None:
        openai_manager = OpenAIManager()

    # Format result for interpretation
    result_description = format_result_for_interpretation(result)

    interpretation_prompt = f"""
The user asked: {question}

You generated and ran this code:
```python
{code}
```

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
        logger.error(f"Failed to interpret results: {e}")
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
            try:
                df_preview = pd.DataFrame(result['data']).head(5)
                preview_str = df_preview.to_string()

                if result.get('truncated'):
                    return f"DataFrame with shape {result['shape']} (showing first {len(result['data'])} rows):\n{preview_str}"
                else:
                    return f"DataFrame with shape {result['shape']}:\n{preview_str}"
            except:
                return f"DataFrame with shape {result.get('shape', 'unknown')}"

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