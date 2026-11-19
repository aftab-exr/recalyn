import os
import time
from google import genai
from google.genai import types
from google.genai.errors import APIError
from app.schemas import GeneratedStudyPack

DEFAULT_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.8-flash-lite",
    "gemini-2.5-flash-lite",
]

def _model_candidates() -> list[str]:
    primary = os.getenv("GEMINI_MODEL", "").strip()
    fallbacks_raw = os.getenv("GEMINI_FALLBACK_MODELS", "")
    fallbacks = [m.strip() for m in fallbacks_raw.split(",") if m.strip()]
    ordered = ([primary] if primary else []) + fallbacks + DEFAULT_MODELS
    # Deduplicate while preserving order
    return list(dict.fromkeys(ordered))

def generate_study_pack(pdf_text: str, filename: str) -> GeneratedStudyPack:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing in environment variables.")

    client = genai.Client(api_key=api_key)
    prompt = (
        f"Analyze the following study document ('{filename}') and produce:\n"
        "1. A concise, descriptive deck_title.\n"
        "2. 10 high-yield flashcards covering definitions, mechanisms, and key distinctions.\n"
        "3. 6 conceptual multiple-choice questions for a daily quiz (4 options each, clear explanation).\n"
        "Base every item strictly on the provided document text.\n\n"
        f"DOCUMENT TEXT:\n{pdf_text}"
    )

    last_error: Exception | None = None

    for model_name in _model_candidates():
        for attempt in range(2):  # 2 tries per model with short backoff
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=GeneratedStudyPack,
                        temperature=0.25,
                    ),
                )
                return GeneratedStudyPack.model_validate_json(response.text)
            except APIError as exc:
                last_error = exc
                # Retry/fallback on 503 (high demand), 429 (rate limit), or 404 (model unavailable)
                if exc.code in (404, 429, 503):
                    if attempt == 0 and exc.code in (429, 503):
                        time.sleep(1.5)
                        continue
                    break  # Move to next fallback model
                raise

    raise RuntimeError(f"All Gemini models busy or unavailable: {last_error}")
