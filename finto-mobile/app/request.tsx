import { useState } from 'react';
import { Share, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FintoApiError, type PaymentRequest } from '@finto/api-client';
import { api } from '../src/lib/api';
import { useToast } from '../src/lib/toast';
import { StackScreen } from '../src/components/Screen';
import { Alert, Button, T } from '../src/components/UI';
import { QrCode } from '../src/components/QrCode';
import { colors, font, radius } from '../src/lib/theme';

export default function RequestMoney() {
  const router = useRouter();
  const toast = useToast();

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<PaymentRequest | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.payments.createRequest({
        amount,
        note: note.trim() || undefined
      });
      setCreated(result.request);
    } catch (err) {
      setError(err instanceof FintoApiError ? err.message : 'Could not create that request.');
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!created) return;
    try {
      // The OS share sheet — messages, mail, AirDrop, whatever they use.
      await Share.share({
        message: `Pay me ${created.amount.formatted} on Finto: ${created.shareUrl}`,
        url: created.shareUrl
      });
    } catch {
      toast('Could not open the share sheet', '!');
    }
  }

  if (created) {
    return (
      <StackScreen title="Request" onBack={() => setCreated(null)}>
        <View style={{ alignItems: 'center' }}>
          <T weight="extrabold" size={40} tabular style={{ letterSpacing: -1.8 }}>
            {created.amount.formatted}
          </T>
          {created.note ? (
            <T size={14} color={colors.muted} style={{ marginTop: 4 }}>{created.note}</T>
          ) : null}

          <View style={styles.qrFrame}>
            <QrCode value={created.shareUrl} size={196} />
          </View>

          <T size={13.5} color={colors.muted} style={{ textAlign: 'center', marginBottom: 18 }}>
            Have them scan this, or send the link.
          </T>

          <View style={{ alignSelf: 'stretch', gap: 9 }}>
            <Button label="Share link" onPress={() => void share()} />
            <Button label="Done" variant="ghost" onPress={() => router.replace('/(tabs)')} />
          </View>
        </View>
      </StackScreen>
    );
  }

  return (
    <StackScreen title="Request money">
      <T size={14} color={colors.muted}>
        We’ll make a QR code and a link. Anyone with either can pay it once.
      </T>

      <View style={{ gap: 16, marginTop: 18 }}>
        <View style={{ gap: 7 }}>
          <T weight="bold" size={12.5} color={colors.muted}>Amount</T>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.faint}
            value={amount}
            onChangeText={(text) => setAmount(text.replace(/[^\d.]/g, ''))}
            autoFocus
          />
        </View>

        <View style={{ gap: 7 }}>
          <T weight="bold" size={12.5} color={colors.muted}>What’s it for?</T>
          <TextInput
            style={styles.input}
            placeholder="Optional"
            placeholderTextColor={colors.faint}
            value={note}
            onChangeText={setNote}
            maxLength={140}
          />
        </View>
      </View>

      {error ? <View style={{ marginTop: 14 }}><Alert message={error} /></View> : null}

      <Button
        label={busy ? 'Creating…' : 'Create request'}
        onPress={() => void create()}
        disabled={!amount || Number(amount) <= 0}
        loading={busy}
        style={{ marginTop: 20 }}
      />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
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
  qrFrame: {
    padding: 18,
    marginVertical: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.xxl
  }
});
