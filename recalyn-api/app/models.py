from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Deck(Base):
    __tablename__ = "decks"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    pages_processed = Column(Integer, nullable=False)
    last_quiz_score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    flashcards = relationship("Flashcard", back_populates="deck", cascade="all, delete-orphan")
    quiz_questions = relationship("QuizQuestion", back_populates="deck", cascade="all, delete-orphan")

class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(String, primary_key=True, index=True)
    deck_id = Column(String, ForeignKey("decks.id", ondelete="CASCADE"), nullable=False)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    tag = Column(String, nullable=False)
    difficulty = Column(String, nullable=False)
    rating = Column(Integer, nullable=True)  # 1, 2, 3, 4

    deck = relationship("Deck", back_populates="flashcards")

class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(String, primary_key=True, index=True)
    deck_id = Column(String, ForeignKey("decks.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    options = Column(JSON, nullable=False)
    correct_index = Column(Integer, nullable=False)
    explanation = Column(Text, nullable=False)
    weight = Column(Float, default=1.0, nullable=False)

    deck = relationship("Deck", back_populates="quiz_questions")

class StudyActivity(Base):
    __tablename__ = "study_activity"

    activity_date = Column(String, primary_key=True)  # YYYY-MM-DD
