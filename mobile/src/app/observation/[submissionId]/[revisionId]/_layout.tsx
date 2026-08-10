import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function ObservationLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: theme.background },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.textPrimary },
      }}>
      <Stack.Screen name="site" options={{ title: 'Choose site' }} />
      <Stack.Screen name="visit" options={{ title: 'Visit details' }} />
      <Stack.Screen name="method" options={{ title: 'Method & provenance' }} />
      <Stack.Screen name="measurements" options={{ title: 'Measurements' }} />
      <Stack.Screen name="review" options={{ title: 'Review observation' }} />
    </Stack>
  );
}
