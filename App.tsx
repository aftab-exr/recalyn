import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StatusBar, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  SourceSerif4_400Regular,
  SourceSerif4_600SemiBold,
} from '@expo-google-fonts/source-serif-4';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';

import {
  deleteDeckApi,
  fetchDecks,
  fetchGrade,
  syncCardRating,
  syncQuizScore,
} from './src/config/api';
import { PrintMode, RisoTheme } from './src/theme/risograph';
import {
  calculateOverallGrade,
  GradeTelemetry,
  INITIAL_DECKS,
  StudyDeck,
} from './src/types/study';
import { PressDeskScreen } from './src/screens/PressDeskScreen';
import { FlashcardDrumScreen, ReviewQueueCard } from './src/screens/FlashcardDrumScreen';
import { DailyQuizScreen } from './src/screens/DailyQuizScreen';

type ActiveRoute =
  | { name: 'desk' }
  | { name: 'flashcards'; deckId: string; tag?: string }
  | { name: 'weak-cards' }
  | { name: 'quiz'; deckId: string };

export default function App() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_800ExtraBold,
    SourceSerif4_400Regular,
    SourceSerif4_600SemiBold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  const [mode, setMode] = useState<PrintMode>('light');
  const [decks, setDecks] = useState<StudyDeck[]>(INITIAL_DECKS);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [serverGrade, setServerGrade] = useState<GradeTelemetry | null>(null);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [route, setRoute] = useState<ActiveRoute>({ name: 'desk' });

  const t = RisoTheme[mode];

  const loadFromBackend = useCallback(async () => {
    try {
      setBackendError(null);
      const [remoteDecks, remoteGrade] = await Promise.all([fetchDecks(), fetchGrade()]);
      setDecks(remoteDecks);
      setStreakDays(remoteGrade.streakDays);
      setServerGrade({
        numericScore: remoteGrade.numericScore,
        letterGrade: remoteGrade.letterGrade,
        quizMastery: remoteGrade.quizMastery,
        flashcardRetention: remoteGrade.flashcardRetention,
        consistencyBonus: remoteGrade.consistencyBonus,
      });
    } catch (err: any) {
      setBackendError(err.message || 'Cannot reach FastAPI backend.');
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    loadFromBackend();
  }, [loadFromBackend]);

  const grade = useMemo(
    () => serverGrade ?? calculateOverallGrade(decks, streakDays),
    [serverGrade, decks, streakDays]
  );

  const weakCards = useMemo<ReviewQueueCard[]>(
    () =>
      decks.flatMap((d) =>
        d.flashcards
          .filter((c) => c.rating === 1 || c.rating === 2)
          .map((c) => ({ ...c, deckId: d.id, deckTitle: d.title }))
      ),
    [decks]
  );

  if (!fontsLoaded) return null;

  const refreshGradeOnly = async () => {
    const updatedGrade = await fetchGrade();
    setStreakDays(updatedGrade.streakDays);
    setServerGrade({
      numericScore: updatedGrade.numericScore,
      letterGrade: updatedGrade.letterGrade,
      quizMastery: updatedGrade.quizMastery,
      flashcardRetention: updatedGrade.flashcardRetention,
      consistencyBonus: updatedGrade.consistencyBonus,
    });
  };

  const handleDeleteDeck = async (deckId: string) => {
    const previousDecks = decks;
    setDecks((prev) => prev.filter((d) => d.id !== deckId));
    setServerGrade(null);

    try {
      await deleteDeckApi(deckId);
      await refreshGradeOnly();
    } catch (err: any) {
      setDecks(previousDecks);
      Alert.alert('Delete Error', err.message || 'Failed to delete deck.');
    }
  };

  const handleRateCard = async (deckId: string, cardId: string, rating: 1 | 2 | 3 | 4) => {
    setDecks((prev) =>
      prev.map((d) =>
        d.id !== deckId
          ? d
          : {
              ...d,
              flashcards: d.flashcards.map((c) => (c.id === cardId ? { ...c, rating } : c)),
            }
      )
    );
    setServerGrade(null);

    try {
      await syncCardRating(cardId, rating);
      await refreshGradeOnly();
    } catch (err: any) {
      Alert.alert('Sync Error', err.message || 'Failed to save flashcard rating.');
    }
  };

  const handleFinishQuiz = async (deckId: string, scorePercent: number) => {
    setDecks((prev) =>
      prev.map((d) => (d.id === deckId ? { ...d, lastQuizScore: scorePercent } : d))
    );
    setServerGrade(null);

    try {
      await syncQuizScore(deckId, scorePercent);
      await refreshGradeOnly();
    } catch (err: any) {
      Alert.alert('Sync Error', err.message || 'Failed to save quiz score.');
    }
  };

  const activeDeck =
    route.name === 'flashcards' || route.name === 'quiz'
      ? decks.find((d) => d.id === route.deckId) || decks[0]
      : undefined;

  const deckReviewCards: ReviewQueueCard[] =
    route.name === 'flashcards' && activeDeck
      ? activeDeck.flashcards
          .filter(
            (c) =>
              !route.tag ||
              c.tag.trim().toLowerCase() === route.tag.trim().toLowerCase()
          )
          .map((c) => ({ ...c, deckId: activeDeck.id }))
      : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }}>
      <StatusBar barStyle={mode === 'light' ? 'dark-content' : 'light-content'} />

      <View
        style={{
          height: 56,
          paddingHorizontal: 20,
          borderBottomWidth: 2,
          borderBottomColor: t.primary,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: t.background,
        }}
      >
        <Text
          style={{
            fontFamily: RisoTheme.fonts.display,
            fontSize: 20,
            letterSpacing: -0.5,
            color: t.foreground,
          }}
        >
          Recalyn
        </Text>

        <Pressable
          onPress={() => setMode((m) => (m === 'light' ? 'dark' : 'light'))}
          style={{
            borderWidth: 2,
            borderColor: t.primary,
            backgroundColor: t.secondary,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: RisoTheme.radius.md,
          }}
        >
          <Text
            style={{
              fontFamily: RisoTheme.fonts.monoMedium,
              fontSize: 11,
              color: t.secondaryForeground,
            }}
          >
            {mode === 'light' ? 'DARK' : 'LIGHT'}
          </Text>
        </Pressable>
      </View>

      {route.name === 'desk' && (
        <PressDeskScreen
          mode={mode}
          decks={decks}
          grade={grade}
          streakDays={streakDays}
          loadingInitial={loadingInitial}
          backendError={backendError}
          onRefresh={loadFromBackend}
          onAddDeck={(newDeck) => setDecks((prev) => [newDeck, ...prev])}
          onDeleteDeck={handleDeleteDeck}
          onOpenFlashcards={(deckId, tag) =>
            setRoute({ name: 'flashcards', deckId, tag })
          }
          onOpenWeakCards={() => setRoute({ name: 'weak-cards' })}
          onOpenQuiz={(deckId) => setRoute({ name: 'quiz', deckId })}
        />
      )}

      {route.name === 'flashcards' && activeDeck && (
        <FlashcardDrumScreen
          mode={mode}
          cards={deckReviewCards}
          sessionLabel={route.tag ? `#${route.tag.toUpperCase()}` : undefined}
          onRateCard={handleRateCard}
          onBack={() => setRoute({ name: 'desk' })}
        />
      )}

      {route.name === 'weak-cards' && (
        <FlashcardDrumScreen
          mode={mode}
          cards={weakCards}
          sessionLabel="WEAK CARDS"
          onRateCard={handleRateCard}
          onBack={() => setRoute({ name: 'desk' })}
        />
      )}

      {route.name === 'quiz' && activeDeck && (
        <DailyQuizScreen
          mode={mode}
          deck={activeDeck}
          onFinishQuiz={handleFinishQuiz}
          onBack={() => setRoute({ name: 'desk' })}
        />
      )}
    </SafeAreaView>
  );
}
