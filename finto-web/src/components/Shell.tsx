import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useLive } from '../lib/live';
import { Avatar } from './UI';
import {
  ActivityIcon,
  CardsIcon,
  HomeIcon,
  PayIcon,
  ProfileIcon
} from './Icons';

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/pay', label: 'Pay', Icon: PayIcon },
  { to: '/activity', label: 'Activity', Icon: ActivityIcon },
  { to: '/cards', label: 'Cards', Icon: CardsIcon },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon }
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { connected } = useLive();
  const navigate = useNavigate();

  return (
    <div className="app">
      {/* On desktop the phone's tab bar becomes a left rail. */}
      <aside className="rail">
        <div className="rail-brand">
          <div className="rail-mark">F</div>
          <span className="rail-name">Finto</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className="rail-link">
              {({ isActive }) => (
                <>
                  <Icon size={20} color={isActive ? '#fff' : 'var(--muted)'} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="rail-spacer" />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '0 12px 12px',
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--faint)'
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: connected ? 'var(--income)' : 'var(--hairline-2)'
            }}
          />
          {connected ? 'Live' : 'Reconnecting…'}
        </div>

        <button className="rail-user" onClick={() => navigate('/profile')}>
          <Avatar initials={user?.initials ?? '··'} tintKey={user?.tint} size={34} />
          <span style={{ minWidth: 0, textAlign: 'left' }}>
            <span
              style={{
                display: 'block',
                fontSize: 13.5,
                fontWeight: 700,
                letterSpacing: '-.02em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {user?.fullName}
            </span>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--faint)' }}>
              {user?.handle}
            </span>
          </span>
        </button>
      </aside>

      <div className="main">{children}</div>

      <nav className="tabbar" aria-label="Main">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className="tab">
            {({ isActive }) => (
              <>
                <Icon size={21} color={isActive ? 'var(--ink)' : 'var(--faint)'} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
