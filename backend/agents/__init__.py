"""
LangGraph Agent System for Dicoding GenAI
==========================================
This module contains specialized agents for question generation and RAG-based learning.

Agents:
- LangGraphQuestionAgent: Multi-step reasoning agent with tools for question generation
  Uses LangGraph for workflow, Pydantic for structured tools, LangChain for LLM.

Features:
- Multi-step reasoning with LangGraph state machine
- Pydantic-based structured tools
- Question generation with multiple types (MCQ, Multiple Select, T/F, Essay, etc.)
- Interactive Quiz Mode (questions without answers first)
- RAG context integration
- Chat history persistence with LangGraph memory
- Score tracking for quiz sessions
- Export to JSON/Markdown/Aiken formats
"""

# Ensure environment variables are loaded before imports
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from parent directory (backend/)
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

from .models import (
    QuestionType,
    QuestionOption,
    Question,
    QuestionSet,
    ExportFormat,
    AgentStyle,
    AgentRequest,
    AgentResponse,
    EditQuestionRequest,
    GenerateQuestionParams,
    TestQuestionParams,
    ExportParams,
)

# LangGraph agent (primary)
from .langgraph_agent import (
    LangGraphQuestionAgent, 
    get_agent, 
    reset_agent,
    get_session_questions,
    get_session_score,
    save_session_questions,
    update_session_score,
    save_session_question_set,
    get_session_question_set,
)

__all__ = [
    # Models
    "QuestionType",
    "QuestionOption", 
    "Question",
    "QuestionSet",
    "ExportFormat",
    "AgentStyle",
    "AgentRequest",
    "AgentResponse",
    "EditQuestionRequest",
    "GenerateQuestionParams",
    "TestQuestionParams",
    "ExportParams",
    # LangGraph Agent
    "LangGraphQuestionAgent",
    "get_agent",
    "reset_agent",
    "get_session_questions",
    "get_session_score",
    "save_session_questions",
    "update_session_score",
    "save_session_question_set",
    "get_session_question_set",
]
