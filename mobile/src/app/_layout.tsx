import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { SignInScreen } from '@/components/sign-in-screen';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

function AuthGate() {
  const colorScheme = useColorScheme();
  const theme = useTheme();
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
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
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          animation: 'fade',
        }}
      />
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
