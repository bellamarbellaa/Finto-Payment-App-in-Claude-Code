import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FintoApiError, type PaymentRequest } from '@finto/api-client';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { QrCode } from '../components/QrCode';
import { BackIcon } from '../components/Icons';

export function RequestMoney() {
  const navigate = useNavigate();
  const toast = useToast();

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<PaymentRequest | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.payments.createRequest({
        amount,
        note: note.trim() || undefined
      });
      setCreated(result.request);
    } catch (err) {
      setError(err instanceof FintoApiError ? err.message : 'Could not create that request.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.shareUrl);
      toast('Link copied');
    } catch {
      // Clipboard access is denied in some browsers; the link is on screen anyway.
      toast('Select the link to copy it', '!');
    }
  }

  if (created) {
    return (
      <div className="screen">
        <div className="screen-head">
          <button className="icon-btn" onClick={() => setCreated(null)} aria-label="Back">
            <BackIcon />
          </button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Request</span>
          <span style={{ width: 44 }} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className="tnum" style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-.045em' }}>
            {created.amount.formatted}
          </div>
          {created.note && (
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--muted)' }}>{created.note}</p>
          )}

          <div className="qr-frame">
            <QrCode value={created.shareUrl} size={196} />
          </div>

          <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '0 0 18px' }}>
            Have them scan this, or send the link.
          </p>

          <div className="link-box">{created.shareUrl}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 18 }}>
            <button className="btn btn-primary btn-block" onClick={() => void copy()}>
              Copy link
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => navigate('/')}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Request money</span>
        <span style={{ width: 44 }} />
      </div>

      <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 0 }}>
        We&rsquo;ll make a QR code and a link. Anyone with either can pay it once.
      </p>

      <div className="stack" style={{ marginTop: 18 }}>
        <div className="field">
          <label className="label" htmlFor="req-amount">
            Amount
          </label>
          <input
            id="req-amount"
            className="input"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            autoFocus
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="req-note">
            What&rsquo;s it for?
          </label>
          <input
            id="req-note"
            className="input"
            placeholder="Optional"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={140}
          />
        </div>
      </div>

      {error && (
        <div className="alert alert-err" role="alert" style={{ marginTop: 14 }}>
          {error}
        </div>
      )}

      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 20 }}
        disabled={!amount || Number(amount) <= 0 || busy}
        onClick={() => void create()}
      >
        {busy ? 'Creating…' : 'Create request'}
      </button>
    </div>
  );
}
