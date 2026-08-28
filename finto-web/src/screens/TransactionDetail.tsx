import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { Avatar, ErrorState, Loading, StatusPill } from '../components/UI';
import { BackIcon } from '../components/Icons';

export function TransactionDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const query = useApi(() => api.transactions.get(id), [id]);

  if (query.loading && !query.data) {
    return (
      <div className="screen">
        <Loading rows={4} />
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="screen">
        <ErrorState
          message={query.error?.message ?? 'Transaction not found'}
          onRetry={query.reload}
        />
      </div>
    );
  }

  const tx = query.data.transaction;

  return (
    <div className="screen">
      <div className="screen-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Receipt</span>
        <span style={{ width: 44 }} />
      </div>

      <div style={{ textAlign: 'center', padding: '18px 0 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <Avatar initials={tx.counterparty.initial} tintKey={tx.counterparty.tint} size={62} radius={20} />
        </div>

        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.025em' }}>
          {tx.counterparty.name}
        </div>

        <div
          className="tnum"
          style={{
            marginTop: 8,
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: '-.045em',
            color: tx.display.amountColor
          }}
        >
          {tx.display.amount}
        </div>

        {tx.display.showStatus && (
          <div style={{ marginTop: 12 }}>
            <StatusPill
              label={tx.display.statusLabel}
              bg={tx.display.statusBg}
              fg={tx.display.statusFg}
            />
          </div>
        )}
      </div>

      {tx.failureReason && (
        <div className="alert alert-err" style={{ marginBottom: 14 }}>
          {tx.failureReason}
        </div>
      )}

      <div className="panel">
        <Detail label="Reference" value={tx.reference} mono />
        <Detail label="Category" value={tx.category} />
        <Detail label="Date" value={formatDate(tx.occurredAt)} />
        {tx.counterparty.handle && <Detail label="Handle" value={tx.counterparty.handle} />}
        {tx.note && <Detail label="Note" value={tx.note} />}
        <Detail label="Status" value={tx.display.statusLabel} last />
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  last
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        padding: '11px 0',
        borderBottom: last ? 'none' : '1px solid var(--hairline)'
      }}
    >
      <span style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
      <span
        className={mono ? 'tnum' : undefined}
        style={{ fontSize: 13.5, fontWeight: 700, textAlign: 'right' }}
      >
        {value}
      </span>
    </div>
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
