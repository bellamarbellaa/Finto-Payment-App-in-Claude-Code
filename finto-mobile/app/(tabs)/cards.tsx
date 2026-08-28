import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FintoApiError, type Card } from '@finto/api-client';
import { api } from '../../src/lib/api';
import { useApi } from '../../src/lib/useApi';
import { useToast } from '../../src/lib/toast';
import { Button, Empty, ErrorState, Loading, ScreenTitle, T } from '../../src/components/UI';
import { SnowIcon } from '../../src/components/Icons';
import { colors, radius, space } from '../../src/lib/theme';

export default function Cards() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
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
    <ScrollView
      contentContainerStyle={{ padding: space.xl, paddingTop: insets.top + 12, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={cards.loading} onRefresh={cards.reload} tintColor={colors.muted} />
      }
    >
      <ScreenTitle>Cards</ScreenTitle>

      {cards.loading && !cards.data ? (
        <Loading />
      ) : cards.error ? (
        <ErrorState message={cards.error.message} onRetry={cards.reload} />
      ) : (cards.data?.cards.length ?? 0) === 0 ? (
        <Empty title="No cards yet" body="Issue a virtual card to start spending." />
      ) : (
        <View style={{ gap: 26, marginTop: 16 }}>
          {cards.data?.cards.map((card) => (
            <View key={card.id}>
              {/* Forest when live, the design's grey when frozen. */}
              <View
                style={[
                  styles.face,
                  { backgroundColor: card.state === 'frozen' ? colors.forest2 : colors.forest }
                ]}
              >
                <View style={styles.glow} />

                <View style={styles.faceTop}>
                  <T weight="bold" size={13} color={colors.white}>
                    Finto {card.brand === 'visa' ? 'Visa' : card.brand}
                  </T>
                  {card.state !== 'active' ? (
                    <View style={styles.stateChip}>
                      <T weight="bold" size={11} color={colors.white}>
                        {card.state === 'frozen' ? 'Frozen' : 'Terminated'}
                      </T>
                    </View>
                  ) : null}
                </View>

                <T
                  weight="bold"
                  size={19}
                  color={colors.white}
                  tabular
                  style={{ marginTop: 'auto', letterSpacing: 2.6 }}
                >
                  {`•••• •••• •••• ${card.last4}`}
                </T>

                <View style={styles.faceBottom}>
                  <View style={{ gap: 3 }}>
                    <T weight="semibold" size={10.5} color="rgba(255,255,255,.5)">CARD HOLDER</T>
                    <T weight="bold" size={13.5} color={colors.white}>{card.holderName}</T>
                  </View>
                  <View style={{ gap: 3 }}>
                    <T weight="semibold" size={10.5} color="rgba(255,255,255,.5)">EXPIRES</T>
                    <T weight="bold" size={13.5} color={colors.white} tabular>{card.expiry}</T>
                  </View>
                </View>
              </View>

              {card.spending ? (
                <View style={{ marginTop: 16 }}>
                  <View style={styles.limitHead}>
                    <T weight="bold" size={13} tabular>
                      {card.spending.thisMonth.formatted} spent this month
                    </T>
                    {card.controls.monthlyLimit ? (
                      <T weight="bold" size={13} color={colors.muted} tabular>
                        of {card.controls.monthlyLimit.formatted}
                      </T>
                    ) : null}
                  </View>

                  {card.controls.monthlyLimit ? (
                    <View style={styles.track}>
                      <View
                        style={{
                          height: '100%',
                          borderRadius: 999,
                          width: `${Math.min(100, card.spending.limitUsedPercent ?? 0)}%`,
                          backgroundColor:
                            (card.spending.limitUsedPercent ?? 0) > 85 ? colors.danger : colors.lime
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 9, marginTop: 14 }}>
                <Button
                  label={card.state === 'frozen' ? 'Unfreeze' : 'Freeze'}
                  variant="ghost"
                  style={{ flex: 1 }}
                  loading={busyId === card.id}
                  disabled={card.state === 'terminated'}
                  icon={<SnowIcon size={17} />}
                  onPress={() => void toggleFreeze(card)}
                />
                <Button
                  label="Controls"
                  variant="ghost"
                  style={{ flex: 1 }}
                  onPress={() => router.push(`/cards/${card.id}`)}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  face: { borderRadius: radius.xxl, padding: 22, height: 214, overflow: 'hidden' },
  glow: {
    position: 'absolute',
    right: -46,
    bottom: -56,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(169,238,104,.12)'
  },
  faceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stateChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,.16)'
  },
  faceBottom: { marginTop: 18, flexDirection: 'row', gap: 30 },
  limitHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  track: { height: 8, borderRadius: 999, backgroundColor: colors.surface3, overflow: 'hidden' }
});
