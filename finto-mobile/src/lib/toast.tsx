import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../components/UI';
import { colors, radius } from './theme';

interface Toast { id: number; message: string; glyph: string; }

const ToastContext = createContext<((message: string, glyph?: string) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const insets = useSafeAreaInsets();

  const push = useCallback((message: string, glyph = '✓') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, glyph }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 3600);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <View
          pointerEvents="none"
          style={[styles.wrap, { bottom: insets.bottom + 96 }]}
          accessibilityLiveRegion="polite"
        >
          {toasts.map((toast) => (
            <View key={toast.id} style={styles.toast}>
              <View style={styles.glyph}>
                <T weight="extrabold" size={13} color={colors.ink}>{toast.glyph}</T>
              </View>
              <T weight="semibold" size={13.5} color={colors.white} style={{ flex: 1 }}>
                {toast.message}
              </T>
            </View>
          ))}
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error('useToast must be used inside ToastProvider');
  return push;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, gap: 8 },
  toast: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  glyph: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
