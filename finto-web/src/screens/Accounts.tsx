import { useState } from 'react';
import { FintoApiError } from '@finto/api-client';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { Avatar, ErrorState, Loading, ScreenHead, Sheet } from '../components/UI';
import { PlusIcon } from '../components/Icons';

export function Accounts() {
  const toast = useToast();
  const accounts = useApi(() => api.accounts.list(), []);
  const currencies = useApi(() => api.fx.currencies(), [], { live: false });

  const [opening, setOpening] = useState(false);
  const [currency, setCurrency] = useState('EUR');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const held = new Set((accounts.data?.accounts ?? []).map((a) => a.currency));
  const available = (currencies.data?.currencies ?? []).filter((c) => !held.has(c.code));

  async function open() {
    setBusy(true);
    setError(null);
    try {
      await api.accounts.open(currency);
      toast(`${currency} balance opened`);
      setOpening(false);
      accounts.reload();
    } catch (err) {
      setError(err instanceof FintoApiError ? err.message : 'Could not open that balance.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <ScreenHead
        title="Accounts"
        right={
          <button
            className="icon-btn"
            onClick={() => {
              setCurrency(available[0]?.code ?? 'EUR');
              setOpening(true);
            }}
            aria-label="Open a balance"
          >
            <PlusIcon />
          </button>
        }
      />

      {accounts.loading && !accounts.data ? (
        <Loading rows={3} height={74} />
      ) : accounts.error ? (
        <ErrorState message={accounts.error.message} onRetry={accounts.reload} />
      ) : (
        <>
          <div className="total-strip">
            <span>Total across all balances</span>
            <strong className="tnum">{accounts.data?.total.formatted}</strong>
          </div>

          <div className="stack">
            {accounts.data?.accounts.map((account) => (
              <div key={account.id} className="row" style={{ cursor: 'default' }}>
                <Avatar initials={account.symbol} tintKey="forest" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-.015em' }}>
                    {account.name}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--faint)', marginTop: 1 }}>
                    {account.ibanMasked}
                  </div>
                </div>
                <span className="tnum" style={{ fontSize: 16, fontWeight: 800 }}>
                  {account.balance.formatted}
                </span>
              </div>
            ))}
          </div>

          <section className="open-balance-card">
            <h3>Hold 14 currencies at the real rate</h3>
            <p>
              Convert at the mid-market rate and spend from any balance. Open a new one in a tap.
            </p>
            <button
              className="btn btn-dark btn-sm"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                setCurrency(available[0]?.code ?? 'EUR');
                setOpening(true);
              }}
              disabled={available.length === 0}
            >
              {available.length === 0 ? 'You hold every currency' : 'Open a balance'}
            </button>
          </section>
        </>
      )}

      <Sheet open={opening} onClose={() => setOpening(false)} title="Open a balance">
        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--muted)' }}>
          Pick a currency. It opens empty — convert into it or receive a payment to fund it.
        </p>

        <div className="currency-grid">
          {available.map((item) => (
            <button
              key={item.code}
              className="chip"
              style={{ height: 46 }}
              aria-pressed={currency === item.code}
              onClick={() => setCurrency(item.code)}
            >
              {item.code}
            </button>
          ))}
        </div>

        {error && (
          <div className="alert alert-err" role="alert" style={{ margin: '14px 0' }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 16 }}
          disabled={busy || available.length === 0}
          onClick={() => void open()}
        >
          {busy ? 'Opening…' : `Open ${currency} balance`}
        </button>
      </Sheet>
    </div>
  );
}
