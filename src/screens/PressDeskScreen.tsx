import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ingestPdfFile } from '../config/api';
import { PrintMode, RisoTheme } from '../theme/risograph';
import { GradeTelemetry, StudyDeck } from '../types/study';
import { FolioDivider, RisoBadge, RisoButton, RisoCard } from '../components/RisoPrimitives';

export function PressDeskScreen({
  mode,
  decks,
  grade,
  streakDays,
  loadingInitial,
  backendError,
  onRefresh,
  onAddDeck,
  onDeleteDeck,
  onOpenFlashcards,
  onOpenWeakCards,
  onOpenQuiz,
}: {
  mode: PrintMode;
  decks: StudyDeck[];
  grade: GradeTelemetry;
  streakDays: number;
  loadingInitial: boolean;
  backendError: string | null;
  onRefresh: () => Promise<void>;
  onAddDeck: (deck: StudyDeck) => void;
  onDeleteDeck: (deckId: string) => Promise<void>;
  onOpenFlashcards: (deckId: string, tag?: string) => void;
  onOpenWeakCards: () => void;
  onOpenQuiz: (deckId: string) => void;
}) {
  const t = RisoTheme[mode];
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const weakCardCount = useMemo(
    () =>
      decks.reduce(
        (total, d) =>
          total + d.flashcards.filter((c) => c.rating === 1 || c.rating === 2).length,
        0
      ),
    [decks]
  );

  const filteredDecks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter(
      (deck) =>
        deck.title.toLowerCase().includes(q) ||
        deck.flashcards.some((card) => card.tag.toLowerCase().includes(q))
    );
  }, [decks, searchQuery]);

  const handleToggleTagFilter = (tag: string) => {
    setSearchQuery((prev) =>
      prev.trim().toLowerCase() === tag.toLowerCase() ? '' : tag
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handlePickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setUploading(true);

      const persistedDeck = await ingestPdfFile(asset.uri, asset.name || 'document.pdf');
      onAddDeck(persistedDeck);
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Unable to process PDF.');
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = (deck: StudyDeck) => {
    Alert.alert(
      'Delete Deck',
      `Remove "${deck.title}" and all associated flashcards and quiz scores?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteDeck(deck.id),
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={t.primary} />
      }
    >
      {backendError && (
        <View style={{ marginBottom: 12 }}>
          <RisoCard mode={mode} offset={2}>
            <RisoBadge label="API CONNECTION ERROR" mode={mode} tone="destructive" />
            <Text
              style={{
                fontFamily: RisoTheme.fonts.mono,
                fontSize: 12,
                color: t.foreground,
                marginTop: 8,
              }}
            >
              {backendError}
            </Text>
          </RisoCard>
        </View>
      )}

      <FolioDivider folio="01" title="OVERALL GRADE" mode={mode} />

      <RisoCard mode={mode} offset={4} halftone>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <RisoBadge
              label={streakDays > 0 ? `STREAK ${streakDays}D` : 'NO ACTIVE STREAK'}
              mode={mode}
              tone="secondary"
            />
            <Text
              style={{
                fontFamily: RisoTheme.fonts.display,
                fontSize: 48,
                lineHeight: 54,
                letterSpacing: -1.5,
                color: t.foreground,
                marginTop: 12,
              }}
            >
              {grade.numericScore !== null ? `${grade.numericScore}%` : '--'}
            </Text>
          </View>

          <View
            style={{
              backgroundColor: t.primary,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: RisoTheme.radius.md,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: RisoTheme.fonts.monoMedium,
                fontSize: 11,
                color: t.primaryForeground,
                letterSpacing: 0.8,
              }}
            >
              GRADE
            </Text>
            <Text
              style={{
                fontFamily: RisoTheme.fonts.display,
                fontSize: 32,
                lineHeight: 36,
                color: t.primaryForeground,
              }}
            >
              {grade.letterGrade}
            </Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: t.border, marginVertical: 14 }} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: RisoTheme.fonts.mono, fontSize: 12, color: t.foreground }}>
            QUIZ: {grade.quizMastery !== null ? `${grade.quizMastery}%` : '--'}
          </Text>
          <Text style={{ fontFamily: RisoTheme.fonts.mono, fontSize: 12, color: t.foreground }}>
            CARDS: {grade.flashcardRetention !== null ? `${grade.flashcardRetention}%` : '--'}
          </Text>
          <Text style={{ fontFamily: RisoTheme.fonts.mono, fontSize: 12, color: t.foreground }}>
            STREAK: +{grade.consistencyBonus}
          </Text>
        </View>
      </RisoCard>

      <View style={{ marginTop: 16, gap: 10 }}>
        {uploading ? (
          <RisoCard mode={mode} offset={4}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <ActivityIndicator color={t.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: RisoTheme.fonts.monoMedium, fontSize: 12, color: t.foreground }}>
                  PROCESSING PDF...
                </Text>
                <Text style={{ fontFamily: RisoTheme.fonts.body, fontSize: 14, color: t.mutedForeground }}>
                  Extracting text and generating flashcards and quiz questions.
                </Text>
              </View>
            </View>
          </RisoCard>
        ) : (
          <RisoButton
            label="+ IMPORT PDF"
            mode={mode}
            variant="primary"
            onPress={handlePickPdf}
          />
        )}

        {weakCardCount > 0 && (
          <RisoButton
            label={`REVIEW WEAK CARDS (${weakCardCount})`}
            mode={mode}
            variant="secondary"
            onPress={onOpenWeakCards}
          />
        )}
      </View>

      <FolioDivider
        folio="02"
        title={
          searchQuery.trim()
            ? `STUDY DECKS (${filteredDecks.length} OF ${decks.length})`
            : `STUDY DECKS (${decks.length})`
        }
        mode={mode}
      />

      {decks.length > 0 && (
        <View style={{ position: 'relative', marginBottom: 16, marginRight: searchFocused ? 4 : 0 }}>
          {searchFocused && (
            <View
              style={{
                position: 'absolute',
                top: 4,
                left: 4,
                right: -4,
                bottom: -4,
                backgroundColor: t.secondary,
                borderRadius: RisoTheme.radius.md,
              }}
            />
          )}
          <View
            style={{
              height: 44,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: t.card,
              borderWidth: 2,
              borderColor: searchFocused ? t.primary : t.input,
              borderRadius: RisoTheme.radius.md,
              paddingHorizontal: 14,
            }}
          >
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Filter by deck title or topic tag..."
              placeholderTextColor={t.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={{
                flex: 1,
                fontFamily: RisoTheme.fonts.body,
                fontSize: 16,
                color: t.foreground,
                paddingVertical: 0,
              }}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={8}
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  backgroundColor: t.muted,
                  borderRadius: RisoTheme.radius.sm,
                  marginLeft: 8,
                }}
              >
                <Text
                  style={{
                    fontFamily: RisoTheme.fonts.monoMedium,
                    fontSize: 11,
                    color: t.foreground,
                  }}
                >
                  CLEAR
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {loadingInitial ? (
        <RisoCard mode={mode} offset={4}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color={t.primary} />
            <Text style={{ fontFamily: RisoTheme.fonts.mono, fontSize: 12, color: t.foreground }}>
              LOADING SAVED DECKS...
            </Text>
          </View>
        </RisoCard>
      ) : decks.length === 0 ? (
        <RisoCard mode={mode} offset={4}>
          <Text
            style={{
              fontFamily: RisoTheme.fonts.displaySemi,
              fontSize: 20,
              color: t.foreground,
              marginBottom: 6,
            }}
          >
            No study decks yet
          </Text>
          <Text
            style={{
              fontFamily: RisoTheme.fonts.body,
              fontSize: 16,
              lineHeight: 24,
              color: t.mutedForeground,
            }}
          >
            Import a PDF document above to generate flashcards and a daily quiz.
          </Text>
        </RisoCard>
      ) : filteredDecks.length === 0 ? (
        <RisoCard mode={mode} offset={4}>
          <Text
            style={{
              fontFamily: RisoTheme.fonts.displaySemi,
              fontSize: 18,
              color: t.foreground,
              marginBottom: 4,
            }}
          >
            No matching decks
          </Text>
          <Text
            style={{
              fontFamily: RisoTheme.fonts.body,
              fontSize: 15,
              lineHeight: 22,
              color: t.mutedForeground,
            }}
          >
            No study decks or flashcard tags matched "{searchQuery.trim()}".
          </Text>
        </RisoCard>
      ) : (
        filteredDecks.map((deck) => {
          const deckWeakCount = deck.flashcards.filter(
            (c) => c.rating === 1 || c.rating === 2
          ).length;

          const uniqueTags = Array.from(
            new Set(deck.flashcards.map((c) => c.tag.trim()).filter(Boolean))
          );

          const normalizedQuery = searchQuery.trim().toLowerCase();
          const matchedTag = normalizedQuery
            ? uniqueTags.find((tag) => tag.toLowerCase() === normalizedQuery)
            : undefined;
          const matchedTagCount = matchedTag
            ? deck.flashcards.filter(
                (c) => c.tag.trim().toLowerCase() === matchedTag.toLowerCase()
              ).length
            : 0;

          return (
            <View key={deck.id} style={{ marginBottom: 16 }}>
              <RisoCard mode={mode} offset={4}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                    <RisoBadge
                      label={`${deck.pagesProcessed} PAGES · ${deck.flashcards.length} CARDS`}
                      mode={mode}
                      tone="primary"
                    />
                    {deck.lastQuizScore !== undefined && deck.lastQuizScore !== null && (
                      <RisoBadge
                        label={`QUIZ ${deck.lastQuizScore}%`}
                        mode={mode}
                        tone={deck.lastQuizScore >= 80 ? 'success' : 'warning'}
                      />
                    )}
                    {deckWeakCount > 0 && (
                      <RisoBadge
                        label={`${deckWeakCount} WEAK`}
                        mode={mode}
                        tone="destructive"
                      />
                    )}
                  </View>

                  <Pressable
                    onPress={() => confirmDelete(deck)}
                    hitSlop={8}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderWidth: 1,
                      borderColor: t.destructive,
                      borderRadius: RisoTheme.radius.sm,
                      marginLeft: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: RisoTheme.fonts.monoMedium,
                        fontSize: 11,
                        color: t.destructive,
                      }}
                    >
                      DELETE
                    </Text>
                  </Pressable>
                </View>

                <Text
                  style={{
                    fontFamily: RisoTheme.fonts.display,
                    fontSize: 22,
                    lineHeight: 27,
                    letterSpacing: -0.4,
                    color: t.foreground,
                    marginTop: 4,
                    marginBottom: uniqueTags.length > 0 ? 12 : 16,
                  }}
                >
                  {deck.title}
                </Text>

                {uniqueTags.length > 0 && (
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 6,
                      marginBottom: 16,
                    }}
                  >
                    {uniqueTags.map((tag) => {
                      const isActive =
                        searchQuery.trim().toLowerCase() === tag.toLowerCase();
                      return (
                        <Pressable
                          key={tag}
                          onPress={() => handleToggleTagFilter(tag)}
                          hitSlop={4}
                        >
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: RisoTheme.radius.sm,
                              borderWidth: 1,
                              borderColor: isActive ? t.primary : t.border,
                              backgroundColor: isActive ? t.primary : t.muted,
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: RisoTheme.fonts.monoMedium,
                                fontSize: 11,
                                letterSpacing: 0.6,
                                textTransform: 'uppercase',
                                color: isActive ? t.primaryForeground : t.foreground,
                              }}
                            >
                              #{tag}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <RisoButton
                    label={
                      matchedTag
                        ? `STUDY #${matchedTag} (${matchedTagCount})`
                        : 'FLASHCARDS'
                    }
                    mode={mode}
                    variant="secondary"
                    style={{ flex: 1 }}
                    onPress={() => onOpenFlashcards(deck.id, matchedTag)}
                  />
                  <RisoButton
                    label="DAILY QUIZ"
                    mode={mode}
                    variant="primary"
                    style={{ flex: 1 }}
                    onPress={() => onOpenQuiz(deck.id)}
                  />
                </View>
              </RisoCard>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
