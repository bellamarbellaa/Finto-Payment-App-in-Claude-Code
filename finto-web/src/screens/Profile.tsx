import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Avatar, ScreenHead } from '../components/UI';
import { ChevronIcon, HelpIcon, LockIcon, WalletIcon, CardsIcon, BellIcon } from '../components/Icons';

export function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const items = [
    { label: 'Accounts & balances', hint: user?.baseCurrency ?? 'USD', to: '/accounts', Icon: WalletIcon },
    { label: 'Cards', hint: 'Freeze, limits, controls', to: '/cards', Icon: CardsIcon },
    { label: 'Notifications', hint: 'Alerts and payment updates', to: '/notifications', Icon: BellIcon },
    { label: 'Security', hint: 'Face ID, PIN, password', to: '/security', Icon: LockIcon },
    { label: 'Help', hint: 'FAQs and support', to: '/help', Icon: HelpIcon }
  ];

  return (
    <div className="screen">
      <ScreenHead title="Profile" />

      <div className="profile-card">
        <Avatar initials={user?.initials ?? '··'} tintKey={user?.tint} size={58} radius={19} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.03em' }}>
            {user?.fullName}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 1 }}>{user?.handle}</div>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 1 }}>{user?.email}</div>
        </div>
      </div>

      <div className="stack" style={{ marginTop: 20 }}>
        {items.map(({ label, hint, to, Icon }) => (
          <button key={to} className="row" onClick={() => navigate(to)}>
            <span className="quick-icon" style={{ width: 40, height: 40, borderRadius: 13 }}>
              <Icon size={18} color="var(--ink)" />
            </span>
            <span style={{ flex: 1, textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, letterSpacing: '-.015em' }}>
                {label}
              </span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)' }}>{hint}</span>
            </span>
            <ChevronIcon color="var(--faint)" />
          </button>
        ))}
      </div>

      <button
        className="btn btn-ghost btn-block"
        style={{ marginTop: 22, color: 'var(--danger)' }}
        onClick={() => void signOut()}
      >
        Log out
      </button>
    </div>
  );
}
