import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { useLive } from '../../src/lib/live';
import { Avatar, Button, Row, ScreenTitle, T } from '../../src/components/UI';
import {
  BellIcon,
  CardsIcon,
  ChevronIcon,
  HelpIcon,
  LockIcon,
  WalletIcon
} from '../../src/components/Icons';
import { colors, radius, space } from '../../src/lib/theme';

export default function Profile() {
  const { user, signOut } = useAuth();
  const { connected } = useLive();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const items = [
    { label: 'Cards', hint: 'Freeze, limits, controls', to: '/cards', Icon: CardsIcon },
    { label: 'Notifications', hint: 'Alerts and payment updates', to: '/notifications', Icon: BellIcon },
    { label: 'Security', hint: 'Face ID, PIN, password', to: '/security', Icon: LockIcon },
    { label: 'Help', hint: 'FAQs and support', to: '/help', Icon: HelpIcon }
  ] as const;

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.xl, paddingTop: insets.top + 12, paddingBottom: 40 }}
    >
      <ScreenTitle>Profile</ScreenTitle>

      <View style={styles.card}>
        <Avatar initials={user?.initials ?? '··'} tintKey={user?.tint} size={58} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T weight="extrabold" size={18} numberOfLines={1}>{user?.fullName}</T>
          <T size={13.5} color={colors.muted}>{user?.handle}</T>
          <T size={13} color={colors.faint} numberOfLines={1}>{user?.email}</T>
        </View>
      </View>

      <View style={styles.status}>
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: connected ? colors.income : colors.hairline2
          }}
        />
        <T weight="semibold" size={11.5} color={colors.faint}>
          {connected ? 'Live — updates arrive instantly' : 'Reconnecting…'}
        </T>
      </View>

      <View style={{ gap: 9, marginTop: 12 }}>
        <Row onPress={() => router.push('/(tabs)/cards')}>
          <View style={styles.itemIcon}><WalletIcon size={18} /></View>
          <View style={{ flex: 1 }}>
            <T weight="bold" size={14.5}>Accounts & balances</T>
            <T size={12.5} color={colors.muted}>{user?.baseCurrency ?? 'USD'} and more</T>
          </View>
          <ChevronIcon />
        </Row>

        {items.map(({ label, hint, to, Icon }) => (
          <Row key={to} onPress={() => router.push(to)}>
            <View style={styles.itemIcon}><Icon size={18} /></View>
            <View style={{ flex: 1 }}>
              <T weight="bold" size={14.5}>{label}</T>
              <T size={12.5} color={colors.muted}>{hint}</T>
            </View>
            <ChevronIcon />
          </Row>
        ))}
      </View>

      <Button
        label="Log out"
        variant="ghost"
        style={{ marginTop: 22 }}
        onPress={() => void signOut()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    padding: 18,
    marginTop: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.limeWash,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
