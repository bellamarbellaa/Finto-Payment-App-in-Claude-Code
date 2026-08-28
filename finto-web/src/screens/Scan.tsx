import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FintoApiError, type PaymentRequest } from '@finto/api-client';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { Avatar } from '../components/UI';
import { BackIcon, CheckIcon } from '../components/Icons';

type Resolved = PaymentRequest & {
  requester: { fullName: string; handle: string; tint: string } | null;
};

export function Scan() {
  const navigate = useNavigate();
  const toast = useToast();

  const [payload, setPayload] = useState('');
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.payments.scan(payload.trim());
      setResolved(result.request as Resolved);
    } catch (err) {
      setError(err instanceof FintoApiError ? err.message : 'That code could not be read.');
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!resolved) return;
    setBusy(true);
    setError(null);
    try {
      await api.payments.payRequest(resolved.linkToken);
      setPaid(true);
      toast('Payment sent');
    } catch (err) {
      setError(err instanceof FintoApiError ? err.message : 'That payment could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  if (paid && resolved) {
    return (
      <div className="screen">
        <div className="success-wrap">
          <div className="success-mark">
            <CheckIcon size={34} color="var(--ink)" />
          </div>
          <h2>Paid</h2>
          <p>{resolved.requester?.fullName} has been paid.</p>
          <div className="success-amount tnum">{resolved.amount.formatted}</div>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 30 }}
            onClick={() => navigate('/')}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <button
          className="icon-btn"
          onClick={() => (resolved ? setResolved(null) : navigate(-1))}
          aria-label="Back"
        >
          <BackIcon />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Pay a code</span>
        <span style={{ width: 44 }} />
      </div>

      {resolved ? (
        <>
          <div className="panel" style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <Avatar
                initials={initialsOf(resolved.requester?.fullName ?? '?')}
                tintKey={resolved.requester?.tint}
                size={56}
                radius={19}
              />
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>
              {resolved.requester?.fullName ?? 'Someone'} is requesting
            </div>
            <div
              className="tnum"
              style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-.045em', margin: '6px 0' }}
            >
              {resolved.amount.formatted}
            </div>
            {resolved.note && (
              <div style={{ fontSize: 14, color: 'var(--muted)' }}>{resolved.note}</div>
            )}
          </div>

          {error && (
            <div className="alert alert-err" role="alert" style={{ marginTop: 14 }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 18 }}
            disabled={busy}
            onClick={() => void pay()}
          >
            {busy ? 'Sending…' : `Pay ${resolved.amount.formatted}`}
          </button>
          <button
            className="btn btn-ghost btn-block"
            style={{ marginTop: 9 }}
            onClick={() => setResolved(null)}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          {/* A browser tab has no camera worth trusting for this, so the
              desktop app takes the code as text. The mobile app scans it. */}
          <div className="scan-hint">
            <p>
              Paste the Finto link or code you were sent. On the phone, the camera does this for
              you.
            </p>
          </div>

          <div className="field" style={{ marginTop: 18 }}>
            <label className="label" htmlFor="payload">
              Payment link or code
            </label>
            <input
              id="payload"
              className="input"
              placeholder="finto://pay/… or a share link"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && payload.trim() && void lookup()}
            />
          </div>

          {error && (
            <div className="alert alert-err" role="alert" style={{ marginTop: 14 }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 18 }}
            disabled={!payload.trim() || busy}
            onClick={() => void lookup()}
          >
            {busy ? 'Looking up…' : 'Continue'}
          </button>
        </>
      )}
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '')).toUpperCase();
}
