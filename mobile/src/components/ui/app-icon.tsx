import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';

import { IconSize } from '@/constants/theme';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

const iconNames = {
  water: { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' },
  location: { ios: 'location.fill', android: 'location_on', web: 'location_on' },
  clipboard: { ios: 'doc.text.fill', android: 'assignment', web: 'assignment' },
  check: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
  sync: { ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' },
  cloud: { ios: 'icloud.fill', android: 'cloud', web: 'cloud' },
  clock: { ios: 'clock.fill', android: 'schedule', web: 'schedule' },
  camera: { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  person: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },
  signOut: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  info: { ios: 'info.circle.fill', android: 'info', web: 'info' },
  gps: { ios: 'location.circle.fill', android: 'gps_fixed', web: 'gps_fixed' },
  science: { ios: 'waveform.path.ecg', android: 'science', web: 'science' },
  retry: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
} satisfies Record<string, SymbolName>;

export type AppIconName = keyof typeof iconNames;

type AppIconProps = {
  name: AppIconName;
  color: string;
  size?: number;
};

export function AppIcon({ name, color, size = IconSize.md }: AppIconProps) {
  return (
    <SymbolView
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      name={iconNames[name]}
      size={size}
      tintColor={color}
    />
  );
}
