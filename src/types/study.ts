export interface FlashcardItem {
  id: string;
  front: string;
  back: string;
  tag: string;
  difficulty: 'easy' | 'medium' | 'hard';
  rating?: 1 | 2 | 3 | 4;
}

export interface QuizQuestionItem {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  weight: number;
}

export interface StudyDeck {
  id: string;
  title: string;
  pagesProcessed: number;
  createdAt: string;
  flashcards: FlashcardItem[];
  dailyQuiz: QuizQuestionItem[];
  lastQuizScore?: number;
}

export interface GradeTelemetry {
  numericScore: number | null;
  letterGrade: string;
  quizMastery: number | null;
  flashcardRetention: number | null;
  consistencyBonus: number;
}

export function computeStreakDays(activityDates: string[]): number {
  if (activityDates.length === 0) return 0;
  const unique = Array.from(new Set(activityDates)).sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  if (unique[0] !== today && unique[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 0; i < unique.length - 1; i++) {
    const curr = new Date(unique[i]).getTime();
    const prev = new Date(unique[i + 1]).getTime();
    if (Math.round((curr - prev) / 86_400_000) === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function calculateOverallGrade(decks: StudyDeck[], streakDays: number): GradeTelemetry {
  const quizScores = decks
    .map((d) => d.lastQuizScore)
    .filter((s): s is number => s !== undefined);

  const ratedCards = decks
    .flatMap((d) => d.flashcards)
    .filter((c) => c.rating !== undefined);

  if (quizScores.length === 0 && ratedCards.length === 0) {
    return {
      numericScore: null,
      letterGrade: '--',
      quizMastery: null,
      flashcardRetention: null,
      consistencyBonus: 0,
    };
  }

  const quizMastery =
    quizScores.length > 0
      ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length
      : 0;

  const flashcardRetention =
    ratedCards.length > 0
      ? (ratedCards.reduce((sum, c) => sum + (c.rating || 0), 0) / (ratedCards.length * 4)) * 100
      : 0;

  const consistencyBonus = Math.min(streakDays * 2, 10);
  const numericScore = Number(
    (quizMastery * 0.7 + flashcardRetention * 0.2 + consistencyBonus).toFixed(1)
  );

  let letterGrade = 'D';
  if (numericScore >= 93) letterGrade = 'A';
  else if (numericScore >= 90) letterGrade = 'A-';
  else if (numericScore >= 87) letterGrade = 'B+';
  else if (numericScore >= 83) letterGrade = 'B';
  else if (numericScore >= 80) letterGrade = 'B-';
  else if (numericScore >= 70) letterGrade = 'C';

  return {
    numericScore,
    letterGrade,
    quizMastery: quizScores.length > 0 ? Number(quizMastery.toFixed(1)) : null,
    flashcardRetention: ratedCards.length > 0 ? Number(flashcardRetention.toFixed(1)) : null,
    consistencyBonus,
  };
}

export const INITIAL_DECKS: StudyDeck[] = [];
