import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '../src/lib/api';
import { useApi } from '../src/lib/useApi';
import { useLive } from '../src/lib/live';
import { StackScreen } from '../src/components/Screen';
import { Empty, ErrorState, Loading, Row, T } from '../src/components/UI';
import { colors, tint } from '../src/lib/theme';

export default function Notifications() {
  const { setUnread } = useLive();
  const feed = useApi(() => api.notifications.list({ limit: 40 }), []);

  // Keep the home badge in step with what is on screen.
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
    <StackScreen
      title="Notifications"
      right={
        (feed.data?.unread ?? 0) > 0 ? (
          <Pressable onPress={() => void markAll()} accessibilityRole="button">
            <T weight="bold" size={12.5} color={colors.limeDeep}>Read all</T>
          </Pressable>
        ) : undefined
      }
    >
      {feed.loading && !feed.data ? (
        <Loading />
      ) : feed.error ? (
        <ErrorState message={feed.error.message} onRetry={feed.reload} />
      ) : items.length === 0 ? (
        <Empty title="All quiet" body="Payments and alerts will appear here." />
      ) : (
        <View style={{ gap: 9 }}>
          {items.map((item) => {
            const palette = tint(item.tint);
            return (
              <Row
                key={item.id}
                align="flex-start"
                onPress={() => {
                  if (!item.read) void api.notifications.markRead(item.id).then(() => feed.reload());
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 13,
                    backgroundColor: palette.bg,
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <T weight="bold" size={16} color={palette.fg}>{item.glyph}</T>
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                    <T weight="bold" size={14.5} style={{ flex: 1 }}>{item.title}</T>
                    <T size={12} color={colors.faint}>{item.timeAgo}</T>
                  </View>
                  <T size={13} color={colors.muted} style={{ marginTop: 3, lineHeight: 19 }}>
                    {item.body}
                  </T>
                </View>

                {!item.read ? (
                  <View
                    accessibilityLabel="Unread"
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime2, marginTop: 6 }}
                  />
                ) : null}
              </Row>
            );
          })}
        </View>
      )}
    </StackScreen>
  );
}
