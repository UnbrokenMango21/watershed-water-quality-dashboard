import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const Colors = {
  light: {
    background: '#F2F6F5',
    surface: '#FFFFFF',
    surfaceSecondary: '#E7EFED',
    input: '#FBFCFC',
    textPrimary: '#132C2F',
    textSecondary: '#4C6262',
    textMuted: '#708180',
    border: '#D3DFDC',
    primary: '#0B6870',
    primaryPressed: '#07545B',
    primarySoft: '#DCEEEF',
    success: '#2E704E',
    successSoft: '#E3F2E9',
    warning: '#95630C',
    warningSoft: '#FFF1D4',
    danger: '#A23F3F',
    dangerSoft: '#FAE7E5',
    info: '#356B85',
    infoSoft: '#E2EFF5',
    overlay: 'rgba(13, 37, 39, 0.44)',
    text: '#132C2F',
    backgroundElement: '#E7EFED',
    backgroundSelected: '#D9E6E3',
  },
  dark: {
    background: '#0D1718',
    surface: '#142223',
    surfaceSecondary: '#1C2C2D',
    input: '#172627',
    textPrimary: '#F3F7F6',
    textSecondary: '#B4C3C0',
    textMuted: '#8FA19E',
    border: '#314443',
    primary: '#60C3C8',
    primaryPressed: '#4AAEB4',
    primarySoft: '#183B3E',
    success: '#76C79B',
    successSoft: '#18382A',
    warning: '#F0BE62',
    warningSoft: '#3B2E14',
    danger: '#F29A95',
    dangerSoft: '#3C2323',
    info: '#8BC3DD',
    infoSoft: '#18313D',
    overlay: 'rgba(0, 0, 0, 0.62)',
    text: '#F3F7F6',
    backgroundElement: '#1C2C2D',
    backgroundSelected: '#28403F',
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
  xxxl: 40,
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
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const Typography = {
  eyebrow: {
    fontSize: 11,
    lineHeight: 15,
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
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.15,
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '400',
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  numeric: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

export const Shadows = {
  subtle:
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#071F21',
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 5 },
      },
      android: {
        elevation: 2,
      },
      default: {},
    }) ?? {},
  floating:
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#071F21',
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
