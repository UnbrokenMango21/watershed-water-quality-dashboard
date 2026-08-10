import { signInWithEmailAndPassword } from '@react-native-firebase/auth';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { AppIcon } from '@/components/ui/app-icon';
import { PrimaryButton } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { InlineAlert } from '@/components/ui/status';
import { MaxContentWidth, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { trackProductEvent, trackScreenView } from '@/services/analytics';

function friendlyAuthError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (code === 'auth/user-disabled') return 'This collector account is disabled.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email or password is incorrect.';
  }
  if (code === 'auth/network-request-failed') return 'Network unavailable. Check your connection and try again.';
  if (code === 'auth/too-many-requests') return 'Too many sign-in attempts. Wait a moment and try again.';
  if (code === 'auth/operation-not-allowed') {
    return 'Email/password sign-in is unavailable for this project. Contact the data administrator.';
  }
  return 'Sign in failed. Please try again.';
}

export function SignInScreen() {
  const theme = useTheme();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    void trackScreenView('sign_in');
  }, []);

  async function handleSignIn() {
    const trimmedEmail = email.trim();
    const nextEmailError = !trimmedEmail
      ? 'Enter your collector email.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
        ? 'Enter a valid email address.'
        : null;
    const nextPasswordError = password ? null : 'Enter your password.';

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setErrorMessage(null);

    if (nextEmailError || nextPasswordError) {
      void AccessibilityInfo.announceForAccessibility(
        nextEmailError ?? nextPasswordError ?? 'Complete the required sign-in fields.',
      );
      if (nextEmailError) emailRef.current?.focus();
      else passwordRef.current?.focus();
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      void trackProductEvent('collector_sign_in');
    } catch (error) {
      const message = friendlyAuthError(error);
      setErrorMessage(message);
      void AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        style={styles.keyboardView}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brandSection}>
            <BrandMark />
            <View style={styles.brandCopy}>
              <Text style={[styles.eyebrow, { color: theme.primary }]}>CENTRAL PA WATERSHED</Text>
              <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>Field Collection</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Reliable water-quality observations, captured where the work happens.
              </Text>
            </View>
          </View>

          <View style={styles.form}>
            <TextField
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!busy}
              keyboardType="email-address"
              label="Email"
              error={emailError}
              inputRef={emailRef}
              onChangeText={(value) => {
                setEmail(value);
                setEmailError(null);
                setErrorMessage(null);
              }}
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder="collector@example.org"
              requirement="required"
              returnKeyType="next"
              textContentType="username"
              value={email}
            />

            <TextField
              autoCapitalize="none"
              autoComplete="current-password"
              editable={!busy}
              inputRef={passwordRef}
              label="Password"
              error={passwordError}
              onChangeText={(value) => {
                setPassword(value);
                setPasswordError(null);
                setErrorMessage(null);
              }}
              onSubmitEditing={handleSignIn}
              placeholder="Enter password"
              requirement="required"
              returnKeyType="go"
              secureTextEntry
              textContentType="password"
              value={password}
            />

            {errorMessage ? <InlineAlert tone="danger" title={errorMessage} /> : null}

            <PrimaryButton
              accessibilityHint="Signs in to the field collection workspace"
              label="Sign in"
              loading={busy}
              loadingLabel="Signing in"
              onPress={handleSignIn}
            />
          </View>

          <View style={styles.footer}>
            <AppIcon name="lock" color={theme.textSecondary} size={15} />
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Collector access only · Sign-in is required to protect field records.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: Math.min(MaxContentWidth, 520),
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.xl,
    gap: Spacing.xxl,
  },
  brandSection: {
    gap: Spacing.lg,
  },
  brandCopy: {
    gap: Spacing.xs,
  },
  eyebrow: {
    ...Typography.eyebrow,
  },
  title: {
    ...Typography.screenTitle,
  },
  subtitle: {
    ...Typography.body,
    maxWidth: 430,
  },
  form: {
    gap: Spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  footerText: {
    ...Typography.caption,
    flex: 1,
  },
});
