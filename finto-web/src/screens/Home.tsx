import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { useLive } from '../lib/live';
import { ErrorState, Loading } from '../components/UI';
import { BellIcon, PayIcon, RequestIcon, ScanIcon, WalletIcon } from '../components/Icons';
import { TransactionRow } from '../components/TransactionRow';

export function Home() {
  const { user } = useAuth();
  const { unread } = useLive();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);

  const accounts = useApi(() => api.accounts.list(), []);
  const recent = useApi(() => api.transactions.list({ limit: 4, grouped: false }), []);

  return (
    <div className="screen">
      {/* Greeting — the phone header. On desktop the rail already shows who
          you are, so this stays compact rather than being repeated large. */}
      <div className="home-greet">
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div className="avatar avatar-brand" style={{ width: 42, height: 42, borderRadius: 14 }} aria-hidden="true">
            {user?.initials ?? '··'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--faint)' }}>
              {greeting()}
            </span>
            <span style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: '-.02em' }}>
              {user?.displayName}
            </span>
          </div>
        </div>

        <Link to="/notifications" className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <BellIcon />
          {unread > 0 && <span className="dot" />}
        </Link>
      </div>

      {/* Balance surface — forest, per the design system. */}
      <section className="balance-card">
        <div className="balance-glow" aria-hidden="true" />
        <div className="balance-top">
          <span className="balance-label">
            Total balance · {accounts.data?.baseCurrency ?? 'USD'}
          </span>
          <button className="balance-toggle" onClick={() => setHidden((h) => !h)}>
            {hidden ? 'Show' : 'Hide'}
          </button>
        </div>

        <div className="balance-amount tnum">
          {accounts.loading ? (
            <span className="skeleton" style={{ display: 'block', width: 190, height: 44, borderRadius: 12 }} />
          ) : hidden ? (
            '••••••'
          ) : (
            accounts.data?.total.formatted ?? '—'
          )}
        </div>

        <div className="balance-split">
          {(accounts.data?.accounts ?? []).slice(0, 2).map((account) => (
            <div key={account.id} className="balance-cell">
              <span>{account.name}</span>
              <strong className="tnum">{hidden ? '••••' : account.balance.formatted}</strong>
            </div>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <nav className="quick-grid" aria-label="Quick actions">
        <QuickAction label="Send" onClick={() => navigate('/pay')} Icon={PayIcon} />
        <QuickAction label="Request" onClick={() => navigate('/request')} Icon={RequestIcon} />
        <QuickAction label="Scan" onClick={() => navigate('/scan')} Icon={ScanIcon} />
        <QuickAction label="Accounts" onClick={() => navigate('/accounts')} Icon={WalletIcon} />
      </nav>

      {/* Recent activity */}
      <div className="home-section-head">
        <h2 className="section-label">Recent</h2>
        <Link
          to="/activity"
          style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', textDecoration: 'none' }}
        >
          See all
        </Link>
      </div>

      {recent.loading && !recent.data ? (
        <Loading rows={4} />
      ) : recent.error ? (
        <ErrorState message={recent.error.message} onRetry={recent.reload} />
      ) : (
        <div className="stack">
          {recent.data?.transactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} onClick={() => navigate(`/activity/${tx.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuickAction({
  label,
  onClick,
  Icon
}: {
  label: string;
  onClick: () => void;
  Icon: (p: { size?: number; color?: string }) => React.ReactElement;
}) {
  return (
    <button className="quick" onClick={onClick}>
      <span className="quick-icon">
        <Icon size={20} color="var(--ink)" />
      </span>
      {label}
    </button>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
