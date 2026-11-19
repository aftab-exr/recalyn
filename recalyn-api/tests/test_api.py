from unittest.mock import patch
import fitz  # PyMuPDF
from app.schemas import GeneratedFlashcard, GeneratedQuizQuestion, GeneratedStudyPack

def _make_sample_pdf_bytes(text: str) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes

def _mock_study_pack() -> GeneratedStudyPack:
    return GeneratedStudyPack(
        deck_title="Operating Systems Virtual Memory",
        flashcards=[
            GeneratedFlashcard(
                front="What is a Translation Lookaside Buffer (TLB)?",
                back="A hardware cache storing recent virtual-to-physical page table translations.",
                tag="PAGING",
                difficulty="medium",
            ),
            GeneratedFlashcard(
                front="What triggers a page fault?",
                back="Accessing a virtual page whose valid/present bit is cleared in the page table.",
                tag="FAULTS",
                difficulty="easy",
            ),
        ],
        daily_quiz=[
            GeneratedQuizQuestion(
                question="Which component resolves virtual addresses on a TLB miss without OS intervention on x86?",
                options=[
                    "DMA Controller",
                    "Hardware Page Table Walker (MMU)",
                    "Instruction Decoder",
                    "Branch Predictor",
                ],
                correct_index=1,
                explanation="The MMU walks the multi-level page table in physical memory to populate the TLB.",
                weight=1.5,
            )
        ],
    )

def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}

def test_ingest_rejects_non_pdf(client):
    res = client.post(
        "/api/v1/decks/ingest",
        files={"file": ("notes.txt", b"plain text content", "text/plain")},
    )
    assert res.status_code == 400

def test_ingest_rejects_empty_pdf(client):
    blank_pdf = _make_sample_pdf_bytes("short")
    res = client.post(
        "/api/v1/decks/ingest",
        files={"file": ("blank.pdf", blank_pdf, "application/pdf")},
    )
    assert res.status_code == 422

@patch("app.main.generate_study_pack", side_effect=lambda text, fn: _mock_study_pack())
def test_full_deck_lifecycle_ingest_rate_quiz_grade_and_delete(mock_ai, client):
    sample_text = (
        "Virtual memory separates logical memory perceived by processes from physical RAM. "
        "Paging divides virtual address space into fixed-size blocks called pages and physical memory into frames. "
        "The MMU and TLB accelerate address translation."
    )
    pdf_bytes = _make_sample_pdf_bytes(sample_text)

    # 1. Ingest PDF
    ingest_res = client.post(
        "/api/v1/decks/ingest",
        files={"file": ("vm_lecture.pdf", pdf_bytes, "application/pdf")},
    )
    assert ingest_res.status_code == 200
    payload = ingest_res.json()
    assert payload["pages_processed"] == 1
    deck = payload["deck"]
    deck_id = deck["id"]
    card_id = deck["flashcards"][0]["id"]
    assert deck["title"] == "Operating Systems Virtual Memory"
    assert len(deck["flashcards"]) == 2
    assert len(deck["dailyQuiz"]) == 1

    # 2. List decks
    list_res = client.get("/api/v1/decks")
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # 3. Rate flashcard (4 = Easy -> 100% card retention on rated subset)
    rate_res = client.patch(f"/api/v1/cards/{card_id}/rate", json={"rating": 4})
    assert rate_res.status_code == 200
    assert rate_res.json()["rating"] == 4

    # 4. Submit quiz score (100%)
    quiz_res = client.post(f"/api/v1/decks/{deck_id}/quiz-score", json={"score_percent": 100.0})
    assert quiz_res.status_code == 200
    assert quiz_res.json()["lastQuizScore"] == 100.0

    # 5. Verify overall grade calculation:
    # Quiz 100 * 0.70 (70.0) + Cards 100 * 0.20 (20.0) + 1-day streak (2.0) = 92.0 -> A-
    grade_res = client.get("/api/v1/grade")
    assert grade_res.status_code == 200
    grade = grade_res.json()
    assert grade["numericScore"] == 92.0
    assert grade["letterGrade"] == "A-"
    assert grade["streakDays"] == 1

    # 6. Delete deck and confirm cascade removal
    del_res = client.delete(f"/api/v1/decks/{deck_id}")
    assert del_res.status_code == 200
    assert del_res.json() == {"deleted": True, "id": deck_id}
    assert client.get("/api/v1/decks").json() == []
