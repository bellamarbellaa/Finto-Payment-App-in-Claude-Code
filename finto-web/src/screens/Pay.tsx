import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useDebounced } from '../lib/useDebounced';
import { Avatar, Empty, ErrorState, Loading, ScreenHead } from '../components/UI';
import { ChevronIcon, RequestIcon, ScanIcon, SearchIcon } from '../components/Icons';

export function Pay() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);

  const contacts = useApi(() => api.contacts.list(debounced || undefined), [debounced]);

  return (
    <div className="screen">
      <ScreenHead title="Pay" />

      <div className="pay-shortcuts">
        <button className="row" onClick={() => navigate('/request')}>
          <span className="quick-icon" style={{ width: 42, height: 42, borderRadius: 14 }}>
            <RequestIcon size={19} color="var(--ink)" />
          </span>
          <span style={{ flex: 1, textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, letterSpacing: '-.015em' }}>
              Request money
            </span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)' }}>
              Share a link or a QR code
            </span>
          </span>
          <ChevronIcon color="var(--faint)" />
        </button>

        <button className="row" onClick={() => navigate('/scan')}>
          <span className="quick-icon" style={{ width: 42, height: 42, borderRadius: 14 }}>
            <ScanIcon size={19} color="var(--ink)" />
          </span>
          <span style={{ flex: 1, textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, letterSpacing: '-.015em' }}>
              Pay a code
            </span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)' }}>
              Paste a Finto payment link
            </span>
          </span>
          <ChevronIcon color="var(--faint)" />
        </button>
      </div>

      <h2 className="section-label" style={{ margin: '26px 0 11px' }}>
        Send to
      </h2>

      <div className="search" style={{ marginBottom: 12 }}>
        <SearchIcon color="var(--faint)" />
        <input
          className="input"
          placeholder="Search name or @handle"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search contacts"
        />
      </div>

      {contacts.loading && !contacts.data ? (
        <Loading rows={5} />
      ) : contacts.error ? (
        <ErrorState message={contacts.error.message} onRetry={contacts.reload} />
      ) : (contacts.data?.contacts.length ?? 0) === 0 ? (
        <Empty title="No one found" body={`Nobody matches “${debounced}”.`} />
      ) : (
        <div className="stack">
          {contacts.data?.contacts.map((contact) => (
            <button
              key={contact.id}
              className="row"
              onClick={() =>
                navigate('/pay/amount', {
                  state: { contactId: contact.id, name: contact.name, tint: contact.tint, initials: contact.initials }
                })
              }
            >
              <Avatar initials={contact.initials} tintKey={contact.tint} />
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 14.5,
                    fontWeight: 700,
                    letterSpacing: '-.015em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {contact.name}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)' }}>
                  {contact.handle}
                  {contact.isFintoUser && ' · Instant'}
                </span>
              </span>
              <ChevronIcon color="var(--faint)" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
