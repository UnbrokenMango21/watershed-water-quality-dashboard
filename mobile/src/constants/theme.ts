import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const Colors = {
  light: {
    background: '#F2F6F7',
    surface: '#FFFFFF',
    surfaceSecondary: '#E7EFF1',
    input: '#FFFFFF',
    textPrimary: '#0A2027',
    textSecondary: '#486168',
    textMuted: '#5E7278',
    border: '#C9D6D9',
    controlBorder: '#7D9298',
    brand: '#123F4A',
    onBrand: '#FFFFFF',
    primary: '#006C75',
    onPrimary: '#FFFFFF',
    primaryPressed: '#00545B',
    primarySoft: '#D9EEF0',
    focus: '#008B95',
    success: '#146C48',
    successSoft: '#DDEFE5',
    warning: '#865900',
    warningSoft: '#F5EACD',
    danger: '#B3261E',
    dangerPressed: '#8C1D18',
    dangerSoft: '#F8E1DF',
    info: '#006C75',
    infoSoft: '#D9EEF0',
    disabledSurface: '#DCE4E6',
    disabledText: '#5E7278',
    secondaryPressed: '#E0E9EB',
    overlay: 'rgba(4, 24, 30, 0.52)',
    text: '#0A2027',
    backgroundElement: '#E7EFF1',
    backgroundSelected: '#E0E9EB',
  },
  dark: {
    background: '#071619',
    surface: '#0E252A',
    surfaceSecondary: '#17343A',
    input: '#0E252A',
    textPrimary: '#F1F7F8',
    textSecondary: '#BED0D4',
    textMuted: '#9CB1B6',
    border: '#345159',
    controlBorder: '#6A858C',
    brand: '#86D2D8',
    onBrand: '#071619',
    primary: '#71D3DA',
    onPrimary: '#071619',
    primaryPressed: '#5DBBC2',
    primarySoft: '#12383E',
    focus: '#71D3DA',
    success: '#7FC99E',
    successSoft: '#17392B',
    warning: '#E2B85E',
    warningSoft: '#3B2E12',
    danger: '#FF9B92',
    dangerPressed: '#FFB1AA',
    dangerSoft: '#412321',
    info: '#71D3DA',
    infoSoft: '#12383E',
    disabledSurface: '#243B40',
    disabledText: '#9CB1B6',
    secondaryPressed: '#244047',
    overlay: 'rgba(0, 0, 0, 0.62)',
    text: '#F1F7F8',
    backgroundElement: '#17343A',
    backgroundSelected: '#244047',
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
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.7,
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
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

export const Shadows = {
  subtle: {},
  floating:
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#071619',
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
