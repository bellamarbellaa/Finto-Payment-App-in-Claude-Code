import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  type TextStyle
} from 'react-native';
import { colors, font, radius, space, tint, type as type_ } from '../lib/theme';

/* ------------------------------------------------------------- text */

export function T({
  children,
  style,
  weight = 'medium',
  size = 15,
  color = colors.ink,
  numberOfLines,
  tabular
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  weight?: 'medium' | 'semibold' | 'bold' | 'extrabold';
  size?: number;
  color?: string;
  numberOfLines?: number;
  tabular?: boolean;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { fontFamily: font[weight], fontSize: size, color },
        // Amounts must line up in columns, exactly as on web.
        tabular && { fontVariant: ['tabular-nums'] },
        style
      ]}
    >
      {children}
    </Text>
  );
}

/* ----------------------------------------------------------- avatar */

export function Avatar({
  initials,
  tintKey,
  size = 42,
  brand
}: {
  initials: string;
  tintKey?: string;
  size?: number;
  /** The forest tile with a lime monogram, used in the home header. */
  brand?: boolean;
}) {
  const palette = brand ? { bg: colors.forest, fg: colors.lime } : tint(tintKey);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size / 3),
        backgroundColor: palette.bg,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <T weight="bold" size={size * 0.345} color={palette.fg}>
        {initials}
      </T>
    </View>
  );
}

/* ----------------------------------------------------------- button */

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  icon
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'dark' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
}) {
  const palette = {
    primary: { bg: colors.lime, fg: colors.ink, border: 'transparent' },
    dark: { bg: colors.ink, fg: colors.white, border: 'transparent' },
    ghost: { bg: colors.surface, fg: colors.ink, border: colors.hairline }
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled || loading ? 0.45 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }]
        },
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon}
          <T weight="bold" size={15} color={palette.fg}>
            {label}
          </T>
        </>
      )}
    </Pressable>
  );
}

/* -------------------------------------------------------------- row */

export function Row({
  children,
  onPress,
  style,
  align = 'center'
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  align?: 'center' | 'flex-start';
}) {
  const content = (
    <View style={[styles.row, { alignItems: align }, style]}>{children}</View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {content}
    </Pressable>
  );
}

/* ------------------------------------------------------------ chips */

export function Chip({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.ink : colors.surface,
          borderColor: active ? colors.ink : colors.hairline
        }
      ]}
    >
      <T weight="bold" size={13} color={active ? colors.white : colors.ink2}>
        {label}
      </T>
    </Pressable>
  );
}

export function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 4 }}>
      <T weight="bold" size={11.5} color={fg}>
        {label}
      </T>
    </View>
  );
}

/* ----------------------------------------------------------- toggle */

export function Toggle({
  label,
  hint,
  value,
  onChange,
  disabled
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      style={[styles.row, { opacity: disabled ? 0.55 : 1 }]}
    >
      <View style={{ flex: 1 }}>
        <T weight="bold" size={14.5}>{label}</T>
        {hint ? (
          <T size={12.5} color={colors.muted} style={{ marginTop: 2 }}>{hint}</T>
        ) : null}
      </View>

      <View
        style={{
          width: 46,
          height: 28,
          borderRadius: 999,
          backgroundColor: value ? colors.lime : colors.hairline,
          justifyContent: 'center'
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: colors.white,
            marginLeft: value ? 21 : 3,
            shadowColor: colors.ink,
            shadowOpacity: 0.28,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2
          }}
        />
      </View>
    </Pressable>
  );
}

/* ----------------------------------------------------------- states */

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={{ paddingVertical: 52, alignItems: 'center' }}>
      <ActivityIndicator color={colors.muted} />
      <T size={13} color={colors.faint} style={{ marginTop: 10 }}>{label}</T>
    </View>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ paddingVertical: 52, alignItems: 'center', paddingHorizontal: space.xl }}>
      <T weight="extrabold" size={17} style={{ marginBottom: 6 }}>{title}</T>
      <T size={14} color={colors.muted} style={{ textAlign: 'center' }}>{body}</T>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ paddingVertical: 46, alignItems: 'center', paddingHorizontal: space.xl }}>
      <T weight="extrabold" size={17} style={{ marginBottom: 6 }}>That didn’t load</T>
      <T size={14} color={colors.muted} style={{ textAlign: 'center', marginBottom: 16 }}>
        {message}
      </T>
      {onRetry ? <Button label="Try again" variant="ghost" onPress={onRetry} /> : null}
    </View>
  );
}

export function Alert({ message, kind = 'error' }: { message: string; kind?: 'error' | 'ok' }) {
  return (
    <View
      style={{
        backgroundColor: kind === 'error' ? colors.dangerBg : colors.limeWash,
        borderRadius: radius.md,
        padding: 12,
        marginBottom: space.md
      }}
    >
      <T weight="semibold" size={13.5} color={kind === 'error' ? colors.danger : colors.limeDeep}>
        {message}
      </T>
    </View>
  );
}

export function ScreenTitle({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[type_.screenTitle, { color: colors.ink }, style]}>{children}</Text>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <T weight="bold" size={12.5} color={colors.faint} style={{ letterSpacing: 0.5 }}>
      {String(children).toUpperCase()}
    </T>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    paddingHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
