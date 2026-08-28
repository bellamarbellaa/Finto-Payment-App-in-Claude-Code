import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useDebounced } from '../lib/useDebounced';
import { Empty, Loading } from '../components/UI';
import { BackIcon, SearchIcon } from '../components/Icons';

export function Help() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const debounced = useDebounced(query, 200);

  const faq = useApi(() => api.support.faq(debounced || undefined), [debounced], { live: false });

  return (
    <div className="screen">
      <div className="screen-head">
        <button className="icon-btn" onClick={() => navigate('/profile')} aria-label="Back">
          <BackIcon />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Help</span>
        <span style={{ width: 44 }} />
      </div>

      <div className="search" style={{ margin: '8px 0 18px' }}>
        <SearchIcon color="var(--faint)" />
        <input
          className="input"
          placeholder="Search help"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search help"
        />
      </div>

      {faq.loading && !faq.data ? (
        <Loading rows={5} height={56} />
      ) : (faq.data?.faq.length ?? 0) === 0 ? (
        <Empty title="Nothing found" body={`No answers match “${debounced}”.`} />
      ) : (
        <div className="stack">
          {faq.data?.faq.map((item) => {
            const expanded = open === item.id;
            return (
              <div key={item.id} className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  onClick={() => setOpen(expanded ? null : item.id)}
                  aria-expanded={expanded}
                  style={{
                    width: '100%',
                    padding: '15px 16px',
                    border: 'none',
                    background: 'none',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}
                >
                  <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, letterSpacing: '-.015em' }}>
                    {item.question}
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      fontSize: 19,
                      color: 'var(--faint)',
                      transform: expanded ? 'rotate(45deg)' : 'none',
                      transition: 'transform .18s'
                    }}
                  >
                    +
                  </span>
                </button>

                {expanded && (
                  <div
                    style={{
                      padding: '0 16px 16px',
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      color: 'var(--muted)'
                    }}
                  >
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="panel" style={{ marginTop: 22, background: 'var(--forest)', border: 'none' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-.028em' }}>
          Still stuck?
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'rgba(255,255,255,.68)', lineHeight: 1.55 }}>
          Our team answers in minutes, day or night.
        </p>
        <button className="btn btn-primary btn-sm">Message support</button>
      </div>
    </div>
  );
}
