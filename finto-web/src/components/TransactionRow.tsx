import type { Transaction } from '@finto/api-client';
import { Avatar, StatusPill } from './UI';

/**
 * One Activity row. Every string here — the signed amount, its colour, the
 * "Software · Mar 09 11:48" meta line, the status chip — arrives pre-computed
 * from the server, so this component formats nothing and the web app can never
 * drift from what the mobile app displays.
 */
export function TransactionRow({
  tx,
  onClick
}: {
  tx: Transaction;
  onClick?: () => void;
}) {
  const Element = onClick ? 'button' : 'div';

  return (
    <Element className="row" onClick={onClick} type={onClick ? 'button' : undefined}>
      <Avatar initials={tx.counterparty.initial} tintKey={tx.counterparty.tint} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            letterSpacing: '-.015em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {tx.counterparty.name}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>
          {tx.display.meta}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span
          className="tnum"
          style={{ fontSize: 15, fontWeight: 800, color: tx.display.amountColor }}
        >
          {tx.display.amount}
        </span>
        {tx.display.showStatus && (
          <StatusPill
            label={tx.display.statusLabel}
            bg={tx.display.statusBg}
            fg={tx.display.statusFg}
          />
        )}
      </div>
    </Element>
  );
}
