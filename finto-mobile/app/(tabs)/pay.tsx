import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';
import { useApi } from '../../src/lib/useApi';
import { useDebounced } from '../../src/lib/useDebounced';
import { Avatar, Empty, ErrorState, Loading, Row, ScreenTitle, SectionLabel, T } from '../../src/components/UI';
import { ChevronIcon, RequestIcon, ScanIcon, SearchIcon } from '../../src/components/Icons';
import { colors, font, radius, space } from '../../src/lib/theme';

export default function Pay() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);

  const contacts = useApi(() => api.contacts.list(debounced || undefined), [debounced]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.xl, paddingTop: insets.top + 12, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenTitle>Pay</ScreenTitle>

      <View style={{ gap: 9, marginTop: 16 }}>
        <Row onPress={() => router.push('/request')}>
          <View style={styles.shortcutIcon}><RequestIcon size={19} /></View>
          <View style={{ flex: 1 }}>
            <T weight="bold" size={14.5}>Request money</T>
            <T size={12.5} color={colors.muted}>Share a link or a QR code</T>
          </View>
          <ChevronIcon />
        </Row>

        <Row onPress={() => router.push('/scan')}>
          <View style={styles.shortcutIcon}><ScanIcon size={19} /></View>
          <View style={{ flex: 1 }}>
            <T weight="bold" size={14.5}>Scan a code</T>
            <T size={12.5} color={colors.muted}>Point the camera at a Finto QR</T>
          </View>
          <ChevronIcon />
        </Row>
      </View>

      <View style={{ marginTop: 26, marginBottom: 11 }}>
        <SectionLabel>Send to</SectionLabel>
      </View>

      <View style={styles.search}>
        <SearchIcon />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name or @handle"
          placeholderTextColor={colors.faint}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {contacts.loading && !contacts.data ? (
        <Loading />
      ) : contacts.error ? (
        <ErrorState message={contacts.error.message} onRetry={contacts.reload} />
      ) : (contacts.data?.contacts.length ?? 0) === 0 ? (
        <Empty title="No one found" body={`Nobody matches “${debounced}”.`} />
      ) : (
        <View style={{ gap: 9 }}>
          {contacts.data?.contacts.map((contact) => (
            <Row
              key={contact.id}
              onPress={() =>
                router.push({
                  pathname: '/pay/amount',
                  params: {
                    contactId: contact.id,
                    name: contact.name,
                    tint: contact.tint,
                    initials: contact.initials
                  }
                })
              }
            >
              <Avatar initials={contact.initials} tintKey={contact.tint} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T weight="bold" size={14.5} numberOfLines={1}>{contact.name}</T>
                <T size={12.5} color={colors.muted} numberOfLines={1}>
                  {contact.handle}{contact.isFintoUser ? ' · Instant' : ''}
                </T>
              </View>
              <ChevronIcon />
            </Row>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shortcutIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.limeWash,
    alignItems: 'center',
    justifyContent: 'center'
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    marginBottom: 12,
    paddingHorizontal: 15,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface
  },
  searchInput: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: colors.ink }
});
