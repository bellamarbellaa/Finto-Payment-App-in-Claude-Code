import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T } from './UI';
import { BackIcon } from './Icons';
import { colors, radius, space } from '../lib/theme';

/** A pushed screen with a back button — the shape every stack route shares. */
export function StackScreen({
  title,
  children,
  right,
  onBack
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.xl, paddingTop: insets.top + 8, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.head}>
        <Pressable
          onPress={onBack ?? (() => router.back())}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.iconBtn}
        >
          <BackIcon />
        </Pressable>
        <T weight="bold" size={15}>{title}</T>
        <View style={{ width: 44, alignItems: 'flex-end' }}>{right}</View>
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18
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
  }
});
