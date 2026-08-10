import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { SignInScreen } from '@/components/sign-in-screen';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { CollectorDataProvider } from '@/providers/collector-data-provider';
import { DraftProvider } from '@/providers/draft-provider';

function AuthGate() {
  const colorScheme = useColorScheme();
  const theme = useTheme();
  const { user, initializing } = useAuth();
  const navigationTheme = useMemo(() => {
    const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: theme.background,
        card: theme.background,
        text: theme.textPrimary,
        border: theme.border,
        primary: theme.primary,
        notification: theme.danger,
      },
    };
  }, [colorScheme, theme]);

  if (initializing) {
    return (
      <View
        accessibilityLabel="Preparing field workspace"
        accessibilityLiveRegion="polite"
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        style={[styles.loading, { backgroundColor: theme.background }]}>
        <BrandMark size="small" />
        <View style={styles.loadingCopy}>
          <Text style={[styles.loadingTitle, { color: theme.textPrimary }]}>Field Collection</Text>
          <Text style={[styles.loadingBody, { color: theme.textSecondary }]}>Preparing field workspace</Text>
        </View>
        <ActivityIndicator color={theme.primary} />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </View>
    );
  }

  if (!user) {
    return (
      <>
        <SignInScreen />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </>
    );
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <CollectorDataProvider uid={user.uid}>
        <DraftProvider>
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: theme.background },
              headerBackButtonDisplayMode: 'minimal',
              headerShadowVisible: false,
              headerStyle: { backgroundColor: theme.background },
              headerTintColor: theme.primary,
              headerTitleStyle: { color: theme.textPrimary },
            }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen
              name="observation/[submissionId]/[revisionId]"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="account"
              options={{ presentation: 'modal', title: 'Collector account' }}
            />
          </Stack>
        </DraftProvider>
      </CollectorDataProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  loadingCopy: {
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  loadingTitle: {
    ...Typography.sectionTitle,
  },
  loadingBody: {
    ...Typography.helper,
  },
});