import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FintoApiError } from '@finto/api-client';
import { useAuth } from '../src/lib/auth';
import { Alert, Button, T } from '../src/components/UI';
import { colors, font, radius, space } from '../src/lib/theme';

export default function Login() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = useState('sofia@marengo.studio');
  const [password, setPassword] = useState('sofia2026-finto');
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(identifier.trim(), password);
    } catch (err) {
      setError(
        err instanceof FintoApiError
          ? err.message
          : 'We could not reach Finto. Check your connection and try again.'
      );
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 40, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.mark}>
            <T weight="extrabold" size={20} color={colors.forest}>F</T>
          </View>
          <T weight="extrabold" size={30} style={{ marginTop: 22, letterSpacing: -1.2 }}>
            Welcome back
          </T>
          <T size={14.5} color={colors.muted} style={{ marginTop: 4 }}>
            Sign in to your Finto account.
          </T>
        </View>

        <View style={styles.form}>
          {error ? <Alert message={error} /> : null}

          <View style={{ gap: 7 }}>
            <T weight="bold" size={12.5} color={colors.muted}>Email, phone or @handle</T>
            <TextInput
              style={[styles.input, error ? { borderColor: colors.danger } : null]}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              placeholderTextColor={colors.faint}
            />
          </View>

          <View style={{ gap: 7 }}>
            <T weight="bold" size={12.5} color={colors.muted}>Password</T>
            <View>
              <TextInput
                style={[styles.input, { paddingRight: 62 }, error ? { borderColor: colors.danger } : null]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!shown}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                placeholderTextColor={colors.faint}
                onSubmitEditing={() => void submit()}
              />
              <Pressable
                onPress={() => setShown((s) => !s)}
                accessibilityRole="button"
                accessibilityLabel={shown ? 'Hide password' : 'Show password'}
                style={styles.reveal}
              >
                <T weight="bold" size={12.5} color={colors.muted}>
                  {shown ? 'Hide' : 'Show'}
                </T>
              </Pressable>
            </View>
          </View>

          <Button
            label={busy ? 'Signing in…' : 'Sign in'}
            onPress={() => void submit()}
            loading={busy}
            style={{ marginTop: 4 }}
          />

          <View style={styles.hint}>
            <T size={12.5} color={colors.muted} style={{ textAlign: 'center' }}>
              Demo account — sofia@marengo.studio with sofia2026-finto
            </T>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  brand: { paddingHorizontal: space.xl, alignItems: 'flex-start' },
  mark: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center'
  },
  form: { paddingHorizontal: space.xl, marginTop: 32, gap: space.lg },
  input: {
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingHorizontal: 15,
    fontFamily: font.semibold,
    fontSize: 15,
    color: colors.ink
  },
  reveal: { position: 'absolute', right: 6, top: 6, height: 40, paddingHorizontal: 12, justifyContent: 'center' },
  hint: {
    marginTop: 4,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface2
  }
});
