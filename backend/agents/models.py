"""
Pydantic Models for Question Generation Agent
=============================================
Defines structured data models for questions, options, and agent responses.
"""

from enum import Enum
from typing import Optional, List, Union, Any, Dict
from pydantic import BaseModel, Field
import json


class QuestionType(str, Enum):
    """Types of questions that can be generated."""
    MULTIPLE_CHOICE = "multiple_choice"  # Single correct answer (A/B/C/D)
    MULTIPLE_SELECT = "multiple_select"  # Multiple correct answers (checkbox style)
    TRUE_FALSE = "true_false"  # True/False statement
    ESSAY = "essay"  # Open-ended essay
    SHORT_ANSWER = "short_answer"  # Brief text answer
    FILL_BLANK = "fill_blank"  # Fill in the blank
    MATCHING = "matching"  # Match items from two columns
    
    # Legacy alias
    MULTIBOX = "multiple_select"


class ExportFormat(str, Enum):
    """Available export formats."""
    JSON = "json"
    MARKDOWN = "markdown"
    MOODLE_XML = "moodle_xml"
    AIKEN = "aiken"


class AgentStyle(str, Enum):
    """Available agent styles."""
    GENERATE_QUESTION = "generate-question"
    CHAT_FORUM = "chat-forum"
    NONE = "none"


class QuestionOption(BaseModel):
    """Option for multiple choice or multibox questions."""
    id: str = Field(..., description="Option identifier (A, B, C, D, E)")
    text: str = Field(..., description="Option text content")
    is_correct: bool = Field(default=False, description="Whether this option is correct")
    explanation: Optional[str] = Field(None, description="Explanation for this option")


class Question(BaseModel):
    """A single question with all its components."""
    id: str = Field(..., description="Unique question identifier")
    type: QuestionType = Field(..., description="Type of question")
    question_text: str = Field(..., description="The question content in markdown")
    question: Optional[str] = Field(None, description="Alias for question_text for frontend compatibility")
    options: Optional[List[QuestionOption]] = Field(None, description="Options for MCQ/multibox/T-F")
    correct_answer: Optional[Union[str, List[str], bool, Dict[str, str]]] = Field(None, description="The correct answer(s)")
    explanation: Optional[str] = Field(None, description="Explanation of the correct answer")
    difficulty: Optional[str] = Field("medium", description="Difficulty level: easy, medium, hard")
    topic: Optional[str] = Field(None, description="Topic/category of the question")
    source: Optional[str] = Field(None, description="Source document or context reference")
    hints: Optional[List[str]] = Field(None, description="Optional hints for the question")
    points: int = Field(default=1, description="Point value of the question")
    
    items: Optional[List[QuestionOption]] = Field(None, description="Left side items for matching")
    matches: Optional[List[QuestionOption]] = Field(None, description="Right side options for matching")
    matching_pairs: Optional[List[Dict[str, str]]] = Field(None, description="For matching questions: list of {left, right} pairs")
    
    def model_post_init(self, __context) -> None:
        """Ensure consistency between fields."""
        if self.question is None and self.question_text:
            self.question = self.question_text
        elif self.question_text is None and self.question:
            self.question_text = self.question
            
        # Ensure items/matches are not None for matching types in JSON
        if self.type == "matching":
            if self.items is None:
                self.items = []
            if self.matches is None:
                self.matches = []
    
    def to_markdown(self) -> str:
        """Convert question to Markdown format."""
        md = []
        md.append(f"### {self.question_text}")
        md.append("")
        
        if self.type in [QuestionType.MULTIPLE_CHOICE, QuestionType.MULTIBOX]:
            if self.options:
                for opt in self.options:
                    marker = "- [x]" if opt.is_correct else "- [ ]"
                    md.append(f"{marker} **{opt.id}.** {opt.text}")
            md.append("")
        
        elif self.type == QuestionType.TRUE_FALSE:
            # Handle boolean logic correctly - strict check for True/False strings
            is_true = str(self.correct_answer).lower() in ['true', 'yes', '1', 'benar']
            correct = "True ✓" if is_true else "False ✓"
            md.append(f"**Answer:** {correct}")
            md.append("")
        
        elif self.type in [QuestionType.SHORT_ANSWER, QuestionType.FILL_BLANK]:
            md.append(f"**Answer:** {self.correct_answer}")
            md.append("")
        
        elif self.type == QuestionType.ESSAY:
            md.append("*Essay question - see rubric for scoring*")
            md.append("")
        
        if self.explanation:
            md.append(f"> 💡 **Explanation:** {self.explanation}")
            md.append("")
        
        if self.difficulty:
            md.append(f"*Difficulty: {self.difficulty} | Points: {self.points}*")
        
        return "\n".join(md)
    
    def to_aiken(self) -> str:
        """Convert to Aiken format (for Moodle import)."""
        if self.type != QuestionType.MULTIPLE_CHOICE:
            return ""
        
        lines = [self.question_text]
        correct_letter = "A"
        
        if self.options:
            for opt in self.options:
                lines.append(f"{opt.id}. {opt.text}")
                if opt.is_correct:
                    correct_letter = opt.id
        
        lines.append(f"ANSWER: {correct_letter}")
        return "\n".join(lines)


class QuestionSet(BaseModel):
    """A set of questions with metadata."""
    id: str = Field(..., description="Unique set identifier")
    title: str = Field(..., description="Title of the question set")
    description: Optional[str] = Field(None, description="Description of the set")
    questions: List[Question] = Field(default_factory=list, description="List of questions")
    created_at: Optional[str] = Field(None, description="Creation timestamp")
    source_document: Optional[str] = Field(None, description="Source document used for generation")
    total_points: int = Field(default=0, description="Total points of all questions")
    
    def model_post_init(self, __context) -> None:
        """Calculate total points after initialization."""
        self.total_points = sum(q.points for q in self.questions)
    
    def to_json(self, indent: int = 2) -> str:
        """Export to JSON format."""
        return self.model_dump_json(indent=indent)
    
    def to_markdown(self) -> str:
        """Export to Markdown format."""
        md = []
        md.append(f"# {self.title}")
        md.append("")
        
        if self.description:
            md.append(f"*{self.description}*")
            md.append("")
        
        md.append(f"**Total Questions:** {len(self.questions)} | **Total Points:** {self.total_points}")
        md.append("")
        md.append("---")
        md.append("")
        
        for i, q in enumerate(self.questions, 1):
            md.append(f"## Question {i}")
            md.append(q.to_markdown())
            md.append("")
            md.append("---")
            md.append("")
        
        return "\n".join(md)
    
    def to_aiken(self) -> str:
        """Export MCQ questions to Aiken format."""
        aiken_questions = []
        for q in self.questions:
            if q.type == QuestionType.MULTIPLE_CHOICE:
                aiken_questions.append(q.to_aiken())
        return "\n\n".join(aiken_questions)


class AgentRequest(BaseModel):
    """Request to an agent."""
    agent_style: AgentStyle = Field(..., description="Agent style to use")
    message: str = Field(..., description="User message/prompt")
    session_id: str = Field(..., description="Session identifier")
    context: Optional[str] = Field(None, description="RAG context from document")
    document: Optional[str] = Field(None, description="Document path for RAG")
    documents: Optional[List[str]] = Field(None, description="List of documents for RAG (multi-select)")
    history: Optional[List[List[str]]] = Field(default_factory=list, description="Chat history")
    
    # Question generation specific
    question_type: Optional[QuestionType] = Field(None, description="Type of questions to generate")
    num_questions: int = Field(default=5, description="Number of questions to generate")
    difficulty: Optional[str] = Field("medium", description="Difficulty level")
    topic: Optional[str] = Field(None, description="Topic/subject focus")
    language: str = Field(default="id", description="Language for questions (id/en)")
    image_url: Optional[str] = Field(None, description="URL of image to analyze")


class AgentResponse(BaseModel):
    """Response from an agent."""
    output: str = Field(..., description="Main text output (markdown)")
    agent_style: AgentStyle = Field(..., description="Agent style used")
    session_id: str = Field(..., description="Session identifier")
    
    # Structured data (if applicable)
    questions: Optional[QuestionSet] = Field(None, description="Generated question set")
    
    # Export options
    export_json: Optional[str] = Field(None, description="JSON export of questions")
    export_markdown: Optional[str] = Field(None, description="Markdown export of questions")
    
    # Metadata
    sources: Optional[List[dict]] = Field(None, description="RAG sources used")
    editable: bool = Field(default=False, description="Whether output can be edited")


class EditQuestionRequest(BaseModel):
    """Request to edit a generated question."""
    session_id: str = Field(..., description="Session identifier")
    question_id: str = Field(..., description="ID of question to edit")
    
    # Fields that can be edited
    question_text: Optional[str] = Field(None, description="New question text")
    options: Optional[List[QuestionOption]] = Field(None, description="Updated options")
    correct_answer: Optional[Union[str, List[str], bool]] = Field(None, description="Updated correct answer")
    explanation: Optional[str] = Field(None, description="Updated explanation")
    difficulty: Optional[str] = Field(None, description="Updated difficulty")


class GenerateQuestionParams(BaseModel):
    """Parameters for question generation tool."""
    topic: str = Field(..., description="Topic to generate questions about")
    question_type: QuestionType = Field(QuestionType.MULTIPLE_CHOICE, description="Type of question")
    num_questions: int = Field(default=3, description="Number of questions to generate (1-10)")
    difficulty: str = Field(default="medium", description="Difficulty: easy, medium, hard")
    language: str = Field(default="id", description="Language: id (Indonesian) or en (English)")
    include_explanation: bool = Field(default=True, description="Include answer explanations")
    use_rag_context: bool = Field(default=True, description="Use RAG context if available")


class TestQuestionParams(BaseModel):
    """Parameters for testing a question interactively."""
    question_id: str = Field(..., description="ID of the question to test")
    user_answer: Union[str, List[str], bool] = Field(..., description="User's answer")


class ExportParams(BaseModel):
    """Parameters for exporting questions."""
    format: ExportFormat = Field(ExportFormat.JSON, description="Export format")
    include_answers: bool = Field(default=True, description="Include answers in export")
    include_explanations: bool = Field(default=True, description="Include explanations")


# ============================================================================
# Pydantic Output Schemas for Structured LLM Output
# ============================================================================

class QuestionOptionOutput(BaseModel):
    """Option format for frontend rendering."""
    id: str = Field(..., description="Option letter: A, B, C, D, or E")
    text: str = Field(..., description="Option text content")


class MatchingPair(BaseModel):
    """Matching pair for matching questions."""
    left: str = Field(..., description="Left side item")
    right: str = Field(..., description="Right side matching item")


class QuestionOutput(BaseModel):
    """Single question output format for frontend."""
    id: str = Field(..., description="Question ID like q1, q2, etc")
    type: str = Field(
        ..., 
        description="Question type: multiple_choice, multiple_select, true_false, essay, short_answer, fill_blank, matching"
    )
    question: str = Field(..., description="The question text")
    options: Optional[List[QuestionOptionOutput]] = Field(
        None, 
        description="Options for MCQ/multiple_select. Each with id (A/B/C/D) and text"
    )
    correct_answer: Union[str, List[str], bool, Dict[str, str]] = Field(
        ..., 
        description="Correct answer. Single letter for MCQ, list for multiple_select, 'true'/'false' for T/F, mapping {idx: match_id} for matching"
    )
    explanation: str = Field(..., description="Explanation of why the answer is correct")
    matching_pairs: Optional[List[MatchingPair]] = Field(
        None,
        description="For matching questions: list of {left, right} pairs"
    )


class QuestionSetOutput(BaseModel):
    """Output schema for generated questions - matches frontend expectation."""
    questions: List[QuestionOutput] = Field(..., description="List of generated questions")


class AnswerFeedback(BaseModel):
    """Feedback for user's answer."""
    question_number: int = Field(..., description="Question number (1-based)")
    question_text: str = Field(..., description="The original question text")
    user_answer: str = Field(..., description="User's submitted answer")
    correct_answer: str = Field(..., description="The correct answer")
    is_correct: bool = Field(..., description="Whether user's answer is correct")
    explanation: str = Field(..., description="Explanation of the answer")
    score: Optional[str] = Field(None, description="Current score like '2/5 (40%)'")


class AnswerCheckOutput(BaseModel):
    """Output schema for answer checking."""

class IntentType(str, Enum):
    """Available intents for the agent."""
    GENERATE_QUESTION = "generate_question"
    CHECK_ANSWER = "check_answer"
    GENERAL_CHAT = "general_chat"


class RouterDecision(BaseModel):
    """Decision made by the intent router."""
    intent: IntentType = Field(..., description="The classified intent of the user")
    reasoning: str = Field(..., description="Explanation for the classification")
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Extracted parameters (e.g., topic, number of questions)")

