import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const Colors = {
  light: {
    background: '#F5F2E8',
    surface: '#FFFDF8',
    surfaceSecondary: '#E7ECE6',
    input: '#FFFDF8',
    textPrimary: '#172321',
    textSecondary: '#4E5E5B',
    textMuted: '#5B6B68',
    border: '#C9D0CA',
    controlBorder: '#7A8985',
    brand: '#24503F',
    onBrand: '#F5F2E8',
    primary: '#0B6268',
    onPrimary: '#FFFFFF',
    primaryPressed: '#074C51',
    primarySoft: '#DCEBED',
    focus: '#0B6268',
    success: '#276749',
    successSoft: '#E1EFE6',
    warning: '#8A5A00',
    warningSoft: '#F6EACB',
    danger: '#B42318',
    dangerPressed: '#8F1C13',
    dangerSoft: '#F8E3DF',
    info: '#0B6268',
    infoSoft: '#DCEBED',
    disabledSurface: '#D9DEDA',
    disabledText: '#5B6B68',
    secondaryPressed: '#E1E6E1',
    overlay: 'rgba(23, 35, 33, 0.44)',
    motif: 'rgba(11, 98, 104, 0.04)',
    text: '#172321',
    backgroundElement: '#E7ECE6',
    backgroundSelected: '#E1E6E1',
  },
  dark: {
    background: '#101918',
    surface: '#182522',
    surfaceSecondary: '#21312D',
    input: '#182522',
    textPrimary: '#F5F2E8',
    textSecondary: '#C5D0CB',
    textMuted: '#A8B5B0',
    border: '#3C504A',
    controlBorder: '#71867F',
    brand: '#8DC6A8',
    onBrand: '#101918',
    primary: '#78CDD0',
    onPrimary: '#101918',
    primaryPressed: '#6AB7BB',
    primarySoft: '#183438',
    focus: '#78CDD0',
    success: '#8DC6A8',
    successSoft: '#1D392C',
    warning: '#E1B75A',
    warningSoft: '#3A2D12',
    danger: '#F0968C',
    dangerPressed: '#F3AAA2',
    dangerSoft: '#402321',
    info: '#78CDD0',
    infoSoft: '#183438',
    disabledSurface: '#2A3935',
    disabledText: '#A8B5B0',
    secondaryPressed: '#2A3935',
    overlay: 'rgba(0, 0, 0, 0.62)',
    motif: 'rgba(120, 205, 208, 0.035)',
    text: '#F5F2E8',
    backgroundElement: '#21312D',
    backgroundSelected: '#2A3935',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'system-ui',
    serif: 'serif',
    rounded: 'system-ui',
    mono: 'ui-monospace',
  },
});

export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radii = {
  sm: 8,
  md: 8,
  lg: 10,
  xl: 16,
  input: 8,
  record: 10,
  sheet: 16,
  pill: 999,
} as const;

export const Typography = {
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.35,
  },
  screenTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.45,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  body: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400',
  },
  bodyStrong: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  helper: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  numeric: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

export const Shadows = {
  subtle: {},
  floating:
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#172321',
        shadowOpacity: 0.12,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 4,
      },
      default: {},
    }) ?? {},
} as const;

export const IconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export const MinTouchTarget = 48;
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 680;
