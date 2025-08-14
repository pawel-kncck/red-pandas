from typing import List, Optional, Dict, Any
from datetime import datetime
from config import settings
from models import ConversationContext
import logging

logger = logging.getLogger(__name__)


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

        try:
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
            logger.info(f"Added interaction {interaction_id} to session {session_id}")
        except Exception as e:
            logger.error(f"Failed to add interaction to session: {e}")
            raise

        return interaction_id

    async def get_conversation_context(
        self,
        session_id: str,
        lookback: Optional[int] = None
    ) -> List[ConversationContext]:
        """Get relevant context from previous interactions"""
        lookback = lookback or settings.CONTEXT_LOOKBACK

        try:
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

            logger.info(f"Retrieved {len(context)} conversation context items for session {session_id}")
            return context
        except Exception as e:
            logger.error(f"Failed to get conversation context: {e}")
            return []

    def _summarize_result(self, result: Any) -> str:
        """Create concise summary of result for context"""
        if result is None:
            return "No result"

        if isinstance(result, dict):
            if result.get('type') == 'dataframe':
                shape = result.get('shape', [0, 0])
                columns = result.get('columns', [])
                return f"DataFrame with {shape[0]} rows and {shape[1]} columns. Columns: {', '.join(columns[:5])}{' ...' if len(columns) > 5 else ''}"
            elif result.get('type') == 'series':
                length = result.get('length', len(result.get('data', {})))
                return f"Series with {length} values"
            elif result.get('type') == 'array':
                shape = result.get('shape', 'unknown shape')
                return f"Array with shape {shape}"
            else:
                keys = list(result.keys())[:5]
                return f"Dictionary with {len(result)} keys: {', '.join(map(str, keys))}{' ...' if len(result) > 5 else ''}"

        elif isinstance(result, (list, tuple)):
            if len(result) > 10:
                sample = str(result[:3])[:-1] + ', ...]'
                return f"List with {len(result)} items: {sample}"
            return f"List with {len(result)} items: {result}"

        elif isinstance(result, (int, float)):
            return f"Numeric value: {result}"

        elif isinstance(result, bool):
            return f"Boolean value: {result}"

        elif isinstance(result, str):
            if len(result) > 100:
                return f"String (length: {len(result)}): {result[:100]}..."
            return f"String: {result}"

        else:
            result_str = str(result)
            if len(result_str) > 100:
                return f"Result of type {type(result).__name__}: {result_str[:100]}..."
            return f"Result of type {type(result).__name__}: {result_str}"

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

    async def clear_conversation_history(self, session_id: str) -> bool:
        """Clear conversation history for a session"""
        try:
            await self.db.sessions.update_one(
                {"_id": session_id},
                {"$set": {"conversation_history": []}}
            )
            logger.info(f"Cleared conversation history for session {session_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to clear conversation history: {e}")
            return False

    async def get_full_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Get full conversation history for a session"""
        try:
            session = await self.db.sessions.find_one({"_id": session_id})
            if not session or 'conversation_history' not in session:
                return []
            
            return session['conversation_history']
        except Exception as e:
            logger.error(f"Failed to get full history: {e}")
            return []