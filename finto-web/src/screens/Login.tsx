import { useState, type FormEvent } from 'react';
import { FintoApiError } from '@finto/api-client';
import { useAuth } from '../lib/auth';
import { EyeIcon } from '../components/Icons';
import { BrandReveal } from '../components/BrandReveal';

export function Login() {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('sofia@marengo.studio');
  const [password, setPassword] = useState('sofia2026-finto');
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await signIn(identifier.trim(), password);
    } catch (err) {
      setError(
        err instanceof FintoApiError
          ? err.message
          : 'We could not reach Finto. Check your connection and try again.'
      );
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '1fr',
        background: 'var(--paper)'
      }}
    >
      <div className="login-split">
        {/* The forest panel is the brand surface from the design; on a phone
            width it collapses away so the form gets the whole screen. */}
        <aside className="login-brand">
          <div className="login-brand-inner">
            {/* On the forest panel the rail's forest tile would vanish, so the
                mark inverts: lime ground, forest letter. */}
            <div className="login-mark">F</div>
            <h2>Payments that keep up with your business</h2>
            <p>
              Send, receive and settle in one place — the same Finto rails your customers already
              check out on.
            </p>
            <div className="login-facts">
              <div>
                <span>Hold</span>
                <strong>14 currencies</strong>
              </div>
              <div>
                <span>Finto to Finto</span>
                <strong>Instant</strong>
              </div>
            </div>

            <BrandReveal src="/brand-preview.png" alt="The Finto home screen, showing balances and recent activity" />
          </div>
        </aside>

        <main className="login-form-wrap">
          <form className="login-form" onSubmit={submit}>
            <h1>Welcome back</h1>
            <p className="login-sub">Sign in to your Finto account.</p>

            {error && (
              <div className="alert alert-err" role="alert">
                {error}
              </div>
            )}

            <div className="field">
              <label className="label" htmlFor="identifier">
                Email, phone or @handle
              </label>
              <input
                id="identifier"
                className={`input${error ? ' err' : ''}`}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="password">
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  className={`input${error ? ' err' : ''}`}
                  type={shown ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ paddingRight: 50 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShown((s) => !s)}
                  aria-label={shown ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: 6,
                    width: 40,
                    height: 40,
                    border: 'none',
                    background: 'none',
                    borderRadius: 10,
                    display: 'grid',
                    placeItems: 'center'
                  }}
                >
                  <EyeIcon off={shown} color="var(--muted)" />
                </button>
              </div>
            </div>

            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>

            <p className="login-hint">
              Demo account — <strong>sofia@marengo.studio</strong> with{' '}
              <strong>sofia2026-finto</strong>
            </p>
          </form>
        </main>
      </div>
    </div>
  );
}
