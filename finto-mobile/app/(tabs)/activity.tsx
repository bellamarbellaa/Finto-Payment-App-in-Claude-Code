import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';
import { useApi } from '../../src/lib/useApi';
import { useDebounced } from '../../src/lib/useDebounced';
import { useLive } from '../../src/lib/live';
import { Chip, Empty, ErrorState, Loading, ScreenTitle, SectionLabel, T } from '../../src/components/UI';
import { TransactionRow } from '../../src/components/TransactionRow';
import { SearchIcon } from '../../src/components/Icons';
import { colors, font, radius, space } from '../../src/lib/theme';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'income', label: 'Income' },
  { key: 'spending', label: 'Spending' },
  { key: 'pending', label: 'Pending' }
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

export default function Activity() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refresh } = useLive();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);

  const feed = useApi(
    () => api.transactions.list({ filter, q: debounced || undefined, limit: 50 }),
    [filter, debounced]
  );

  const groups = feed.data?.groups ?? [];

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.xl, paddingTop: insets.top + 12, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={feed.loading} onRefresh={refresh} tintColor={colors.muted} />
      }
    >
      <ScreenTitle>Activity</ScreenTitle>

      <View style={styles.search}>
        <SearchIcon />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or reference"
          placeholderTextColor={colors.faint}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 18 }}
      >
        {FILTERS.map((item) => (
          <Chip
            key={item.key}
            label={item.label}
            active={filter === item.key}
            onPress={() => setFilter(item.key)}
          />
        ))}
      </ScrollView>

      {feed.loading && !feed.data ? (
        <Loading />
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
        <View style={{ gap: 22 }}>
          {groups.map((group) => (
            <View key={group.key}>
              <View style={styles.dayHead}>
                <SectionLabel>{group.label}</SectionLabel>
                <T weight="bold" size={12.5} color={colors.muted} tabular>
                  {group.total}
                </T>
              </View>
              <View style={{ gap: 9 }}>
                {group.items.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    onPress={() => router.push(`/activity/${tx.id}`)}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 15,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface
  },
  searchInput: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 9
  }
});
