import { StyleSheet, Text, View } from 'react-native';

import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenIntroProps = {
  eyebrow?: string;
  title: string;
  body?: string;
};

export function ScreenIntro({ eyebrow, title, body }: ScreenIntroProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: theme.brand }]}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
        {title}
      </Text>
      {body ? <Text style={[styles.body, { color: theme.textSecondary }]}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  eyebrow: {
    ...Typography.eyebrow,
  },
  title: {
    ...Typography.screenTitle,
  },
  body: {
    ...Typography.body,
  },
});
