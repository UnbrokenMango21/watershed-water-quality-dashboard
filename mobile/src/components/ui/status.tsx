import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppIcon, type AppIconName } from './app-icon';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

type StatusChipProps = {
  label: string;
  tone?: StatusTone;
};

export function StatusChip({ label, tone = 'neutral' }: StatusChipProps) {
  const theme = useTheme();
  const palette = {
    neutral: { background: theme.surfaceSecondary, foreground: theme.textSecondary },
    info: { background: theme.infoSoft, foreground: theme.info },
    success: { background: theme.successSoft, foreground: theme.success },
    warning: { background: theme.warningSoft, foreground: theme.warning },
    danger: { background: theme.dangerSoft, foreground: theme.danger },
  }[tone];

  return (
    <View style={[styles.chip, { backgroundColor: palette.background }]}>
      <Text style={[styles.chipText, { color: palette.foreground }]}>{label}</Text>
    </View>
  );
}

export type SubmissionStatus =
  | 'DRAFT'
  | 'SAVED_LOCALLY'
  | 'SYNCING'
  | 'SYNCED'
  | 'SUBMITTED'
  | 'VALIDATING'
  | 'PENDING_REVIEW'
  | 'NEEDS_CORRECTION'
  | 'APPROVED'
  | 'PUBLISHED';

const submissionStatusMeta: Record<SubmissionStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SAVED_LOCALLY: { label: 'Saved locally', tone: 'info' },
  SYNCING: { label: 'Syncing', tone: 'info' },
  SYNCED: { label: 'Synced', tone: 'success' },
  SUBMITTED: { label: 'Submitted', tone: 'info' },
  VALIDATING: { label: 'Validating', tone: 'info' },
  PENDING_REVIEW: { label: 'Pending review', tone: 'warning' },
  NEEDS_CORRECTION: { label: 'Needs correction', tone: 'danger' },
  APPROVED: { label: 'Approved', tone: 'success' },
  PUBLISHED: { label: 'Published', tone: 'success' },
};

export function SubmissionStatusChip({ status }: { status: SubmissionStatus }) {
  const meta = submissionStatusMeta[status];
  return <StatusChip label={meta.label} tone={meta.tone} />;
}

export type SyncState = 'saved-locally' | 'syncing' | 'synced' | 'failed';

type SyncStatusProps = {
  status: SyncState;
  onRetry?: () => void;
};

export function SyncStatus({ status, onRetry }: SyncStatusProps) {
  const theme = useTheme();
  const meta: Record<SyncState, { label: string; icon: AppIconName; color: string }> = {
    'saved-locally': { label: 'Saved locally', icon: 'clipboard', color: theme.info },
    syncing: { label: 'Syncing', icon: 'sync', color: theme.info },
    synced: { label: 'Synced', icon: 'check', color: theme.success },
    failed: { label: "Couldn't sync", icon: 'warning', color: theme.danger },
  };
  const current = meta[status];

  return (
    <View accessibilityLiveRegion="polite" style={styles.syncRow}>
      <AppIcon name={current.icon} color={current.color} size={16} />
      <Text style={[styles.syncText, { color: current.color }]}>{current.label}</Text>
      {status === 'failed' && onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={8}>
          <Text style={[styles.retryText, { color: theme.primary }]}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type InlineAlertProps = {
  tone: Exclude<StatusTone, 'neutral'>;
  title: string;
  body?: string;
};

export function InlineAlert({ tone, title, body }: InlineAlertProps) {
  const theme = useTheme();
  const palette = {
    info: { background: theme.infoSoft, foreground: theme.info, icon: 'info' as const },
    success: { background: theme.successSoft, foreground: theme.success, icon: 'check' as const },
    warning: { background: theme.warningSoft, foreground: theme.warning, icon: 'warning' as const },
    danger: { background: theme.dangerSoft, foreground: theme.danger, icon: 'warning' as const },
  }[tone];

  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      style={[styles.alert, { backgroundColor: palette.background }]}>
      <AppIcon name={palette.icon} color={palette.foreground} size={18} />
      <View style={styles.alertText}>
        <Text style={[styles.alertTitle, { color: theme.textPrimary }]}>{title}</Text>
        {body ? <Text style={[styles.alertBody, { color: theme.textSecondary }]}>{body}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 28,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  chipText: {
    ...Typography.caption,
    fontWeight: '700',
  },
  syncRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  syncText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  retryText: {
    ...Typography.caption,
    fontWeight: '700',
  },
  alert: {
    borderRadius: Radii.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  alertText: {
    flex: 1,
    gap: Spacing.xxs,
  },
  alertTitle: {
    ...Typography.label,
  },
  alertBody: {
    ...Typography.helper,
  },
});
