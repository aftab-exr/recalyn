import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PrintMode, RisoTheme } from '../theme/risograph';
import { FlashcardItem } from '../types/study';
import { HalftoneOverlay, RisoBadge, RisoButton, RisoCard } from '../components/RisoPrimitives';

export interface ReviewQueueCard extends FlashcardItem {
  deckId: string;
  deckTitle?: string;
}

export function FlashcardDrumScreen({
  mode,
  cards,
  sessionLabel,
  onRateCard,
  onBack,
}: {
  mode: PrintMode;
  cards: ReviewQueueCard[];
  sessionLabel?: string;
  onRateCard: (deckId: string, cardId: string, rating: 1 | 2 | 3 | 4) => void;
  onBack: () => void;
}) {
  const t = RisoTheme[mode];
  // Snapshot queue on mount so rating updates in parent state don't shift indices mid-session
  const [queue] = useState<ReviewQueueCard[]>(() => cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const spin = useSharedValue(0);

  if (queue.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background, padding: 20, justifyContent: 'center' }}>
        <RisoCard mode={mode} offset={4}>
          <Text
            style={{
              fontFamily: RisoTheme.fonts.displaySemi,
              fontSize: 20,
              color: t.foreground,
              marginBottom: 8,
            }}
          >
            No weak cards to review
          </Text>
          <Text
            style={{
              fontFamily: RisoTheme.fonts.body,
              fontSize: 16,
              lineHeight: 24,
              color: t.mutedForeground,
              marginBottom: 20,
            }}
          >
            Cards rated Again or Hard during study sessions will appear here.
          </Text>
          <RisoButton label="BACK" mode={mode} variant="primary" onPress={onBack} />
        </RisoCard>
      </View>
    );
  }

  const card = queue[index];

  const handleFlip = () => {
    const next = flipped ? 0 : 1;
    setFlipped(!flipped);
    spin.value = withTiming(next, { duration: 220 });
  };

  const handleRate = (rating: 1 | 2 | 3 | 4) => {
    onRateCard(card.deckId, card.id, rating);
    spin.value = 0;
    setFlipped(false);
    if (index < queue.length - 1) {
      setIndex(index + 1);
    } else {
      onBack();
    }
  };

  const frontAnimStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(spin.value, [0, 1], [0, 180]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
    };
  });

  const backAnimStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(spin.value, [0, 1], [180, 360]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
    };
  });

  return (
    <View style={{ flex: 1, backgroundColor: t.background, padding: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable onPress={onBack}>
          <Text
            style={{
              fontFamily: RisoTheme.fonts.monoMedium,
              fontSize: 13,
              color: t.primary,
              textDecorationLine: 'underline',
            }}
          >
            BACK
          </Text>
        </Pressable>
        <Text style={{ fontFamily: RisoTheme.fonts.monoMedium, fontSize: 12, color: t.foreground }}>
          {sessionLabel ? `${sessionLabel} · ` : ''}
          {index + 1} / {queue.length}
        </Text>
      </View>

      <Pressable onPress={handleFlip} style={{ flex: 1, marginVertical: 24 }}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: t.shadowInk,
              borderRadius: RisoTheme.radius.md,
              transform: [{ translateX: 4 }, { translateY: 4 }],
            },
          ]}
        />

        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            frontAnimStyle,
            {
              backgroundColor: t.card,
              borderColor: t.primary,
              borderWidth: 2,
              borderRadius: RisoTheme.radius.md,
              padding: 24,
              justifyContent: 'space-between',
              overflow: 'hidden',
            },
          ]}
        >
          <HalftoneOverlay mode={mode} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <RisoBadge label={card.tag} mode={mode} tone="secondary" />
            <RisoBadge label={card.difficulty} mode={mode} tone="primary" />
          </View>

          <View>
            {card.deckTitle && (
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: RisoTheme.fonts.mono,
                  fontSize: 11,
                  color: t.mutedForeground,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                {card.deckTitle}
              </Text>
            )}
            <Text
              style={{
                fontFamily: RisoTheme.fonts.display,
                fontSize: 26,
                lineHeight: 33,
                letterSpacing: -0.5,
                color: t.foreground,
              }}
            >
              {card.front}
            </Text>
          </View>

          <Text
            style={{
              fontFamily: RisoTheme.fonts.mono,
              fontSize: 12,
              color: t.mutedForeground,
            }}
          >
            TAP CARD TO FLIP
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            backAnimStyle,
            {
              backgroundColor: t.card,
              borderColor: t.primary,
              borderWidth: 2,
              borderRadius: RisoTheme.radius.md,
              padding: 24,
              justifyContent: 'space-between',
            },
          ]}
        >
          <RisoBadge label="ANSWER" mode={mode} tone="success" />

          <Text
            style={{
              fontFamily: RisoTheme.fonts.body,
              fontSize: 18,
              lineHeight: 28,
              color: t.foreground,
            }}
          >
            {card.back}
          </Text>

          <Text
            style={{
              fontFamily: RisoTheme.fonts.mono,
              fontSize: 12,
              color: t.mutedForeground,
            }}
          >
            SELECT RECALL RATING
          </Text>
        </Animated.View>
      </Pressable>

      {flipped ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <RisoButton label="AGAIN" mode={mode} variant="destructive" style={{ flex: 1 }} onPress={() => handleRate(1)} />
          <RisoButton label="HARD" mode={mode} variant="warning" style={{ flex: 1 }} onPress={() => handleRate(2)} />
          <RisoButton label="GOOD" mode={mode} variant="secondary" style={{ flex: 1 }} onPress={() => handleRate(3)} />
          <RisoButton label="EASY" mode={mode} variant="success" style={{ flex: 1 }} onPress={() => handleRate(4)} />
        </View>
      ) : (
        <RisoButton label="REVEAL ANSWER" mode={mode} variant="primary" onPress={handleFlip} />
      )}
    </View>
  );
}
