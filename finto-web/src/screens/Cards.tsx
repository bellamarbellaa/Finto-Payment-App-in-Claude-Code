import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FintoApiError, type Card } from '@finto/api-client';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { Empty, ErrorState, Loading, ScreenHead } from '../components/UI';
import { ChevronIcon, SnowIcon } from '../components/Icons';

export function Cards() {
  const navigate = useNavigate();
  const toast = useToast();
  const cards = useApi(() => api.cards.list(), []);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleFreeze(card: Card) {
    setBusyId(card.id);
    try {
      const next = card.state !== 'frozen';
      await api.cards.freeze(card.id, next);
      toast(next ? 'Card frozen' : 'Card unfrozen', next ? '❄' : '✓');
      cards.reload();
    } catch (err) {
      toast(err instanceof FintoApiError ? err.message : 'That did not work', '!');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="screen">
      <ScreenHead title="Cards" />

      {cards.loading && !cards.data ? (
        <Loading rows={1} height={214} />
      ) : cards.error ? (
        <ErrorState message={cards.error.message} onRetry={cards.reload} />
      ) : (cards.data?.cards.length ?? 0) === 0 ? (
        <Empty title="No cards yet" body="Issue a virtual card to start spending." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {cards.data?.cards.map((card) => (
            <section key={card.id}>
              {/* The card face — forest when live, the design's grey when frozen. */}
              <div
                className="card-face"
                style={{ background: card.state === 'frozen' ? 'var(--forest-2)' : 'var(--forest)' }}
              >
                <div className="card-glow" aria-hidden="true" />

                <div className="card-face-top">
                  <span>Finto {card.brand === 'visa' ? 'Visa' : card.brand}</span>
                  {card.state !== 'active' && (
                    <span className="card-state">{card.state === 'frozen' ? 'Frozen' : 'Terminated'}</span>
                  )}
                </div>

                <div className="card-number tnum">
                  {card.state === 'frozen' ? card.maskedNumber : `•••• •••• •••• ${card.last4}`}
                </div>

                <div className="card-face-bottom">
                  <div>
                    <span>Card holder</span>
                    <strong>{card.holderName}</strong>
                  </div>
                  <div>
                    <span>Expires</span>
                    <strong className="tnum">{card.expiry}</strong>
                  </div>
                </div>
              </div>

              {card.spending && (
                <div className="limit-block">
                  <div className="limit-head">
                    <span className="tnum">
                      {card.spending.thisMonth.formatted} spent this month
                    </span>
                    {card.controls.monthlyLimit && (
                      <span className="tnum" style={{ color: 'var(--muted)' }}>
                        of {card.controls.monthlyLimit.formatted}
                      </span>
                    )}
                  </div>
                  {card.controls.monthlyLimit && (
                    <div className="limit-track">
                      <div
                        className="limit-fill"
                        style={{
                          width: `${Math.min(100, card.spending.limitUsedPercent ?? 0)}%`,
                          background:
                            (card.spending.limitUsedPercent ?? 0) > 85
                              ? 'var(--danger)'
                              : 'var(--lime)'
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  disabled={busyId === card.id || card.state === 'terminated'}
                  onClick={() => void toggleFreeze(card)}
                >
                  <SnowIcon size={17} color="var(--ink)" />
                  {card.state === 'frozen' ? 'Unfreeze' : 'Freeze'}
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  onClick={() => navigate(`/cards/${card.id}/controls`)}
                >
                  Controls
                  <ChevronIcon size={16} color="var(--ink)" />
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
