from datetime import datetime, timedelta, timezone
from app.models import Deck, Flashcard, StudyActivity
from app.services.grade_engine import compute_grade_telemetry, compute_streak

def _utc_day_str(days_ago: int) -> str:
    return (datetime.now(timezone.utc).date() - timedelta(days=days_ago)).strftime("%Y-%m-%d")

def test_compute_streak_empty():
    assert compute_streak([]) == 0

def test_compute_streak_consecutive_including_today():
    activities = [
        StudyActivity(activity_date=_utc_day_str(0)),
        StudyActivity(activity_date=_utc_day_str(1)),
        StudyActivity(activity_date=_utc_day_str(2)),
        StudyActivity(activity_date=_utc_day_str(2)),  # duplicate date ignored
    ]
    assert compute_streak(activities) == 3

def test_compute_streak_active_yesterday_still_valid():
    activities = [
        StudyActivity(activity_date=_utc_day_str(1)),
        StudyActivity(activity_date=_utc_day_str(2)),
    ]
    assert compute_streak(activities) == 2

def test_compute_streak_broken_when_gap_exceeds_one_day():
    activities = [
        StudyActivity(activity_date=_utc_day_str(2)),
        StudyActivity(activity_date=_utc_day_str(3)),
    ]
    assert compute_streak(activities) == 0

def test_grade_telemetry_ungraded_returns_null_and_placeholder():
    deck = Deck(id="d1", title="Test", filename="test.pdf", pages_processed=5, last_quiz_score=None)
    card = Flashcard(id="c1", deck_id="d1", front="Q", back="A", tag="T", difficulty="easy", rating=None)
    result = compute_grade_telemetry([deck], [card], [])

    assert result.numericScore is None
    assert result.letterGrade == "--"
    assert result.quizMastery is None
    assert result.flashcardRetention is None
    assert result.consistencyBonus == 0.0

def test_grade_telemetry_weighted_composite_and_streak_cap():
    decks = [
        Deck(id="d1", title="D1", filename="a.pdf", pages_processed=4, last_quiz_score=90.0),
        Deck(id="d2", title="D2", filename="b.pdf", pages_processed=6, last_quiz_score=80.0),
    ]
    # Average quiz mastery = 85.0 -> 85.0 * 0.70 = 59.5
    cards = [
        Flashcard(id="c1", deck_id="d1", front="Q1", back="A1", tag="T", difficulty="easy", rating=4),
        Flashcard(id="c2", deck_id="d1", front="Q2", back="A2", tag="T", difficulty="easy", rating=2),
    ]
    # Card retention = (6 / 8) * 100 = 75.0 -> 75.0 * 0.20 = 15.0
    # 7 consecutive days -> 7 * 2 = 14.0 -> capped at 10.0
    activities = [StudyActivity(activity_date=_utc_day_str(i)) for i in range(7)]

    # Expected total: 59.5 + 15.0 + 10.0 = 84.5 -> Letter Grade "B"
    result = compute_grade_telemetry(decks, cards, activities)

    assert result.quizMastery == 85.0
    assert result.flashcardRetention == 75.0
    assert result.consistencyBonus == 10.0
    assert result.streakDays == 7
    assert result.numericScore == 84.5
    assert result.letterGrade == "B"
