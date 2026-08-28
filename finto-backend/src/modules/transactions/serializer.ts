import type { Transaction } from '../../db/schema.js';
import { money, formatMoney } from '../../lib/money.js';

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#FBF0D9', fg: '#8A6410' },
  failed: { bg: '#FDECEA', fg: '#C93A2E' },
  reversed: { bg: '#EDEFEA', fg: '#6B726C' },
  completed: { bg: '#EDEFEA', fg: '#6B726C' }
};

/**
 * The Activity row shape. Presentation strings — the formatted amount, the
 * "Software · Mar 09 11:48" meta line, the status chip colours — are built here
 * so the mobile app and the web app render identical rows from identical data.
 */
export function toPublicTransaction(tx: Transaction) {
  const income = tx.amountMinor > 0n;
  const style = STATUS_STYLES[tx.status] ?? STATUS_STYLES.completed!;
  const occurred = tx.occurredAt;

  return {
    id: tx.id,
    reference: tx.reference,
    type: tx.type,
    status: tx.status,
    direction: income ? 'in' : 'out',
    counterparty: {
      name: tx.counterpartyName,
      handle: tx.counterpartyHandle,
      initial: tx.counterpartyName.charAt(0).toUpperCase(),
      tint: tx.tint
    },
    category: tx.category,
    note: tx.note,
    failureReason: tx.failureReason,
    amount: money(tx.amountMinor, tx.currency, true),
    display: {
      amount: formatMoney(tx.amountMinor, tx.currency, { signed: true }),
      amountColor: income ? '#2E7D46' : '#0B0C0B',
      meta: `${tx.category} · ${formatDay(occurred)} ${formatTime(occurred)}`,
      showStatus: tx.status !== 'completed',
      statusLabel: capitalise(tx.status),
      statusBg: style.bg,
      statusFg: style.fg
    },
    cardId: tx.cardId,
    occurredAt: occurred,
    settledAt: tx.settledAt
  };
}

export function formatDay(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  });
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
