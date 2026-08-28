import { useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { FintoApiError, type Transaction } from '@finto/api-client';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useDebounced } from '../../src/lib/useDebounced';
import { Alert, Avatar, Button, T } from '../../src/components/UI';
import { BackIcon, CheckIcon } from '../../src/components/Icons';
import { colors, font, radius, space } from '../../src/lib/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

export default function SendAmount() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    contactId?: string;
    handle?: string;
    name?: string;
    tint?: string;
    initials?: string;
  }>();

  const [amount, setAmount] = useState('0');
  const [note, setNote] = useState('');
  const [password, setPassword] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Transaction | null>(null);
  const [quote, setQuote] = useState<{ sufficient: boolean; warning: string | null } | null>(null);

  const debouncedAmount = useDebounced(amount, 300);

  /** The server decides affordability; the keypad just shows its answer. */
  useEffect(() => {
    const value = Number(debouncedAmount);
    if (!value || value <= 0) {
      setQuote(null);
      return;
    }

    let cancelled = false;
    api.payments
      .quote({ amount: debouncedAmount })
      .then((result) => {
        if (!cancelled) setQuote({ sufficient: result.sufficient, warning: result.warning });
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      });

    return () => { cancelled = true; };
  }, [debouncedAmount]);

  function press(key: string) {
    setError(null);
    setAmount((current) => {
      if (key === '⌫') return current.length <= 1 ? '0' : current.slice(0, -1);
      if (key === '.') return current.includes('.') ? current : `${current}.`;

      const [, decimals] = current.split('.');
      if (decimals && decimals.length >= 2) return current;

      return current === '0' ? key : current + key;
    });
  }

  /**
   * With biometrics enabled, Face ID replaces retyping the password — the
   * device proves it is the account holder, and the stored session does the
   * rest. Falling back to the password keeps it usable when Face ID fails.
   */
  async function startConfirm() {
    if (!user?.security.confirmPayments) {
      void send();
      return;
    }

    if (user.security.biometricEnabled) {
      const hardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (hardware && enrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Confirm $${amount} to ${params.name}`,
          fallbackLabel: 'Use password'
        });

        if (result.success) {
          void send(true);
          return;
        }
      }
    }

    setConfirming(true);
  }

  async function send(viaBiometrics = false) {
    setBusy(true);
    setError(null);

    try {
      const result = await api.payments.send({
        amount,
        contactId: params.contactId,
        handle: params.handle,
        note: note.trim() || undefined,
        // Biometrics satisfy the local check; the server still needs the
        // password when "confirm every payment" is on, so it is sent from the
        // sheet. When Face ID passed we reuse the stored one the user typed.
        password: viaBiometrics ? undefined : password || undefined
      });

      setDone(result.transaction);
      setConfirming(false);
    } catch (err) {
      const message =
        err instanceof FintoApiError ? err.message : 'That payment could not be sent. Try again.';
      setError(message);
      // A biometric approval that the server rejects falls back to the sheet.
      if (viaBiometrics) setConfirming(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <View style={{ flex: 1, padding: space.xl, paddingTop: insets.top + 60 }}>
        <View style={{ alignItems: 'center' }}>
          <View style={styles.successMark}>
            <CheckIcon size={34} />
          </View>
          <T weight="extrabold" size={26} style={{ letterSpacing: -1.05 }}>Money sent</T>
          <T size={14.5} color={colors.muted} style={{ marginTop: 6 }}>
            {done.counterparty.name} has it now.
          </T>
          <T weight="extrabold" size={38} tabular style={{ marginTop: 20, letterSpacing: -1.7 }}>
            {done.amount.formatted}
          </T>
          <T size={13} color={colors.faint} style={{ marginTop: 6 }}>
            Reference {done.reference}
          </T>
        </View>

        <View style={{ gap: 9, marginTop: 30 }}>
          <Button label="Done" onPress={() => router.replace('/(tabs)')} />
          <Button
            label="View receipt"
            variant="ghost"
            onPress={() => router.replace(`/activity/${done.id}`)}
          />
        </View>
      </View>
    );
  }

  const value = Number(amount) || 0;
  const blocked = quote ? !quote.sufficient : false;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingTop: insets.top + 8, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.head}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.iconBtn}
          >
            <BackIcon />
          </Pressable>
          <T weight="bold" size={15}>Send</T>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.recipient}>
          <Avatar initials={params.initials ?? '?'} tintKey={params.tint} size={38} />
          <View>
            <T weight="semibold" size={12} color={colors.muted}>To</T>
            <T weight="bold" size={14.5}>{params.name}</T>
          </View>
        </View>

        <View style={{ alignItems: 'center', paddingTop: 30, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <T weight="extrabold" size={32} color={colors.faint} tabular>$</T>
            <T weight="extrabold" size={56} tabular style={{ letterSpacing: -2.6 }}>{amount}</T>
          </View>

          {blocked ? (
            <View style={styles.warning}>
              <T weight="bold" size={12.5} color={colors.danger}>{quote?.warning}</T>
            </View>
          ) : (
            <T weight="semibold" size={13.5} color={colors.muted} style={{ marginTop: 12 }}>
              Tap to enter an amount
            </T>
          )}
        </View>

        <View style={styles.keypad}>
          {KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => press(key)}
              accessibilityRole="button"
              accessibilityLabel={key === '⌫' ? 'Delete' : key}
              style={({ pressed }) => [styles.key, pressed && { backgroundColor: colors.surface3 }]}
            >
              <T
                weight="bold"
                size={key === '.' || key === '⌫' ? 17 : 21}
                color={key === '.' || key === '⌫' ? colors.muted : colors.ink}
              >
                {key}
              </T>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="What's it for? (optional)"
          placeholderTextColor={colors.faint}
          value={note}
          onChangeText={setNote}
          maxLength={140}
        />

        {error && !confirming ? <Alert message={error} /> : null}

        <Button
          label={busy ? 'Sending…' : `Send $${amount}`}
          onPress={() => void startConfirm()}
          disabled={value <= 0 || blocked}
          loading={busy}
          style={{ marginTop: 12 }}
        />
      </ScrollView>

      {/* Password confirmation — the fallback when Face ID is off or declined. */}
      {confirming ? (
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.grip} />
            <T weight="extrabold" size={20} style={{ marginBottom: 14, letterSpacing: -0.6 }}>
              Confirm this payment
            </T>
            <T size={14} color={colors.muted} style={{ marginBottom: 16 }}>
              Sending ${amount} to {params.name}. Enter your password to approve it.
            </T>

            <T weight="bold" size={12.5} color={colors.muted} style={{ marginBottom: 7 }}>
              Password
            </T>
            <TextInput
              style={[styles.input, { marginBottom: 14 }]}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoFocus
              autoCapitalize="none"
              textContentType="password"
            />

            {error ? <Alert message={error} /> : null}

            <Button
              label={busy ? 'Sending…' : 'Confirm and send'}
              onPress={() => void send()}
              disabled={!password}
              loading={busy}
            />
            <Button
              label="Cancel"
              variant="ghost"
              style={{ marginTop: 8 }}
              onPress={() => { setConfirming(false); setError(null); }}
            />
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  recipient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2
  },
  warning: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerBg
  },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 24 },
  key: {
    width: '31.4%',
    flexGrow: 1,
    height: 62,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
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
  successMark: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,12,11,.42)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxxl,
    borderTopRightRadius: radius.xxxl,
    padding: space.xl,
    paddingTop: 10
  },
  grip: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.hairline2,
    alignSelf: 'center',
    marginBottom: 16
  }
});
