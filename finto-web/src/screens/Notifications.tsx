import { useEffect } from 'react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useLive } from '../lib/live';
import { Empty, ErrorState, Loading, ScreenHead } from '../components/UI';
import { tint } from '../lib/tints';

export function Notifications() {
  const { setUnread } = useLive();
  const feed = useApi(() => api.notifications.list({ limit: 40 }), []);

  // The badge in the shell must agree with what is on screen.
  useEffect(() => {
    if (feed.data) setUnread(feed.data.unread);
  }, [feed.data, setUnread]);

  async function markAll() {
    await api.notifications.markAllRead();
    setUnread(0);
    feed.reload();
  }

  const items = feed.data?.notifications ?? [];

  return (
    <div className="screen">
      <ScreenHead
        title="Notifications"
        right={
          (feed.data?.unread ?? 0) > 0 ? (
            <button className="btn btn-ghost btn-sm" onClick={() => void markAll()}>
              Mark all read
            </button>
          ) : undefined
        }
      />

      {feed.loading && !feed.data ? (
        <Loading rows={5} />
      ) : feed.error ? (
        <ErrorState message={feed.error.message} onRetry={feed.reload} />
      ) : items.length === 0 ? (
        <Empty title="All quiet" body="Payments and alerts will appear here." />
      ) : (
        <div className="stack">
          {items.map((item) => {
            const style = tint(item.tint);
            return (
              <button
                key={item.id}
                className="row"
                style={{ alignItems: 'flex-start' }}
                onClick={() => {
                  if (!item.read) {
                    void api.notifications.markRead(item.id).then(() => feed.reload());
                  }
                }}
              >
                <span
                  className="avatar"
                  style={{ ...style, width: 40, height: 40, borderRadius: 13, fontSize: 16 }}
                  aria-hidden="true"
                >
                  {item.glyph}
                </span>

                <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 10
                    }}
                  >
                    <span style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-.015em' }}>
                      {item.title}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--faint)', flex: 'none' }}>
                      {item.timeAgo}
                    </span>
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 13,
                      color: 'var(--muted)',
                      marginTop: 3,
                      lineHeight: 1.5
                    }}
                  >
                    {item.body}
                  </span>
                </span>

                {!item.read && (
                  <span
                    aria-label="Unread"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: 'var(--lime-2)',
                      flex: 'none',
                      marginTop: 6
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
