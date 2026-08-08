import { StyleSheet, View } from 'react-native';

import { Radii, Shadows } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppIcon } from './ui/app-icon';

type BrandMarkProps = {
  size?: 'small' | 'large';
};

export function BrandMark({ size = 'large' }: BrandMarkProps) {
  const theme = useTheme();
  const dimension = size === 'large' ? 54 : 42;
  const iconSize = size === 'large' ? 25 : 20;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        {
          width: dimension,
          height: dimension,
          borderRadius: size === 'large' ? Radii.lg : Radii.md,
          backgroundColor: theme.primary,
        },
      ]}>
      <View style={[styles.ripple, { borderColor: theme.background }]} />
      <AppIcon name="water" color={theme.background} size={iconSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Shadows.subtle,
  },
  ripple: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    opacity: 0.2,
    transform: [{ translateX: 16 }, { translateY: 16 }],
  },
});
