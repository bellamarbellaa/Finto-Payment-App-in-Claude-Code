import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';
import { useApi } from '../../src/lib/useApi';
import { useAuth } from '../../src/lib/auth';
import { useLive } from '../../src/lib/live';
import { Avatar, Button, ErrorState, Loading, SectionLabel, T } from '../../src/components/UI';
import { TransactionRow } from '../../src/components/TransactionRow';
import { BellIcon, PayIcon, RequestIcon, ScanIcon, WalletIcon } from '../../src/components/Icons';
import { colors, radius, space } from '../../src/lib/theme';

export default function Home() {
  const { user } = useAuth();
  const { unread, refresh } = useLive();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [hidden, setHidden] = useState(false);

  const accounts = useApi(() => api.accounts.list(), []);
  const recent = useApi(() => api.transactions.list({ limit: 4, grouped: false }), []);

  const busy = accounts.loading || recent.loading;

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.xl, paddingTop: insets.top + 8, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} tintColor={colors.muted} />}
    >
      {/* Greeting */}
      <View style={styles.greet}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <Avatar initials={user?.initials ?? '··'} size={42} brand />
          <View style={{ gap: 2 }}>
            <T weight="semibold" size={12.5} color={colors.faint}>{greeting()}</T>
            <T weight="bold" size={15.5}>{user?.displayName}</T>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel={`Notifications${unread ? `, ${unread} unread` : ''}`}
          style={styles.iconBtn}
        >
          <BellIcon />
          {unread > 0 ? <View style={styles.dot} /> : null}
        </Pressable>
      </View>

      {/* Balance surface */}
      <View style={styles.balance}>
        <View style={styles.glow} />
        <View style={styles.balanceTop}>
          <T weight="semibold" size={12.5} color="rgba(255,255,255,.6)">
            Total balance · {accounts.data?.baseCurrency ?? 'USD'}
          </T>
          <Pressable onPress={() => setHidden((h) => !h)} style={styles.balanceToggle}>
            <T weight="bold" size={11.5} color={colors.white}>{hidden ? 'Show' : 'Hide'}</T>
          </Pressable>
        </View>

        <T weight="extrabold" size={42} color={colors.white} tabular style={{ marginTop: 10, letterSpacing: -1.9 }}>
          {accounts.loading && !accounts.data
            ? '—'
            : hidden
              ? '••••••'
              : accounts.data?.total.formatted ?? '—'}
        </T>

        <View style={styles.balanceSplit}>
          {(accounts.data?.accounts ?? []).slice(0, 2).map((account, index) => (
            <View key={account.id} style={{ gap: 3 }}>
              <T weight="semibold" size={11.5} color="rgba(255,255,255,.55)">{account.name}</T>
              <T
                weight="bold"
                size={15}
                color={index === 1 ? colors.lime : colors.white}
                tabular
              >
                {hidden ? '••••' : account.balance.formatted}
              </T>
            </View>
          ))}
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.quickGrid}>
        <Quick label="Send" Icon={PayIcon} onPress={() => router.push('/pay')} />
        <Quick label="Request" Icon={RequestIcon} onPress={() => router.push('/request')} />
        <Quick label="Scan" Icon={ScanIcon} onPress={() => router.push('/scan')} />
        <Quick label="Accounts" Icon={WalletIcon} onPress={() => router.push('/cards')} />
      </View>

      {/* Recent */}
      <View style={styles.sectionHead}>
        <SectionLabel>Recent</SectionLabel>
        <Pressable onPress={() => router.push('/activity')}>
          <T weight="bold" size={13}>See all</T>
        </Pressable>
      </View>

      {recent.loading && !recent.data ? (
        <Loading />
      ) : recent.error ? (
        <ErrorState message={recent.error.message} onRetry={recent.reload} />
      ) : (
        <View style={{ gap: 9 }}>
          {recent.data?.transactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} onPress={() => router.push(`/activity/${tx.id}`)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Quick({
  label,
  Icon,
  onPress
}: {
  label: string;
  Icon: (p: { size?: number; color?: string }) => React.ReactElement;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.quick, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.quickIcon}>
        <Icon size={20} />
      </View>
      <T weight="bold" size={12.5}>{label}</T>
    </Pressable>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  greet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 20
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 5,
    backgroundColor: colors.lime,
    borderWidth: 1.6,
    borderColor: colors.surface
  },
  balance: {
    borderRadius: radius.xxxl,
    backgroundColor: colors.forest,
    padding: 22,
    paddingTop: 24,
    overflow: 'hidden'
  },
  glow: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(169,238,104,.13)'
  },
  balanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceToggle: {
    backgroundColor: 'rgba(255,255,255,.1)',
    borderRadius: 9,
    height: 28,
    paddingHorizontal: 10,
    justifyContent: 'center'
  },
  balanceSplit: {
    marginTop: 12,
    paddingTop: 14,
    flexDirection: 'row',
    gap: 22,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.12)'
  },
  quickGrid: { flexDirection: 'row', gap: 9, marginTop: 16 },
  quick: {
    flex: 1,
    height: 88,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.limeWash,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 26,
    marginBottom: 11
  }
});
