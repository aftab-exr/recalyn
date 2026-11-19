from typing import List, Literal, Optional
from pydantic import BaseModel, Field

# --- Gemini Structured Output Contracts ---
class GeneratedFlashcard(BaseModel):
    front: str = Field(description="Concise question, term, or prompt")
    back: str = Field(description="Accurate explanation grounded strictly in the PDF text")
    tag: str = Field(description="Short topic or section label in 1-2 words")
    difficulty: Literal["easy", "medium", "hard"]

class GeneratedQuizQuestion(BaseModel):
    question: str
    options: List[str] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    explanation: str = Field(description="Why the correct option is accurate based on the PDF")
    weight: float = Field(default=1.0, description="1.0 easy, 1.5 medium, 2.0 hard")

class GeneratedStudyPack(BaseModel):
    deck_title: str
    flashcards: List[GeneratedFlashcard]
    daily_quiz: List[GeneratedQuizQuestion]

# --- API Request/Response Contracts ---
class RateCardRequest(BaseModel):
    rating: int = Field(ge=1, le=4)

class SubmitQuizRequest(BaseModel):
    score_percent: float = Field(ge=0.0, le=100.0)

class FlashcardOut(BaseModel):
    id: str
    front: str
    back: str
    tag: str
    difficulty: str
    rating: Optional[int] = None

class QuizQuestionOut(BaseModel):
    id: str
    question: str
    options: List[str]
    correct_index: int
    explanation: str
    weight: float

class DeckOut(BaseModel):
    id: str
    title: str
    pagesProcessed: int
    createdAt: str
    lastQuizScore: Optional[float] = None
    flashcards: List[FlashcardOut]
    dailyQuiz: List[QuizQuestionOut]

class GradeOut(BaseModel):
    numericScore: Optional[float]
    letterGrade: str
    quizMastery: Optional[float]
    flashcardRetention: Optional[float]
    consistencyBonus: float
    streakDays: int

class IngestBase64Request(BaseModel):
    filename: str
    pdf_base64: str
