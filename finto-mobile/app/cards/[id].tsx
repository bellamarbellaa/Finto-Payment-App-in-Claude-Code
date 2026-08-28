import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { FintoApiError } from '@finto/api-client';
import { api } from '../../src/lib/api';
import { useApi } from '../../src/lib/useApi';
import { useToast } from '../../src/lib/toast';
import { StackScreen } from '../../src/components/Screen';
import { Button, ErrorState, Loading, T, Toggle } from '../../src/components/UI';
import { colors, font, radius } from '../../src/lib/theme';

export default function CardControls() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const card = useApi(() => api.cards.get(id!), [id]);

  const [limit, setLimit] = useState('');
  const [saving, setSaving] = useState(false);

  // Seed the field once the card arrives, without clobbering what is typed.
  useEffect(() => {
    if (card.data && limit === '') {
      setLimit(card.data.card.controls.monthlyLimit?.amount ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.data]);

  async function update(patch: Parameters<typeof api.cards.updateControls>[1], label: string) {
    setSaving(true);
    try {
      await api.cards.updateControls(id!, patch);
      toast(label);
      card.reload();
    } catch (err) {
      toast(err instanceof FintoApiError ? err.message : 'That did not save', '!');
    } finally {
      setSaving(false);
    }
  }

  if (card.loading && !card.data) {
    return <StackScreen title="Card controls"><Loading /></StackScreen>;
  }

  if (card.error || !card.data) {
    return (
      <StackScreen title="Card controls">
        <ErrorState message={card.error?.message ?? 'Card not found'} onRetry={card.reload} />
      </StackScreen>
    );
  }

  const { controls, last4 } = card.data.card;

  return (
    <StackScreen title="Card controls">
      <T size={13.5} color={colors.muted}>
        Card ending {last4}. Changes take effect immediately.
      </T>

      <View style={{ gap: 9, marginTop: 18 }}>
        <Toggle
          label="Online payments"
          hint="Card details entered on websites and in apps"
          value={controls.onlinePayments}
          disabled={saving}
          onChange={(v) => void update({ onlinePayments: v }, v ? 'Online payments on' : 'Online payments off')}
        />
        <Toggle
          label="Payments abroad"
          hint="Transactions outside your home country"
          value={controls.paymentsAbroad}
          disabled={saving}
          onChange={(v) => void update({ paymentsAbroad: v }, v ? 'Payments abroad on' : 'Payments abroad off')}
        />
        <Toggle
          label="Contactless"
          hint="Tap to pay at a terminal"
          value={controls.contactless}
          disabled={saving}
          onChange={(v) => void update({ contactless: v }, v ? 'Contactless on' : 'Contactless off')}
        />
        <Toggle
          label="ATM withdrawals"
          hint="Taking cash out at a machine"
          value={controls.atmWithdrawals}
          disabled={saving}
          onChange={(v) => void update({ atmWithdrawals: v }, v ? 'ATM withdrawals on' : 'ATM withdrawals off')}
        />
      </View>

      <T weight="bold" size={12.5} color={colors.faint} style={{ marginTop: 26, marginBottom: 11, letterSpacing: 0.5 }}>
        MONTHLY LIMIT
      </T>

      <View style={styles.panel}>
        <T size={13.5} color={colors.muted} style={{ marginBottom: 12 }}>
          We block anything that would take you over this in a calendar month. Leave it empty for no
          limit.
        </T>

        <View style={{ flexDirection: 'row', gap: 9 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="decimal-pad"
            placeholder="No limit"
            placeholderTextColor={colors.faint}
            value={limit}
            onChangeText={(text) => setLimit(text.replace(/[^\d.]/g, ''))}
          />
          <Button
            label="Save"
            variant="dark"
            loading={saving}
            onPress={() =>
              void update(
                { monthlyLimit: limit.trim() === '' ? null : limit.trim() },
                limit.trim() === '' ? 'Limit removed' : 'Limit saved'
              )
            }
          />
        </View>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline
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
  }
});
