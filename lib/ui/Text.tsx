import React from 'react';
import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { tokens } from '../theme';
import { useResolvedColors } from './theme/ThemeProvider';

export type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'bodyBold' | 'caption' | 'micro';

export type TextColorToken =
  | 'text'
  | 'textSecondary'
  | 'textMuted'
  | 'primary'
  | 'primaryContrast'
  | 'error'
  | 'success'
  | 'live';

export interface TextProps extends Omit<RNTextProps, 'style'> {
  variant?: TextVariant;
  /** Theme token key or explicit color string. Defaults to theme text. */
  color?: TextColorToken | string;
  numberOfLines?: number;
  style?: RNTextProps['style'];
  /** Override accessibility role when needed (e.g. heading for headings). */
  accessibilityRole?: RNTextProps['accessibilityRole'];
  /** Cap font scaling for a11y; pass-through to RN Text. */
  maxFontSizeMultiplier?: number;
}

const variantKeys: TextVariant[] = ['h1', 'h2', 'h3', 'body', 'bodyBold', 'caption', 'micro'];

function getVariantStyle(variant: TextVariant) {
  const v = tokens.typography.variants[variant];
  const scale = tokens.typography.scale;
  if (!v) return {};
  return {
    ...(v.fontFamily ?? scale.fontFamily ? { fontFamily: v.fontFamily ?? scale.fontFamily } : {}),
    fontSize: v.fontSize,
    lineHeight: v.lineHeight,
    fontWeight: v.fontWeight,
    ...(v.letterSpacing !== undefined && { letterSpacing: v.letterSpacing }),
  };
}

export function Text({
  variant = 'body',
  color,
  numberOfLines,
  style,
  accessibilityRole,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  const colors = useResolvedColors();

  const semanticColor =
    color === undefined
      ? colors.text
      : typeof color === 'string' && isColorToken(color)
        ? colors[color as keyof typeof colors]
        : (color as string);

  const variantStyle = getVariantStyle(variant);
  const baseStyle = [
    variantStyle,
    { color: semanticColor },
  ];

  const role = accessibilityRole ?? (variantKeys.slice(0, 3).includes(variant) ? 'header' : undefined);

  return (
    <RNText
      numberOfLines={numberOfLines}
      style={StyleSheet.flatten([baseStyle, style])}
      accessibilityRole={role}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
    />
  );
}

function isColorToken(s: string): s is TextColorToken {
  return [
    'text',
    'textSecondary',
    'textMuted',
    'primary',
    'primaryContrast',
    'error',
    'success',
    'live',
  ].includes(s);
}
