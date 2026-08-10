import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import {
  ScrollView,
  Platform,
  StyleSheet,
  Text,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { MaxContentWidth, Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppIcon, type AppIconName } from './app-icon';

type AppScreenProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
  edges?: Edge[];
  refreshControl?: ReactElement<RefreshControlProps>;
}>;

export function AppScreen({
  children,
  contentStyle,
  scroll = true,
  edges = ['top', 'right', 'bottom', 'left'],
  refreshControl,
}: AppScreenProps) {
  const theme = useTheme();

  if (!scroll) {
    return (
      <SafeAreaView edges={edges} style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={[styles.content, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, contentStyle]}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

type SectionCardProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  accessory?: ReactNode;
  style?: StyleProp<ViewStyle>;
}>;

export function SectionCard({ title, subtitle, accessory, style, children }: SectionCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: theme.surface, borderColor: theme.border },
        style,
      ]}>
      {title || subtitle || accessory ? (
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            {title ? <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{title}</Text> : null}
            {subtitle ? (
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
            ) : null}
          </View>
          {accessory}
        </View>
      ) : null}
      {children}
    </View>
  );
}

type InfoCardProps = {
  icon: AppIconName;
  title: string;
  body: string;
};

export function InfoCard({ icon, title, body }: InfoCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.infoCard, { backgroundColor: theme.surfaceSecondary }]}>
      <View style={[styles.infoIcon, { backgroundColor: theme.surface }]}>
        <AppIcon name={icon} color={theme.primary} />
      </View>
      <View style={styles.infoText}>
        <Text style={[styles.infoTitle, { color: theme.textPrimary }]}>{title}</Text>
        <Text style={[styles.infoBody, { color: theme.textSecondary }]}>{body}</Text>
      </View>
    </View>
  );
}

type EmptyStateProps = {
  icon: AppIconName;
  title: string;
  body: string;
};

export function EmptyState({ icon, title, body }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
        <AppIcon name={icon} color={theme.primary} size={24} />
      </View>
      <View style={styles.emptyText}>
        <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>{title}</Text>
        <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  sectionCard: {
    borderRadius: Radii.record,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  sectionHeading: {
    flex: 1,
    gap: Spacing.xxs,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
  },
  sectionSubtitle: {
    ...Typography.helper,
  },
  infoCard: {
    borderRadius: Radii.input,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    gap: Spacing.xxs,
    paddingTop: 1,
  },
  infoTitle: {
    ...Typography.label,
  },
  infoBody: {
    ...Typography.helper,
  },
  emptyState: {
    minHeight: 148,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    alignItems: 'center',
    gap: Spacing.xxs,
    maxWidth: 320,
  },
  emptyTitle: {
    ...Typography.bodyStrong,
    textAlign: 'center',
  },
  emptyBody: {
    ...Typography.helper,
    textAlign: 'center',
  },
});
