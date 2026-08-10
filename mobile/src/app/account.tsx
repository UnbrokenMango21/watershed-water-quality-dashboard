import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { DestructiveButton } from '@/components/ui/button';
import { AppScreen } from '@/components/ui/surface';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

export default function AccountScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  function confirmSignOut() {
    Alert.alert(
      'Sign out of field collection?',
      'Locally saved drafts remain on this device for this collector account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await signOut();
            } catch {
              setBusy(false);
              Alert.alert('Could not sign out', 'Check your connection and try again.');
            }
          },
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Collector account' }} />
      <AppScreen edges={['right', 'bottom', 'left']} contentStyle={styles.content}>
        <View style={styles.identity}>
          <BrandMark />
          <View style={styles.identityCopy}>
            <Text style={[styles.eyebrow, { color: theme.brand }]}>SIGNED-IN COLLECTOR</Text>
            <Text selectable style={[styles.email, { color: theme.textPrimary }]}>
              {user?.email ?? 'Collector account'}
            </Text>
            <Text style={[styles.helper, { color: theme.textSecondary }]}>
              Drafts are isolated to this account on this device.
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.signOutSection}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Session</Text>
          <Text style={[styles.helper, { color: theme.textSecondary }]}>
            Sign out when this device will be used by another collector.
          </Text>
          <DestructiveButton
            accessibilityHint="Ends this collector session on this device"
            icon="signOut"
            label="Sign out"
            loading={busy}
            loadingLabel="Signing out"
            onPress={confirmSignOut}
          />
        </View>
      </AppScreen>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.xl,
    gap: Spacing.xl,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  identityCopy: {
    flex: 1,
    gap: Spacing.xs,
  },
  eyebrow: {
    ...Typography.eyebrow,
  },
  email: {
    ...Typography.sectionTitle,
  },
  helper: {
    ...Typography.helper,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  signOutSection: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
  },
});
