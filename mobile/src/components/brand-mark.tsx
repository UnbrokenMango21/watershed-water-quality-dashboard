import { StyleSheet, View } from 'react-native';

import { Radii, Shadows } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type BrandMarkProps = {
  size?: 'small' | 'large';
};

export function BrandMark({ size = 'large' }: BrandMarkProps) {
  const theme = useTheme();
  const dimension = size === 'large' ? 54 : 42;
  const scale = size === 'large' ? 1 : 0.8;

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
          backgroundColor: theme.brand,
        },
      ]}>
      <View style={[styles.glyph, { transform: [{ scale }] }]}>
        <View style={[styles.mainStem, { backgroundColor: theme.onBrand }]} />
        <View style={[styles.leftBranch, { backgroundColor: theme.onBrand }]} />
        <View style={[styles.rightBranch, { backgroundColor: theme.onBrand }]} />
        <View style={[styles.outflow, { borderColor: theme.onBrand }]} />
      </View>
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
  glyph: {
    width: 30,
    height: 30,
    position: 'relative',
    alignItems: 'center',
  },
  mainStem: {
    position: 'absolute',
    width: 3,
    height: 22,
    top: 4,
    left: 14,
    borderRadius: 2,
  },
  leftBranch: {
    position: 'absolute',
    width: 3,
    height: 14,
    top: 5,
    left: 9,
    borderRadius: 2,
    transform: [{ rotate: '-42deg' }],
  },
  rightBranch: {
    position: 'absolute',
    width: 3,
    height: 14,
    top: 5,
    right: 8,
    borderRadius: 2,
    transform: [{ rotate: '42deg' }],
  },
  outflow: {
    position: 'absolute',
    width: 12,
    height: 5,
    left: 9,
    bottom: 1,
    borderBottomWidth: 2,
    borderRadius: 999,
  },
});
