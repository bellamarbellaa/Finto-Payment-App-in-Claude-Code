import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useDebounced } from '../lib/useDebounced';
import { Empty, ErrorState, Loading, ScreenHead } from '../components/UI';
import { SearchIcon } from '../components/Icons';
import { TransactionRow } from '../components/TransactionRow';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'income', label: 'Income' },
  { key: 'spending', label: 'Spending' },
  { key: 'pending', label: 'Pending' }
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

export function Activity() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);

  const feed = useApi(
    () => api.transactions.list({ filter, q: debounced || undefined, limit: 50 }),
    [filter, debounced]
  );

  const groups = feed.data?.groups ?? [];

  return (
    <div className="screen">
      <ScreenHead title="Activity" />

      <div className="search" style={{ marginBottom: 12 }}>
        <SearchIcon color="var(--faint)" />
        <input
          className="input"
          placeholder="Search by name or reference"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search transactions"
        />
      </div>

      <div className="filter-row" role="group" aria-label="Filter transactions">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            className="chip"
            aria-pressed={filter === item.key}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {feed.loading && !feed.data ? (
        <Loading rows={6} />
      ) : feed.error ? (
        <ErrorState message={feed.error.message} onRetry={feed.reload} />
      ) : groups.length === 0 ? (
        <Empty
          title="Nothing here yet"
          body={
            debounced
              ? `No transactions match “${debounced}”.`
              : 'When money moves, it will show up here.'
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {groups.map((group) => (
            <section key={group.key}>
              <div className="day-head">
                <span className="section-label">{group.label}</span>
                <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>
                  {group.total}
                </span>
              </div>
              <div className="stack">
                {group.items.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    onClick={() => navigate(`/activity/${tx.id}`)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
