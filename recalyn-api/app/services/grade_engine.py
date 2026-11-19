from datetime import datetime, timedelta, timezone
from app.models import Deck, Flashcard, StudyActivity
from app.schemas import GradeOut

def compute_streak(activities: list[StudyActivity]) -> int:
    if not activities:
        return 0
    dates = sorted({a.activity_date for a in activities}, reverse=True)
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)

    latest = datetime.strptime(dates[0], "%Y-%m-%d").date()
    if latest != today and latest != yesterday:
        return 0

    streak = 1
    for i in range(len(dates) - 1):
        curr = datetime.strptime(dates[i], "%Y-%m-%d").date()
        prev = datetime.strptime(dates[i + 1], "%Y-%m-%d").date()
        if (curr - prev).days == 1:
            streak += 1
        else:
            break
    return streak

def compute_grade_telemetry(
    decks: list[Deck],
    cards: list[Flashcard],
    activities: list[StudyActivity],
) -> GradeOut:
    streak_days = compute_streak(activities)
    quiz_scores = [d.last_quiz_score for d in decks if d.last_quiz_score is not None]
    rated_cards = [c.rating for c in cards if c.rating is not None]

    if not quiz_scores and not rated_cards:
        return GradeOut(
            numericScore=None,
            letterGrade="--",
            quizMastery=None,
            flashcardRetention=None,
            consistencyBonus=0.0,
            streakDays=streak_days,
        )

    quiz_mastery = (sum(quiz_scores) / len(quiz_scores)) if quiz_scores else 0.0
    flashcard_retention = (
        (sum(rated_cards) / (len(rated_cards) * 4)) * 100 if rated_cards else 0.0
    )
    consistency_bonus = min(float(streak_days * 2), 10.0)

    numeric_score = round((quiz_mastery * 0.70) + (flashcard_retention * 0.20) + consistency_bonus, 1)

    if numeric_score >= 93:
        letter = "A"
    elif numeric_score >= 90:
        letter = "A-"
    elif numeric_score >= 87:
        letter = "B+"
    elif numeric_score >= 83:
        letter = "B"
    elif numeric_score >= 80:
        letter = "B-"
    elif numeric_score >= 70:
        letter = "C"
    else:
        letter = "D"

    return GradeOut(
        numericScore=numeric_score,
        letterGrade=letter,
        quizMastery=round(quiz_mastery, 1) if quiz_scores else None,
        flashcardRetention=round(flashcard_retention, 1) if rated_cards else None,
        consistencyBonus=consistency_bonus,
        streakDays=streak_days,
    )
