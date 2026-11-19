import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { PrintMode, RisoTheme } from '../theme/risograph';

export function HalftoneOverlay({ mode = 'light' }: { mode?: PrintMode }) {
  const t = RisoTheme[mode];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={`risoDots-${mode}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <Circle cx="1.5" cy="1.5" r="1" fill={t.dotInk} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#risoDots-${mode})`} />
      </Svg>
    </View>
  );
}

export function RisoCard({
  children,
  mode = 'light',
  offset = 4,
  style,
  halftone = false,
}: {
  children: React.ReactNode;
  mode?: PrintMode;
  offset?: 2 | 4 | 8;
  style?: ViewStyle;
  halftone?: boolean;
}) {
  const t = RisoTheme[mode];
  return (
    <View style={[{ position: 'relative', marginRight: offset, marginBottom: offset }, style]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: t.shadowInk,
            borderRadius: RisoTheme.radius.md,
            transform: [{ translateX: offset }, { translateY: offset }],
          },
        ]}
      />
      <View
        style={{
          backgroundColor: t.card,
          borderColor: t.primary,
          borderWidth: 2,
          borderRadius: RisoTheme.radius.md,
          padding: 20,
          overflow: 'hidden',
        }}
      >
        {halftone && <HalftoneOverlay mode={mode} />}
        {children}
      </View>
    </View>
  );
}

export function RisoButton({
  label,
  onPress,
  mode = 'light',
  variant = 'primary',
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  mode?: PrintMode;
  variant?: 'primary' | 'secondary' | 'outline' | 'success' | 'destructive' | 'warning';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const t = RisoTheme[mode];

  const palette = {
    primary: { bg: t.primary, fg: t.primaryForeground, border: t.primary, shadow: true },
    secondary: { bg: t.secondary, fg: t.secondaryForeground, border: t.secondaryForeground, shadow: false },
    outline: { bg: 'transparent', fg: t.primary, border: t.primary, shadow: false },
    success: { bg: t.success, fg: t.successForeground, border: t.foreground, shadow: false },
    destructive: { bg: t.destructive, fg: t.destructiveForeground, border: t.foreground, shadow: false },
    warning: { bg: t.warning, fg: t.warningForeground, border: t.foreground, shadow: false },
  }[variant];

  return (
    <Pressable disabled={disabled} onPress={onPress} style={style}>
      {({ pressed }) => (
        <View style={{ position: 'relative', marginRight: 2, marginBottom: 2, opacity: disabled ? 0.45 : 1 }}>
          {palette.shadow && !pressed && !disabled && (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: t.shadowInk,
                  borderRadius: RisoTheme.radius.md,
                  transform: [{ translateX: 2 }, { translateY: 2 }],
                },
              ]}
            />
          )}
          <View
            style={{
              height: 44,
              paddingHorizontal: 16,
              backgroundColor: palette.bg,
              borderColor: palette.border,
              borderWidth: 2,
              borderRadius: RisoTheme.radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              transform: pressed && !disabled ? [{ translateX: 2 }, { translateY: 2 }] : [],
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: RisoTheme.fonts.monoMedium,
                fontSize: 12,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: palette.fg,
              }}
            >
              {label}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function RisoBadge({
  label,
  mode = 'light',
  tone = 'primary',
}: {
  label: string;
  mode?: PrintMode;
  tone?: 'primary' | 'success' | 'warning' | 'destructive' | 'secondary';
}) {
  const t = RisoTheme[mode];
  const map = {
    primary: { bg: t.primary, fg: t.primaryForeground },
    secondary: { bg: t.secondary, fg: t.secondaryForeground },
    success: { bg: t.success, fg: t.successForeground },
    warning: { bg: t.warning, fg: t.warningForeground },
    destructive: { bg: t.destructive, fg: t.destructiveForeground },
  }[tone];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: map.bg,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: RisoTheme.radius.sm,
      }}
    >
      <Text
        style={{
          fontFamily: RisoTheme.fonts.monoMedium,
          fontSize: 11,
          letterSpacing: 0.7,
          textTransform: 'uppercase',
          color: map.fg,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function FolioDivider({
  folio,
  title,
  mode = 'light',
}: {
  folio: string;
  title: string;
  mode?: PrintMode;
}) {
  const t = RisoTheme[mode];
  return (
    <View style={{ marginTop: 24, marginBottom: 16 }}>
      <View style={{ height: 2, backgroundColor: t.primary, marginBottom: 8 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text
          style={{
            fontFamily: RisoTheme.fonts.monoMedium,
            fontSize: 12,
            letterSpacing: 0.8,
            color: t.primary,
          }}
        >
          FOLIO {folio}
        </Text>
        <Text
          style={{
            fontFamily: RisoTheme.fonts.mono,
            fontSize: 12,
            letterSpacing: 0.8,
            color: t.mutedForeground,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </Text>
      </View>
    </View>
  );
}
