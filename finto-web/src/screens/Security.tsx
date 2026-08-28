import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FintoApiError } from '@finto/api-client';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { Loading, Sheet, Toggle } from '../components/UI';
import { BackIcon } from '../components/Icons';

export function Security() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const sessions = useApi(() => api.auth.sessions(), [], { live: false });
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function toggle(patch: { biometricEnabled?: boolean; confirmPayments?: boolean }, label: string) {
    setSaving(true);
    try {
      await api.users.updateSecurity(patch);
      await refreshUser();
      toast(label);
    } catch (err) {
      toast(err instanceof FintoApiError ? err.message : 'That did not save', '!');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setSaving(true);
    setError(null);
    try {
      const result = await api.users.changePassword(current, next);
      toast(`Password changed · ${result.otherSessionsRevoked} other device(s) signed out`);
      setChanging(false);
      setCurrent('');
      setNext('');
      sessions.reload();
    } catch (err) {
      setError(err instanceof FintoApiError ? err.message : 'Could not change your password.');
    } finally {
      setSaving(false);
    }
  }

  async function signOutEverywhere() {
    setSaving(true);
    try {
      const result = await api.auth.revokeAllSessions(true);
      toast(`${result.revoked} device(s) signed out`);
      sessions.reload();
    } catch (err) {
      toast(err instanceof FintoApiError ? err.message : 'That did not work', '!');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <button className="icon-btn" onClick={() => navigate('/profile')} aria-label="Back">
          <BackIcon />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Security</span>
        <span style={{ width: 44 }} />
      </div>

      <div className="stack" style={{ marginTop: 8 }}>
        <Toggle
          label="Face ID / Touch ID"
          hint="Unlock the app with biometrics"
          checked={user?.security.biometricEnabled ?? false}
          disabled={saving}
          onChange={(v) => void toggle({ biometricEnabled: v }, v ? 'Biometrics on' : 'Biometrics off')}
        />
        <Toggle
          label="Confirm every payment"
          hint="Ask for your password before money leaves"
          checked={user?.security.confirmPayments ?? true}
          disabled={saving}
          onChange={(v) =>
            void toggle({ confirmPayments: v }, v ? 'Confirmation on' : 'Confirmation off')
          }
        />
      </div>

      <h2 className="section-label" style={{ margin: '26px 0 11px' }}>
        Password
      </h2>
      <button className="btn btn-ghost btn-block" onClick={() => setChanging(true)}>
        Change password
      </button>

      <h2 className="section-label" style={{ margin: '26px 0 11px' }}>
        Signed-in devices
      </h2>

      {sessions.loading && !sessions.data ? (
        <Loading rows={2} height={58} />
      ) : (
        <div className="stack">
          {sessions.data?.sessions.map((session) => (
            <div key={session.id} className="row" style={{ cursor: 'default' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.015em' }}>
                  {shortenAgent(session.userAgent)}
                  {session.current && (
                    <span
                      className="pill"
                      style={{ background: 'var(--lime-wash)', color: 'var(--lime-deep)', marginLeft: 8 }}
                    >
                      This device
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>
                  {session.ip ?? 'Unknown location'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        className="btn btn-ghost btn-block"
        style={{ marginTop: 14, color: 'var(--danger)' }}
        disabled={saving}
        onClick={() => void signOutEverywhere()}
      >
        Log out of all other devices
      </button>

      <Sheet open={changing} onClose={() => setChanging(false)} title="Change password">
        <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--muted)' }}>
          Changing your password signs you out of every other device.
        </p>

        <div className="stack">
          <div className="field">
            <label className="label" htmlFor="cur-pw">Current password</label>
            <input
              id="cur-pw"
              className="input"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="new-pw">New password</label>
            <input
              id="new-pw"
              className="input"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
            <span style={{ fontSize: 12, color: 'var(--faint)' }}>At least 10 characters.</span>
          </div>
        </div>

        {error && (
          <div className="alert alert-err" role="alert" style={{ marginTop: 14 }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 18 }}
          disabled={!current || next.length < 10 || saving}
          onClick={() => void changePassword()}
        >
          {saving ? 'Saving…' : 'Change password'}
        </button>
      </Sheet>
    </div>
  );
}

/** Turn a user-agent string into something a person recognises. */
function shortenAgent(agent: string | null): string {
  if (!agent) return 'Unknown device';
  const browser =
    /Edg\//.test(agent) ? 'Edge' :
    /Chrome\//.test(agent) ? 'Chrome' :
    /Firefox\//.test(agent) ? 'Firefox' :
    /Safari\//.test(agent) ? 'Safari' : 'Browser';
  const os =
    /Mac OS X/.test(agent) ? 'macOS' :
    /Windows/.test(agent) ? 'Windows' :
    /iPhone/.test(agent) ? 'iPhone' :
    /Android/.test(agent) ? 'Android' :
    /Linux/.test(agent) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}
