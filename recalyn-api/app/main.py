import base64
import uuid
from datetime import datetime, timezone
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.models import Deck, Flashcard, QuizQuestion, StudyActivity
from app.schemas import (
    DeckOut,
    FlashcardOut,
    GradeOut,
    IngestBase64Request,
    QuizQuestionOut,
    RateCardRequest,
    SubmitQuizRequest,
)
from app.services.ai_service import generate_study_pack
from app.services.grade_engine import compute_grade_telemetry
from app.services.pdf_service import extract_pdf_text

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Recalyn StudyPal API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _record_today_activity(db: Session) -> None:
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    exists = db.query(StudyActivity).filter(StudyActivity.activity_date == today_str).first()
    if not exists:
        db.add(StudyActivity(activity_date=today_str))

def _serialize_deck(deck: Deck) -> DeckOut:
    return DeckOut(
        id=deck.id,
        title=deck.title,
        pagesProcessed=deck.pages_processed,
        createdAt=deck.created_at.strftime("%b %d").upper(),
        lastQuizScore=deck.last_quiz_score,
        flashcards=[
            FlashcardOut(
                id=c.id,
                front=c.front,
                back=c.back,
                tag=c.tag,
                difficulty=c.difficulty,
                rating=c.rating,
            )
            for c in deck.flashcards
        ],
        dailyQuiz=[
            QuizQuestionOut(
                id=q.id,
                question=q.question,
                options=q.options,
                correct_index=q.correct_index,
                explanation=q.explanation,
                weight=q.weight,
            )
            for q in deck.quiz_questions
        ],
    )

def _process_and_save_pdf(raw_bytes: bytes, filename: str, db: Session) -> dict:
    pdf_text, pages_processed = extract_pdf_text(raw_bytes)
    if len(pdf_text) < 100:
        raise HTTPException(status_code=422, detail="Unable to extract readable text from PDF.")

    try:
        pack = generate_study_pack(pdf_text, filename)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI generation error: {str(exc)}")

    deck_id = f"deck-{uuid.uuid4().hex[:10]}"
    deck = Deck(
        id=deck_id,
        title=pack.deck_title,
        filename=filename,
        pages_processed=pages_processed,
    )
    db.add(deck)

    for idx, fc in enumerate(pack.flashcards):
        db.add(
            Flashcard(
                id=f"fc-{uuid.uuid4().hex[:8]}-{idx}",
                deck_id=deck_id,
                front=fc.front,
                back=fc.back,
                tag=fc.tag,
                difficulty=fc.difficulty,
            )
        )

    for idx, qq in enumerate(pack.daily_quiz):
        db.add(
            QuizQuestion(
                id=f"q-{uuid.uuid4().hex[:8]}-{idx}",
                deck_id=deck_id,
                question=qq.question,
                options=qq.options,
                correct_index=qq.correct_index,
                explanation=qq.explanation,
                weight=qq.weight,
            )
        )

    db.commit()
    db.refresh(deck)

    return {
        "pages_processed": pages_processed,
        "deck": _serialize_deck(deck).model_dump(),
        "study_pack": pack.model_dump(),
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/v1/decks", response_model=list[DeckOut])
def list_decks(db: Session = Depends(get_db)):
    decks = db.query(Deck).order_by(Deck.created_at.desc()).all()
    return [_serialize_deck(d) for d in decks]

@app.post("/api/v1/decks/ingest")
async def ingest_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    raw_bytes = await file.read()
    return _process_and_save_pdf(raw_bytes, file.filename, db)

@app.post("/api/v1/decks/ingest-base64")
def ingest_pdf_base64(payload: IngestBase64Request, db: Session = Depends(get_db)):
    if not payload.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    try:
        raw_bytes = base64.b64decode(payload.pdf_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 PDF payload.")
    return _process_and_save_pdf(raw_bytes, payload.filename, db)

@app.delete("/api/v1/decks/{deck_id}")
def delete_deck(deck_id: str, db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found.")
    db.delete(deck)
    db.commit()
    return {"deleted": True, "id": deck_id}

@app.patch("/api/v1/cards/{card_id}/rate")
def rate_flashcard(card_id: str, payload: RateCardRequest, db: Session = Depends(get_db)):
    card = db.query(Flashcard).filter(Flashcard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found.")
    card.rating = payload.rating
    _record_today_activity(db)
    db.commit()
    return {"id": card.id, "rating": card.rating}

@app.post("/api/v1/decks/{deck_id}/quiz-score")
def submit_quiz_score(deck_id: str, payload: SubmitQuizRequest, db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found.")
    deck.last_quiz_score = payload.score_percent
    _record_today_activity(db)
    db.commit()
    return {"id": deck.id, "lastQuizScore": deck.last_quiz_score}

@app.get("/api/v1/grade", response_model=GradeOut)
def get_overall_grade(db: Session = Depends(get_db)):
    decks = db.query(Deck).all()
    cards = db.query(Flashcard).all()
    activities = db.query(StudyActivity).all()
    return compute_grade_telemetry(decks, cards, activities)
