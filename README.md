# Recalyn

[![Recalyn CI](https://github.com/aftab-exr/recalyn/actions/workflows/ci.yml/badge.svg)](https://github.com/aftab-exr/recalyn/actions/workflows/ci.yml)

Cross-platform React Native (Expo) and Python (FastAPI) study application that converts PDF lecture notes into structured flashcard decks, difficulty-weighted daily quizzes, weak-card review queues, and a composite course grade.

## Architecture

```text
+-----------------------------------+       REST / JSON       +--------------------------------------+
|  React Native (Expo SDK 52+)      | ----------------------> |  FastAPI (Python 3.12)               |
|  - TypeScript                     | <---------------------- |  - PyMuPDF (fitz) page extraction    |
|  - Reanimated 3D card physics     |                         |  - Gemini Structured JSON Outputs    |
|  - Risograph Press token system   |                         |  - SQLAlchemy + SQLite persistence   |
|  - Weak-card active recall queue  |                         |  - Composite GPA & streak engine     |
+-----------------------------------+                         +--------------------------------------+
```

## Resume Highlights & Engineering Decisions

* **Deterministic LLM Structured Outputs:** Integrated `google-genai` (`gemini-3.8-flash` with automatic retry and fallback across `gemini-3.8-flash-lite` and `gemini-2.5-flash-lite`) using `Pydantic v2` response schemas (`GeneratedStudyPack`) to guarantee valid JSON flashcards and 4-option conceptual questions without brittle regex parsing.
* **Page-Bounded PDF Ingestion:** Engineered a `PyMuPDF` extraction pipeline that parses multi-page PDFs with page anchors (`[PAGE N]`) within a 45,000-character budget, supporting both standard multipart uploads and Android `ContentResolver` base64 streams for Expo Go compatibility.
* **Multi-Factor Course Grade Engine:** Implemented a weighted academic scoring algorithm combining difficulty-weighted quiz accuracy (**70%**), self-rated flashcard recall confidence (**20%**), and consecutive daily study streaks (**10%**, capped at +10 points) persisted in SQLite.
* **Cross-Deck Weak Card Active Recall:** Built a targeted review queue filtering flashcards rated `1 (Again)` or `2 (Hard)` across all uploaded decks, snapshotting queue state mid-session to prevent index drift while syncing rating updates to SQLite.
* **Custom Cross-Platform Risograph UI System:** Translated a two-ink print design specification (`Bricolage Grotesque`, `Source Serif 4`, `DM Mono`) into native React Native primitives using dual-layer offset `<View>` plates, SVG halftone dot patterns, and 60fps `Reanimated` 3D card-flip transforms.
* **Automated CI & Containerization:** Configured Docker Compose with persistent SQLite volume mounting and a GitHub Actions CI pipeline running `pytest` against isolated in-memory SQLite fixtures alongside frontend `tsc --noEmit` type checks.

## Repository Structure

```text
.
├── .github/workflows/ci.yml        # GitHub Actions CI (Pytest + TypeScript checks)
├── docker-compose.yml              # Containerized FastAPI + persistent SQLite volume
├── README.md
├── recalyn/                        # Expo React Native client
│   ├── App.tsx
│   └── src/
│       ├── components/RisoPrimitives.tsx
│       ├── config/api.ts
│       ├── screens/
│       │   ├── PressDeskScreen.tsx
│       │   ├── FlashcardDrumScreen.tsx
│       │   └── DailyQuizScreen.tsx
│       ├── theme/risograph.ts
│       └── types/study.ts
└── recalyn-api/                    # FastAPI + SQLite backend
    ├── Dockerfile
    ├── requirements.txt
    ├── tests/
    │   ├── conftest.py
    │   ├── test_api.py
    │   └── test_grade_engine.py
    └── app/
        ├── database.py
        ├── main.py
        ├── models.py
        ├── schemas.py
        └── services/
            ├── ai_service.py
            ├── grade_engine.py
            └── pdf_service.py
```

## API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health check |
| `GET` | `/api/v1/decks` | List all persisted decks, flashcards, and quiz questions |
| `POST` | `/api/v1/decks/ingest` | Upload a PDF (`multipart/form-data`), generate study pack, and persist to SQLite |
| `POST` | `/api/v1/decks/ingest-base64` | Ingest base64-encoded PDF payload from mobile `ContentResolver` streams |
| `DELETE` | `/api/v1/decks/{deck_id}` | Delete a deck and cascade-remove associated cards and questions |
| `PATCH` | `/api/v1/cards/{card_id}/rate` | Record flashcard recall rating (`1–4`) and log daily UTC activity |
| `POST` | `/api/v1/decks/{deck_id}/quiz-score` | Record weighted quiz score (`0–100`) and log daily UTC activity |
| `GET` | `/api/v1/grade` | Compute overall grade, component breakdowns, and active streak |

## Running Locally

### 1. Start the Backend

```bash
cd recalyn-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add your GEMINI_API_KEY in .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or via Docker Compose:

```bash
cp recalyn-api/.env.example recalyn-api/.env
docker compose up --build -d
```

### 2. Run Backend Tests

```bash
cd recalyn-api
pytest -v
```

### 3. Start the React Native Client

```bash
cd recalyn
npx expo start -c
```
