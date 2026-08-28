import { View } from 'react-native';
import type { Transaction } from '@finto/api-client';
import { Avatar, Pill, Row, T } from './UI';
import { colors } from '../lib/theme';

/**
 * The Activity row. Every string — signed amount, its colour, the meta line,
 * the status chip — comes pre-computed from the server, identical to the web
 * app's row. Neither client formats money.
 */
export function TransactionRow({ tx, onPress }: { tx: Transaction; onPress?: () => void }) {
  return (
    <Row onPress={onPress}>
      <Avatar initials={tx.counterparty.initial} tintKey={tx.counterparty.tint} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <T weight="bold" size={14.5} numberOfLines={1}>
          {tx.counterparty.name}
        </T>
        <T size={12.5} color={colors.muted} numberOfLines={1} style={{ marginTop: 1 }}>
          {tx.display.meta}
        </T>
      </View>

      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <T weight="extrabold" size={15} color={tx.display.amountColor} tabular>
          {tx.display.amount}
        </T>
        {tx.display.showStatus ? (
          <Pill label={tx.display.statusLabel} bg={tx.display.statusBg} fg={tx.display.statusFg} />
        ) : null}
      </View>
    </Row>
  );
}
