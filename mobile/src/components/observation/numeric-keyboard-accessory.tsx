import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { MinTouchTarget, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const numericKeyboardAccessoryId = 'observation-numeric-keyboard';

export function NumericKeyboardAccessory({ onNext }: { onNext?: () => void }) {
  const theme = useTheme();
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={numericKeyboardAccessoryId}>
      <View style={[styles.toolbar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !onNext }}
          disabled={!onNext}
          onPress={onNext}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: pressed ? theme.secondaryPressed : 'transparent' },
          ]}>
          <Text style={[styles.label, { color: onNext ? theme.primary : theme.disabledText }]}>Next</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => Keyboard.dismiss()}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: pressed ? theme.secondaryPressed : 'transparent' },
          ]}>
          <Text style={[styles.label, { color: theme.primary }]}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    minHeight: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  action: {
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  label: {
    ...Typography.label,
  },
});
