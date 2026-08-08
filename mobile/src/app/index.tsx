import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/auth-provider';

export default function HomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headingBlock}>
            <Text style={styles.eyebrow}>CENTRAL PA WATERSHED</Text>
            <Text style={styles.title}>Field Collection</Text>
            <Text style={styles.subtitle}>Signed in as {user?.email ?? 'collector'}</Text>
          </View>

          <Pressable accessibilityRole="button" onPress={signOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>New observation</Text>
          <Text style={styles.cardText}>
            Site selection, GPS capture, measurements, and offline draft storage are the next build step.
          </Text>
          <Pressable accessibilityRole="button" disabled style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Start observation</Text>
          </Pressable>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Submissions</Text>
          <Text style={styles.statusText}>No submissions loaded yet.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f7f8',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: 22,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 18,
  },
  headingBlock: {
    flex: 1,
    gap: 5,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: '#35626f',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#13272d',
  },
  subtitle: {
    fontSize: 14,
    color: '#65757a',
  },
  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c6d3d7',
    backgroundColor: '#ffffff',
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#29434a',
  },
  card: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 22,
    gap: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#13272d',
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#5b6b70',
  },
  primaryButton: {
    marginTop: 8,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#9cb8bd',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  statusCard: {
    borderRadius: 18,
    backgroundColor: '#e8f0f2',
    padding: 20,
    gap: 6,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#233a41',
  },
  statusText: {
    fontSize: 14,
    color: '#66777c',
  },
});
