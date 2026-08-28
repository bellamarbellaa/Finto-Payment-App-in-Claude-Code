import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FintoApiError } from '@finto/api-client';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { ErrorState, Loading, Toggle } from '../components/UI';
import { BackIcon } from '../components/Icons';

export function CardControls() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const card = useApi(() => api.cards.get(id), [id]);

  const [limit, setLimit] = useState('');
  const [saving, setSaving] = useState(false);

  // Seed the limit field once the card arrives, without clobbering typing.
  useEffect(() => {
    if (card.data && limit === '') {
      setLimit(card.data.card.controls.monthlyLimit?.amount ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.data]);

  async function update(patch: Parameters<typeof api.cards.updateControls>[1], label: string) {
    setSaving(true);
    try {
      await api.cards.updateControls(id, patch);
      toast(label);
      card.reload();
    } catch (err) {
      toast(err instanceof FintoApiError ? err.message : 'That did not save', '!');
    } finally {
      setSaving(false);
    }
  }

  if (card.loading && !card.data) {
    return (
      <div className="screen">
        <Loading rows={5} />
      </div>
    );
  }

  if (card.error || !card.data) {
    return (
      <div className="screen">
        <ErrorState message={card.error?.message ?? 'Card not found'} onRetry={card.reload} />
      </div>
    );
  }

  const { controls, last4 } = card.data.card;

  return (
    <div className="screen">
      <div className="screen-head">
        <button className="icon-btn" onClick={() => navigate('/cards')} aria-label="Back">
          <BackIcon />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Card controls</span>
        <span style={{ width: 44 }} />
      </div>

      <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 0 }}>
        Card ending {last4}. Changes take effect immediately.
      </p>

      <div className="stack" style={{ marginTop: 18 }}>
        <Toggle
          label="Online payments"
          hint="Card details entered on websites and in apps"
          checked={controls.onlinePayments}
          disabled={saving}
          onChange={(next) =>
            void update({ onlinePayments: next }, next ? 'Online payments on' : 'Online payments off')
          }
        />
        <Toggle
          label="Payments abroad"
          hint="Transactions outside your home country"
          checked={controls.paymentsAbroad}
          disabled={saving}
          onChange={(next) =>
            void update({ paymentsAbroad: next }, next ? 'Payments abroad on' : 'Payments abroad off')
          }
        />
        <Toggle
          label="Contactless"
          hint="Tap to pay at a terminal"
          checked={controls.contactless}
          disabled={saving}
          onChange={(next) => void update({ contactless: next }, next ? 'Contactless on' : 'Contactless off')}
        />
        <Toggle
          label="ATM withdrawals"
          hint="Taking cash out at a machine"
          checked={controls.atmWithdrawals}
          disabled={saving}
          onChange={(next) =>
            void update({ atmWithdrawals: next }, next ? 'ATM withdrawals on' : 'ATM withdrawals off')
          }
        />
      </div>

      <h2 className="section-label" style={{ margin: '26px 0 11px' }}>
        Monthly limit
      </h2>

      <div className="panel">
        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--muted)' }}>
          We block anything that would take you over this in a calendar month. Leave it empty for
          no limit.
        </p>

        <div style={{ display: 'flex', gap: 9 }}>
          <input
            className="input"
            inputMode="decimal"
            placeholder="No limit"
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/[^\d.]/g, ''))}
            aria-label="Monthly spending limit"
          />
          <button
            className="btn btn-dark"
            disabled={saving}
            onClick={() =>
              void update(
                { monthlyLimit: limit.trim() === '' ? null : limit.trim() },
                limit.trim() === '' ? 'Limit removed' : 'Limit saved'
              )
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
