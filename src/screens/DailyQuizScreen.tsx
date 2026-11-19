import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { PrintMode, RisoTheme } from '../theme/risograph';
import { QuizQuestionItem, StudyDeck } from '../types/study';
import { RisoBadge, RisoButton, RisoCard } from '../components/RisoPrimitives';

const SECONDS_PER_QUESTION = 30;

interface ShuffledQuestion extends QuizQuestionItem {
  shuffledOptions: string[];
  shuffledCorrectIndex: number;
}

function shuffleQuizQuestions(questions: QuizQuestionItem[]): ShuffledQuestion[] {
  return questions.map((q) => {
    const indexed = q.options.map((text, idx) => ({
      text,
      isCorrect: idx === q.correct_index,
    }));

    // Fisher-Yates shuffle
    for (let i = indexed.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
    }

    return {
      ...q,
      shuffledOptions: indexed.map((item) => item.text),
      shuffledCorrectIndex: indexed.findIndex((item) => item.isCorrect),
    };
  });
}

export function DailyQuizScreen({
  mode,
  deck,
  onFinishQuiz,
  onBack,
}: {
  mode: PrintMode;
  deck: StudyDeck;
  onFinishQuiz: (deckId: string, scorePercent: number) => void;
  onBack: () => void;
}) {
  const t = RisoTheme[mode];

  const [questions] = useState<ShuffledQuestion[]>(() =>
    shuffleQuizQuestions(deck.dailyQuiz)
  );
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SECONDS_PER_QUESTION);
  const [earnedWeight, setEarnedWeight] = useState(0);
  const [totalWeight, setTotalWeight] = useState(0);
  const [completed, setCompleted] = useState(false);

  const q = questions[qIndex];
  const isAnswered = selected !== null || timedOut;
  const isCorrect = selected === q.shuffledCorrectIndex;

  // Per-question countdown timer
  useEffect(() => {
    if (completed || isAnswered) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimedOut(true);
          setTotalWeight((w) => w + q.weight);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [qIndex, completed, isAnswered, q.weight]);

  const handleSelect = (optIdx: number) => {
    if (isAnswered) return;
    setSelected(optIdx);
    setTotalWeight((prev) => prev + q.weight);
    if (optIdx === q.shuffledCorrectIndex) {
      setEarnedWeight((prev) => prev + q.weight);
    }
  };

  const handleNext = () => {
    if (qIndex < questions.length - 1) {
      setQIndex(qIndex + 1);
      setSelected(null);
      setTimedOut(false);
      setSecondsLeft(SECONDS_PER_QUESTION);
    } else {
      const pct = Math.round((earnedWeight / Math.max(totalWeight, 1)) * 100);
      onFinishQuiz(deck.id, pct);
      setCompleted(true);
    }
  };

  if (completed) {
    const finalPct = Math.round((earnedWeight / Math.max(totalWeight, 1)) * 100);
    return (
      <View style={{ flex: 1, backgroundColor: t.background, padding: 20, justifyContent: 'center' }}>
        <RisoCard mode={mode} offset={4} halftone>
          <RisoBadge label="QUIZ COMPLETE" mode={mode} tone="success" />
          <Text
            style={{
              fontFamily: RisoTheme.fonts.display,
              fontSize: 48,
              lineHeight: 54,
              color: t.foreground,
              marginTop: 12,
            }}
          >
            {finalPct}%
          </Text>
          <Text
            style={{
              fontFamily: RisoTheme.fonts.body,
              fontSize: 17,
              lineHeight: 25,
              color: t.foreground,
              marginTop: 8,
              marginBottom: 20,
            }}
          >
            Score recorded for {deck.title}.
          </Text>
          <RisoButton label="DONE" mode={mode} variant="primary" onPress={onBack} />
        </RisoCard>
      </View>
    );
  }

  const timerProgressPct = Math.max(0, (secondsLeft / SECONDS_PER_QUESTION) * 100);
  const timerColor =
    secondsLeft <= 5 ? t.destructive : secondsLeft <= 10 ? t.warning : t.primary;
  const formattedSeconds = `00:${String(secondsLeft).padStart(2, '0')}`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
    >
      {/* Top Status Row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Pressable onPress={onBack}>
          <Text
            style={{
              fontFamily: RisoTheme.fonts.monoMedium,
              fontSize: 13,
              color: t.primary,
              textDecorationLine: 'underline',
            }}
          >
            EXIT
          </Text>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontFamily: RisoTheme.fonts.monoMedium, fontSize: 12, color: t.foreground }}>
            {qIndex + 1} / {questions.length} · {q.weight}X
          </Text>
          <View
            style={{
              borderWidth: 1.5,
              borderColor: timerColor,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: RisoTheme.radius.sm,
              backgroundColor: secondsLeft <= 5 ? t.destructive : t.card,
            }}
          >
            <Text
              style={{
                fontFamily: RisoTheme.fonts.monoMedium,
                fontSize: 12,
                color: secondsLeft <= 5 ? t.destructiveForeground : t.foreground,
              }}
            >
              {formattedSeconds}
            </Text>
          </View>
        </View>
      </View>

      {/* Risograph Two-Ink Timer Bar */}
      <View
        style={{
          height: 6,
          backgroundColor: t.muted,
          borderWidth: 1,
          borderColor: t.primary,
          marginBottom: 16,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${timerProgressPct}%`,
            backgroundColor: timerColor,
          }}
        />
      </View>

      <RisoCard mode={mode} offset={4}>
        <Text
          style={{
            fontFamily: RisoTheme.fonts.displaySemi,
            fontSize: 21,
            lineHeight: 27,
            color: t.foreground,
          }}
        >
          {q.question}
        </Text>
      </RisoCard>

      <View style={{ marginTop: 20, gap: 12 }}>
        {q.shuffledOptions.map((option, idx) => {
          let bg = t.card;
          let fg = t.foreground;
          let border = t.primary;

          if (isAnswered) {
            if (idx === q.shuffledCorrectIndex) {
              bg = t.success;
              fg = t.successForeground;
              border = t.foreground;
            } else if (idx === selected) {
              bg = t.destructive;
              fg = t.destructiveForeground;
              border = t.foreground;
            }
          }

          return (
            <Pressable key={idx} onPress={() => handleSelect(idx)}>
              <View
                style={{
                  backgroundColor: bg,
                  borderColor: border,
                  borderWidth: 2,
                  borderRadius: RisoTheme.radius.md,
                  padding: 16,
                  flexDirection: 'row',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: RisoTheme.fonts.monoMedium,
                    fontSize: 13,
                    color: fg,
                  }}
                >
                  {String.fromCharCode(65 + idx)}.
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: RisoTheme.fonts.body,
                    fontSize: 16,
                    lineHeight: 22,
                    color: fg,
                  }}
                >
                  {option}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {isAnswered && (
        <View style={{ marginTop: 20 }}>
          <RisoCard mode={mode} offset={4}>
            <RisoBadge
              label={timedOut ? 'TIME EXPIRED' : isCorrect ? 'CORRECT' : 'INCORRECT'}
              mode={mode}
              tone={isCorrect ? 'success' : 'destructive'}
            />
            <Text
              style={{
                fontFamily: RisoTheme.fonts.body,
                fontSize: 16,
                lineHeight: 24,
                color: t.foreground,
                marginTop: 10,
                marginBottom: 16,
              }}
            >
              {q.explanation}
            </Text>
            <RisoButton
              label={qIndex < questions.length - 1 ? 'NEXT' : 'FINISH'}
              mode={mode}
              variant="primary"
              onPress={handleNext}
            />
          </RisoCard>
        </View>
      )}
    </ScrollView>
  );
}
