import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { PrimaryButton } from '@/components/ui/button';
import { AppScreen } from '@/components/ui/surface';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function DraftGate({ loading }: { loading: boolean }) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <AppScreen edges={['right', 'bottom', 'left']} contentStyle={styles.content}>
      {loading ? (
        <>
          <ActivityIndicator color={theme.primary} />
          <Text style={[styles.title, { color: theme.textPrimary }]}>Restoring draft</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>Loading saved field work.</Text>
        </>
      ) : (
        <>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Draft unavailable</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            This draft is no longer stored on this device. Check recent submissions for its server state.
          </Text>
          <PrimaryButton label="Return to field collection" onPress={() => router.replace('/')} />
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    ...Typography.sectionTitle,
    textAlign: 'center',
  },
  body: {
    ...Typography.body,
    maxWidth: 420,
    textAlign: 'center',
  },
});
