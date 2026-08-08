import { signInWithEmailAndPassword } from '@react-native-firebase/auth';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { auth } from '@/lib/firebase';

function friendlyAuthError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (code === 'auth/user-disabled') return 'This collector account is disabled.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email or password is incorrect.';
  }
  if (code === 'auth/network-request-failed') return 'Network unavailable. Check your connection and try again.';
  return 'Sign in failed. Please try again.';
}

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setErrorMessage('Email and password are required.');
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      setErrorMessage(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <View style={styles.card}>
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>CENTRAL PA WATERSHED</Text>
            <Text style={styles.title}>Field Collection</Text>
            <Text style={styles.subtitle}>Sign in with your collector account.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!busy}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="collector@example.org"
                returnKeyType="next"
                style={styles.input}
                textContentType="username"
                value={email}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="current-password"
                editable={!busy}
                onChangeText={setPassword}
                onSubmitEditing={handleSignIn}
                placeholder="Password"
                returnKeyType="go"
                secureTextEntry
                style={styles.input}
                textContentType="password"
                value={password}
              />
            </View>

            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={handleSignIn}
              style={({ pressed }) => [styles.button, pressed && !busy && styles.buttonPressed, busy && styles.buttonDisabled]}>
              {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Sign in</Text>}
            </Pressable>
          </View>

          <Text style={styles.footer}>Collector access only. Scientific data is synchronized securely through Firebase.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f7f8',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    gap: 28,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  heading: {
    gap: 7,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#35626f',
  },
  title: {
    fontSize: 31,
    fontWeight: '700',
    color: '#13272d',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: '#5b6b70',
  },
  form: {
    gap: 18,
  },
  field: {
    gap: 7,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#253b42',
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#ccd7da',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#13272d',
    backgroundColor: '#ffffff',
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: '#9b2c2c',
  },
  button: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: '#176b78',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.62,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    fontSize: 12,
    lineHeight: 18,
    color: '#738186',
  },
});
