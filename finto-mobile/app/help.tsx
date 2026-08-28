import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { api } from '../src/lib/api';
import { useApi } from '../src/lib/useApi';
import { useDebounced } from '../src/lib/useDebounced';
import { StackScreen } from '../src/components/Screen';
import { Button, Empty, Loading, T } from '../src/components/UI';
import { SearchIcon } from '../src/components/Icons';
import { colors, font, radius } from '../src/lib/theme';

export default function Help() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const debounced = useDebounced(query, 200);

  const faq = useApi(() => api.support.faq(debounced || undefined), [debounced], { live: false });

  return (
    <StackScreen title="Help">
      <View style={styles.search}>
        <SearchIcon />
        <TextInput
          style={styles.searchInput}
          placeholder="Search help"
          placeholderTextColor={colors.faint}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>

      {faq.loading && !faq.data ? (
        <Loading />
      ) : (faq.data?.faq.length ?? 0) === 0 ? (
        <Empty title="Nothing found" body={`No answers match “${debounced}”.`} />
      ) : (
        <View style={{ gap: 9 }}>
          {faq.data?.faq.map((item) => {
            const expanded = open === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setOpen(expanded ? null : item.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={styles.item}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <T weight="bold" size={14.5} style={{ flex: 1 }}>{item.question}</T>
                  <T size={19} color={colors.faint}>{expanded ? '−' : '+'}</T>
                </View>
                {expanded ? (
                  <T size={13.5} color={colors.muted} style={{ marginTop: 10, lineHeight: 21 }}>
                    {item.answer}
                  </T>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.contact}>
        <T weight="extrabold" size={16} color={colors.white} style={{ marginBottom: 6 }}>
          Still stuck?
        </T>
        <T size={13.5} color="rgba(255,255,255,.68)" style={{ marginBottom: 14, lineHeight: 20 }}>
          Our team answers in minutes, day or night.
        </T>
        <Button label="Message support" onPress={() => {}} style={{ alignSelf: 'flex-start', height: 42 }} />
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    marginBottom: 18,
    paddingHorizontal: 15,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface
  },
  searchInput: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  item: {
    padding: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline
  },
  contact: {
    marginTop: 22,
    padding: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.forest
  }
});
