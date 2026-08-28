import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FintoApiError, type Transaction } from '@finto/api-client';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDebounced } from '../lib/useDebounced';
import { Avatar, Sheet } from '../components/UI';
import { BackIcon, CheckIcon } from '../components/Icons';

interface Recipient {
  contactId?: string;
  handle?: string;
  name: string;
  tint?: string;
  initials: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

export function SendAmount() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const recipient = location.state as Recipient | null;

  const [amount, setAmount] = useState('0');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Transaction | null>(null);

  const [quote, setQuote] = useState<{ sufficient: boolean; warning: string | null } | null>(null);
  const debouncedAmount = useDebounced(amount, 300);

  // Someone landing here directly has no recipient in history state.
  useEffect(() => {
    if (!recipient) navigate('/pay', { replace: true });
  }, [recipient, navigate]);

  /** Ask the server whether this is affordable — it owns that judgement. */
  useEffect(() => {
    const value = Number(debouncedAmount);
    if (!value || value <= 0) {
      setQuote(null);
      return;
    }

    let cancelled = false;
    api.payments
      .quote({ amount: debouncedAmount })
      .then((result) => {
        if (!cancelled) setQuote({ sufficient: result.sufficient, warning: result.warning });
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      });

    return () => { cancelled = true; };
  }, [debouncedAmount]);

  function press(key: string) {
    setError(null);
    setAmount((current) => {
      if (key === '⌫') return current.length <= 1 ? '0' : current.slice(0, -1);
      if (key === '.') return current.includes('.') ? current : `${current}.`;

      // Two decimal places is all USD has; more would be rejected anyway.
      const [, decimals] = current.split('.');
      if (decimals && decimals.length >= 2) return current;

      return current === '0' ? key : current + key;
    });
  }

  async function send() {
    setBusy(true);
    setError(null);

    try {
      const result = await api.payments.send({
        amount,
        contactId: recipient?.contactId,
        handle: recipient?.handle,
        note: note.trim() || undefined,
        password: user?.security.confirmPayments ? password : undefined
      });

      setDone(result.transaction);
      setConfirming(false);
    } catch (err) {
      setError(
        err instanceof FintoApiError ? err.message : 'That payment could not be sent. Try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (!recipient) return null;

  if (done) {
    return (
      <div className="screen">
        <div className="success-wrap">
          <div className="success-mark">
            <CheckIcon size={34} color="var(--ink)" />
          </div>
          <h2>Money sent</h2>
          <p>
            {done.counterparty.name} has it now.
          </p>
          <div className="success-amount tnum">{done.amount.formatted}</div>
          <p style={{ fontSize: 13, color: 'var(--faint)' }}>Reference {done.reference}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%', marginTop: 30 }}>
            <button className="btn btn-primary btn-block" onClick={() => navigate('/')}>
              Done
            </button>
            <button
              className="btn btn-ghost btn-block"
              onClick={() => navigate(`/activity/${done.id}`)}
            >
              View receipt
            </button>
          </div>
        </div>
      </div>
    );
  }

  const value = Number(amount) || 0;
  const blocked = quote ? !quote.sufficient : false;

  return (
    <div className="screen">
      <div className="screen-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Send</span>
        <span style={{ width: 44 }} />
      </div>

      <div className="recipient-chip">
        <Avatar initials={recipient.initials} tintKey={recipient.tint} size={38} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>To</div>
          <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-.015em' }}>
            {recipient.name}
          </div>
        </div>
      </div>

      <div className="amount-display">
        <div className="amount-value tnum">
          <span className="cur">$</span>
          {amount}
        </div>

        {blocked ? (
          <div className="amount-warning">{quote?.warning}</div>
        ) : (
          <div className="amount-caption">Tap to enter an amount</div>
        )}
      </div>

      <div className="keypad">
        {KEYS.map((key) => (
          <button
            key={key}
            className={`key${key === '.' || key === '⌫' ? ' sub' : ''}`}
            onClick={() => press(key)}
            aria-label={key === '⌫' ? 'Delete' : key}
          >
            {key}
          </button>
        ))}
      </div>

      <input
        className="input"
        placeholder="What's it for? (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={140}
        aria-label="Payment note"
        style={{ marginBottom: 12 }}
      />

      {error && (
        <div className="alert alert-err" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button
        className="btn btn-primary btn-block"
        disabled={value <= 0 || blocked || busy}
        onClick={() => (user?.security.confirmPayments ? setConfirming(true) : void send())}
      >
        {busy ? 'Sending…' : `Send $${amount}`}
      </button>

      {/* "Confirm every payment" is on by default, so this is the usual path. */}
      <Sheet open={confirming} onClose={() => setConfirming(false)} title="Confirm this payment">
        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--muted)' }}>
          Sending <strong style={{ color: 'var(--ink)' }}>${amount}</strong> to{' '}
          <strong style={{ color: 'var(--ink)' }}>{recipient.name}</strong>. Enter your password to
          approve it.
        </p>

        <div className="field" style={{ marginBottom: 14 }}>
          <label className="label" htmlFor="confirm-password">
            Password
          </label>
          <input
            id="confirm-password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && password && void send()}
          />
        </div>

        {error && (
          <div className="alert alert-err" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-primary btn-block"
          disabled={!password || busy}
          onClick={() => void send()}
        >
          {busy ? 'Sending…' : 'Confirm and send'}
        </button>
        <button
          className="btn btn-ghost btn-block"
          style={{ marginTop: 8 }}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </button>
      </Sheet>
    </div>
  );
}
