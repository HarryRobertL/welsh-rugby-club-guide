/**
 * Design token system for Cymru Rugby app.
 * Single source of truth: palettes, glass, elevation, spacing, radius, typography, motion.
 * Use theme / useTheme() for resolved colors; tokens for scales and presets.
 */

// —— Mode & palette types ——
export type ThemeMode = 'dark' | 'light' | 'system';

export interface ColorPalette {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderLight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryContrast: string;
  live: string;
  error: string;
  success: string;
}

// —— Glass surface tokens ——
export interface GlassTokens {
  blur: {
    sm: number;
    md: number;
    lg: number;
  };
  opacity: {
    surface: number;
    overlay: number;
    border: number;
  };
  stroke: {
    default: string;
    subtle: string;
    strong: string;
  };
}

// —— Elevation (shadows) ——
export interface ShadowPreset {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface ElevationTokens {
  none: ShadowPreset;
  sm: ShadowPreset;
  md: ShadowPreset;
  lg: ShadowPreset;
}

// —— Spacing scale ——
export interface SpacingTokens {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

// —— Radius scale ——
export interface RadiusTokens {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
}

// —— Typography scale (raw values) ——
export interface TypographyScale {
  fontFamily: string;
  fontSize: Record<string, number>;
  lineHeight: Record<string, number>;
  letterSpacing: Record<string, number>;
  fontWeight: Record<string, '400' | '500' | '600' | '700'>;
}

export interface TypographyVariantStyle {
  fontFamily?: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  fontWeight: '400' | '500' | '600' | '700';
}

export interface TypographyTokens {
  scale: TypographyScale;
  variants: Record<string, TypographyVariantStyle>;
}

// —— Motion tokens ——
export interface MotionTokens {
  duration: {
    instant: number;
    fast: number;
    normal: number;
    slow: number;
  };
  easing: {
    standard: string;
    enter: string;
    exit: string;
  };
  spring: {
    gentle: { stiffness: number; damping: number };
    snappy: { stiffness: number; damping: number };
    bouncy: { stiffness: number; damping: number };
  };
}

// —— Full token model ——
export interface DesignTokens {
  colors: {
    dark: ColorPalette;
    light: ColorPalette;
  };
  glass: GlassTokens;
  elevation: ElevationTokens;
  spacing: SpacingTokens;
  radius: RadiusTokens;
  typography: TypographyTokens;
  motion: MotionTokens;
}

// —————————————————————————————————————————————————————————————————————————————
// DARK palette (default)
// —————————————————————————————————————————————————————————————————————————————
const darkPalette: ColorPalette = {
  background: '#0E0F11',
  surface: '#16181B',
  surfaceMuted: '#1C1E22',
  border: '#2A2D33',
  borderLight: '#25272C',
  text: '#F2F3F5',
  textSecondary: '#A0A4A8',
  textMuted: '#6B6F76',
  primary: '#0a4d2e',
  primaryContrast: '#ffffff',
  live: '#E53935',
  error: '#E53935',
  success: '#2E7D32',
};

// —————————————————————————————————————————————————————————————————————————————
// LIGHT palette
// —————————————————————————————————————————————————————————————————————————————
const lightPalette: ColorPalette = {
  background: '#f5f5f7',
  surface: '#ffffff',
  surfaceMuted: '#f0f0f2',
  border: '#e5e5e7',
  borderLight: '#eee',
  text: '#1a1a1a',
  textSecondary: '#6b6b6b',
  textMuted: '#888',
  primary: '#0a4d2e',
  primaryContrast: '#ffffff',
  live: '#c00',
  error: '#c00',
  success: '#0a4d2e',
};

// —————————————————————————————————————————————————————————————————————————————
// Glass surface tokens
// —————————————————————————————————————————————————————————————————————————————
const glass: GlassTokens = {
  blur: { sm: 8, md: 12, lg: 20 },
  opacity: { surface: 0.72, overlay: 0.48, border: 0.12 },
  stroke: {
    default: 'rgba(255,255,255,0.12)',
    subtle: 'rgba(255,255,255,0.06)',
    strong: 'rgba(255,255,255,0.18)',
  },
};

// —————————————————————————————————————————————————————————————————————————————
// Elevation shadows (theme-aware shadowColor can be overridden by provider)
// —————————————————————————————————————————————————————————————————————————————
const elevation: ElevationTokens = {
  none: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};

// —————————————————————————————————————————————————————————————————————————————
// Spacing scale
// —————————————————————————————————————————————————————————————————————————————
const spacing: SpacingTokens = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

// —————————————————————————————————————————————————————————————————————————————
// Radius scale
// —————————————————————————————————————————————————————————————————————————————
const radius: RadiusTokens = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// —————————————————————————————————————————————————————————————————————————————
// Typography scale & variants
// —————————————————————————————————————————————————————————————————————————————
const typographyScale: TypographyScale = {
  fontFamily: 'MonaSans',
  fontSize: {
    micro: 10,
    caption: 12,
    body: 15,
    title: 17,
    h3: 18,
    h2: 20,
    h1: 24,
    score: 24,
  },
  lineHeight: {
    micro: 12,
    caption: 16,
    body: 20,
    title: 22,
    h3: 24,
    h2: 26,
    h1: 30,
    score: 28,
  },
  letterSpacing: {
    micro: 0.2,
    caption: 0.1,
    body: 0,
    title: 0,
    h3: -0.2,
    h2: -0.3,
    h1: -0.4,
    score: 0,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

const typography: TypographyTokens = {
  scale: typographyScale,
  variants: {
    h1: {
      fontSize: typographyScale.fontSize.h1,
      lineHeight: typographyScale.lineHeight.h1,
      letterSpacing: typographyScale.letterSpacing.h1,
      fontWeight: '700',
    },
    h2: {
      fontSize: typographyScale.fontSize.h2,
      lineHeight: typographyScale.lineHeight.h2,
      letterSpacing: typographyScale.letterSpacing.h2,
      fontWeight: '700',
    },
    h3: {
      fontSize: typographyScale.fontSize.h3,
      lineHeight: typographyScale.lineHeight.h3,
      letterSpacing: typographyScale.letterSpacing.h3,
      fontWeight: '700',
    },
    body: {
      fontSize: typographyScale.fontSize.body,
      lineHeight: typographyScale.lineHeight.body,
      letterSpacing: typographyScale.letterSpacing.body,
      fontWeight: '400',
    },
    bodyBold: {
      fontSize: typographyScale.fontSize.body,
      lineHeight: typographyScale.lineHeight.body,
      letterSpacing: typographyScale.letterSpacing.body,
      fontWeight: '600',
    },
    caption: {
      fontSize: typographyScale.fontSize.caption,
      lineHeight: typographyScale.lineHeight.caption,
      letterSpacing: typographyScale.letterSpacing.caption,
      fontWeight: '400',
    },
    micro: {
      fontSize: typographyScale.fontSize.micro,
      lineHeight: typographyScale.lineHeight.micro,
      letterSpacing: typographyScale.letterSpacing.micro,
      fontWeight: '400',
    },
    // Legacy aliases used by existing screens (no breaking changes)
    title: {
      fontSize: typographyScale.fontSize.title,
      lineHeight: typographyScale.lineHeight.title,
      fontWeight: '600',
    },
    titleLarge: {
      fontSize: typographyScale.fontSize.h2,
      lineHeight: typographyScale.lineHeight.h2,
      fontWeight: '700',
    },
    sectionTitle: {
      fontSize: typographyScale.fontSize.h3,
      lineHeight: typographyScale.lineHeight.h3,
      fontWeight: '700',
    },
    score: {
      fontSize: typographyScale.fontSize.score,
      lineHeight: typographyScale.lineHeight.score,
      fontWeight: '700',
    },
    bodyStrong: {
      fontSize: typographyScale.fontSize.body,
      lineHeight: typographyScale.lineHeight.body,
      fontWeight: '600',
    },
  },
};

// —————————————————————————————————————————————————————————————————————————————
// Motion tokens
// —————————————————————————————————————————————————————————————————————————————
const motion: MotionTokens = {
  duration: {
    instant: 0,
    fast: 150,
    normal: 250,
    slow: 400,
  },
  easing: {
    standard: 'ease-in-out',
    enter: 'ease-out',
    exit: 'ease-in',
  },
  spring: {
    gentle: { stiffness: 200, damping: 25 },
    snappy: { stiffness: 420, damping: 30 },
    bouncy: { stiffness: 300, damping: 20 },
  },
};

// —————————————————————————————————————————————————————————————————————————————
// Design tokens (single export for token model)
// —————————————————————————————————————————————————————————————————————————————
export const tokens: DesignTokens = {
  colors: { dark: darkPalette, light: lightPalette },
  glass,
  elevation,
  spacing,
  radius,
  typography,
  motion,
};

/** Resolve which palette to use given mode and system preference. */
export function getResolvedPalette(
  mode: ThemeMode,
  systemColorScheme: 'light' | 'dark' | null
): ColorPalette {
  const effective = mode === 'system' ? systemColorScheme ?? 'dark' : mode;
  return effective === 'light' ? tokens.colors.light : tokens.colors.dark;
}

// —————————————————————————————————————————————————————————————————————————————
// Legacy theme export (backward compatible: same shape as before, dark default)
// Existing screens keep using theme.colors, theme.spacing, theme.typography, etc.
// —————————————————————————————————————————————————————————————————————————————
const resolvedDark = getResolvedPalette('dark', null);

export const theme = {
  colors: resolvedDark,
  spacing: tokens.spacing,
  radius: tokens.radius,
  typography: {
    fontFamily: tokens.typography.scale.fontFamily,
    caption: { fontFamily: tokens.typography.scale.fontFamily, fontSize: tokens.typography.variants.caption.fontSize, color: resolvedDark.textSecondary, lineHeight: tokens.typography.variants.caption.lineHeight, fontWeight: tokens.typography.variants.caption.fontWeight },
    body: { fontFamily: tokens.typography.scale.fontFamily, fontSize: tokens.typography.variants.body.fontSize, color: resolvedDark.text, lineHeight: tokens.typography.variants.body.lineHeight, fontWeight: tokens.typography.variants.body.fontWeight },
    bodyStrong: { fontFamily: tokens.typography.scale.fontFamily, fontSize: tokens.typography.variants.bodyBold.fontSize, fontWeight: '600' as const, color: resolvedDark.text, lineHeight: tokens.typography.variants.bodyBold.lineHeight },
    title: { fontFamily: tokens.typography.scale.fontFamily, fontSize: tokens.typography.variants.title.fontSize, fontWeight: '600' as const, color: resolvedDark.text, lineHeight: tokens.typography.variants.title.lineHeight },
    titleLarge: { fontFamily: tokens.typography.scale.fontFamily, fontSize: tokens.typography.variants.titleLarge.fontSize, fontWeight: '700' as const, color: resolvedDark.text, lineHeight: tokens.typography.variants.titleLarge.lineHeight },
    sectionTitle: { fontFamily: tokens.typography.scale.fontFamily, fontSize: tokens.typography.variants.sectionTitle.fontSize, fontWeight: '700' as const, color: resolvedDark.text, lineHeight: tokens.typography.variants.sectionTitle.lineHeight },
    score: { fontFamily: tokens.typography.scale.fontFamily, fontSize: tokens.typography.variants.score.fontSize, fontWeight: '700' as const, color: resolvedDark.text, lineHeight: tokens.typography.variants.score.lineHeight },
  },
  card: {
    backgroundColor: resolvedDark.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: resolvedDark.border,
    overflow: 'hidden' as const,
    padding: tokens.spacing.lg,
  },
  cardShadow: tokens.elevation.sm,
} as const;
