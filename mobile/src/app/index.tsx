import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { SecondaryButton } from '@/components/ui/button';
import { EmptyState, SectionCard } from '@/components/ui/surface';
import { StatusChip } from '@/components/ui/status';
import { Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

function greetingForCurrentTime() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function initialsForEmail(email: string | null | undefined) {
  const localPart = email?.split('@')[0]?.trim();
  if (!localPart) return 'FC';

  const chunks = localPart.split(/[._-]+/).filter(Boolean);
  if (chunks.length >= 2) return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
  return localPart.slice(0, 2).toUpperCase();
}

export default function HomeScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const greeting = useMemo(greetingForCurrentTime, []);
  const initials = initialsForEmail(user?.email);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerIdentity}>
            <BrandMark size="small" />
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: theme.primary }]}>CENTRAL PA WATERSHED</Text>
              <Text style={[styles.greeting, { color: theme.textSecondary }]}>{greeting}</Text>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Field Collection</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Collector account"
            accessibilityState={{ expanded: profileOpen }}
            onPress={() => setProfileOpen((open) => !open)}
            style={({ pressed }) => [
              styles.avatar,
              {
                backgroundColor: pressed ? theme.surfaceSecondary : theme.surface,
                borderColor: theme.border,
              },
            ]}>
            <Text style={[styles.avatarText, { color: theme.primary }]}>{initials}</Text>
          </Pressable>
        </View>

        {profileOpen ? (
          <View
            style={[
              styles.profileCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}>
            <View style={styles.profileCopy}>
              <Text style={[styles.profileLabel, { color: theme.textMuted }]}>COLLECTOR ACCOUNT</Text>
              <Text numberOfLines={1} style={[styles.profileEmail, { color: theme.textPrimary }]}>
                {user?.email ?? 'Signed-in collector'}
              </Text>
            </View>
            <SecondaryButton label="Sign out" icon="signOut" onPress={signOut} />
          </View>
        ) : null}

        <View style={styles.capabilityRow}>
          <StatusChip label="Offline-ready" tone="success" />
          <Text style={[styles.capabilityText, { color: theme.textMuted }]}>
            Sync state stays visible when drafts are connected.
          </Text>
        </View>

        <View style={[styles.newObservation, { backgroundColor: theme.primary }]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroIcon, { backgroundColor: theme.surface }]}>
              <Text style={[styles.heroPlus, { color: theme.primary }]}>+</Text>
            </View>
            <Text style={[styles.heroKicker, { color: theme.background }]}>PRIMARY FIELD ACTION</Text>
          </View>

          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, { color: theme.background }]}>New observation</Text>
            <Text style={[styles.heroBody, { color: theme.background }]}>
              Start a stream visit with site context, GPS, method provenance, and water-quality measurements.
            </Text>
          </View>

          <View style={styles.heroActionArea}>
            <View style={[styles.heroDisabledButton, { backgroundColor: theme.surface }]}>
              <Text style={[styles.heroDisabledLabel, { color: theme.textMuted }]}>Start observation</Text>
            </View>
            <Text style={[styles.heroHelper, { color: theme.background }]}>
              Site catalog connection is the next implementation step.
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeadingRow}>
          <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>Recent submissions</Text>
        </View>

        <SectionCard>
          <EmptyState
            icon="clipboard"
            title="No observations yet"
            body="Drafts and submitted observations will appear here with clear sync and review status."
          />
        </SectionCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headerIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 1,
  },
  eyebrow: {
    ...Typography.eyebrow,
    marginBottom: Spacing.xxs,
  },
  greeting: {
    ...Typography.helper,
  },
  title: {
    ...Typography.screenTitle,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  profileCard: {
    borderWidth: 1,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadows.floating,
  },
  profileCopy: {
    gap: Spacing.xxs,
  },
  profileLabel: {
    ...Typography.eyebrow,
    fontSize: 10,
  },
  profileEmail: {
    ...Typography.bodyStrong,
  },
  capabilityRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  capabilityText: {
    ...Typography.caption,
    flexShrink: 1,
  },
  newObservation: {
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    gap: Spacing.lg,
    overflow: 'hidden',
    ...Shadows.subtle,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlus: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '500',
    marginTop: -2,
  },
  heroKicker: {
    ...Typography.eyebrow,
    opacity: 0.76,
  },
  heroCopy: {
    gap: Spacing.xs,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heroBody: {
    ...Typography.body,
    opacity: 0.86,
    maxWidth: 520,
  },
  heroActionArea: {
    gap: Spacing.xs,
  },
  heroDisabledButton: {
    minHeight: 52,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.74,
  },
  heroDisabledLabel: {
    ...Typography.button,
  },
  heroHelper: {
    ...Typography.caption,
    opacity: 0.72,
  },
  sectionHeadingRow: {
    marginTop: Spacing.xs,
  },
  sectionHeading: {
    ...Typography.sectionTitle,
  },
});
