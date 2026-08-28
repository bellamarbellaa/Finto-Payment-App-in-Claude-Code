import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { api } from '../../src/lib/api';
import { useApi } from '../../src/lib/useApi';
import { StackScreen } from '../../src/components/Screen';
import { Avatar, ErrorState, Loading, Pill, T } from '../../src/components/UI';
import { colors, radius } from '../../src/lib/theme';

export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useApi(() => api.transactions.get(id!), [id]);

  if (query.loading && !query.data) {
    return <StackScreen title="Receipt"><Loading /></StackScreen>;
  }

  if (query.error || !query.data) {
    return (
      <StackScreen title="Receipt">
        <ErrorState message={query.error?.message ?? 'Transaction not found'} onRetry={query.reload} />
      </StackScreen>
    );
  }

  const tx = query.data.transaction;

  return (
    <StackScreen title="Receipt">
      <View style={{ alignItems: 'center', paddingVertical: 18 }}>
        <Avatar initials={tx.counterparty.initial} tintKey={tx.counterparty.tint} size={62} />
        <T weight="bold" size={17} style={{ marginTop: 14 }}>{tx.counterparty.name}</T>
        <T
          weight="extrabold"
          size={38}
          color={tx.display.amountColor}
          tabular
          style={{ marginTop: 8, letterSpacing: -1.7 }}
        >
          {tx.display.amount}
        </T>
        {tx.display.showStatus ? (
          <View style={{ marginTop: 12 }}>
            <Pill label={tx.display.statusLabel} bg={tx.display.statusBg} fg={tx.display.statusFg} />
          </View>
        ) : null}
      </View>

      {tx.failureReason ? (
        <View style={{ backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: 12, marginBottom: 14 }}>
          <T weight="semibold" size={13.5} color={colors.danger}>{tx.failureReason}</T>
        </View>
      ) : null}

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: 16 }}>
        <Detail label="Reference" value={tx.reference} />
        <Detail label="Category" value={tx.category} />
        <Detail label="Date" value={formatDate(tx.occurredAt)} />
        {tx.counterparty.handle ? <Detail label="Handle" value={tx.counterparty.handle} /> : null}
        {tx.note ? <Detail label="Note" value={tx.note} /> : null}
        <Detail label="Status" value={tx.display.statusLabel} last />
      </View>
    </StackScreen>
  );
}

function Detail({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
        paddingVertical: 11,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairline
      }}
    >
      <T weight="semibold" size={13.5} color={colors.muted}>{label}</T>
      <T weight="bold" size={13.5} style={{ flex: 1, textAlign: 'right' }}>{value}</T>
    </View>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
