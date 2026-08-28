import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { FintoApiError, type PaymentRequest } from '@finto/api-client';
import { api } from '../src/lib/api';
import { useToast } from '../src/lib/toast';
import { Alert, Avatar, Button, T } from '../src/components/UI';
import { BackIcon, CheckIcon } from '../src/components/Icons';
import { colors, radius, space } from '../src/lib/theme';

type Resolved = PaymentRequest & {
  requester: { fullName: string; handle: string; tint: string } | null;
};

export default function Scan() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The camera fires this repeatedly while a code is in frame, so it is guarded
   * against re-entry — otherwise one QR would trigger a dozen lookups.
   */
  async function onScanned({ data }: { data: string }) {
    if (busy || resolved) return;

    setBusy(true);
    setError(null);

    try {
      const result = await api.payments.scan(data);
      setResolved(result.request as Resolved);
    } catch (err) {
      setError(err instanceof FintoApiError ? err.message : 'That code could not be read.');
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!resolved) return;
    setBusy(true);
    setError(null);
    try {
      await api.payments.payRequest(resolved.linkToken);
      setPaid(true);
      toast('Payment sent');
    } catch (err) {
      setError(err instanceof FintoApiError ? err.message : 'That payment could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------------------------------ permission */

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: colors.ink }} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 40 }]}>
        <T weight="extrabold" size={22} style={{ textAlign: 'center', marginBottom: 8 }}>
          Camera access
        </T>
        <T size={14.5} color={colors.muted} style={{ textAlign: 'center', marginBottom: 22 }}>
          Finto needs the camera to scan payment codes. Nothing is recorded or uploaded.
        </T>
        <Button label="Allow camera" onPress={() => void requestPermission()} />
        <Button label="Go back" variant="ghost" style={{ marginTop: 9 }} onPress={() => router.back()} />
      </View>
    );
  }

  /* ------------------------------------------------------------ paid */

  if (paid && resolved) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 60 }]}>
        <View style={styles.successMark}><CheckIcon size={34} /></View>
        <T weight="extrabold" size={26} style={{ letterSpacing: -1.05 }}>Paid</T>
        <T size={14.5} color={colors.muted} style={{ marginTop: 6 }}>
          {resolved.requester?.fullName} has been paid.
        </T>
        <T weight="extrabold" size={38} tabular style={{ marginTop: 20, letterSpacing: -1.7 }}>
          {resolved.amount.formatted}
        </T>
        <Button
          label="Done"
          style={{ marginTop: 30, alignSelf: 'stretch' }}
          onPress={() => router.replace('/(tabs)')}
        />
      </View>
    );
  }

  /* -------------------------------------------------------- confirm */

  if (resolved) {
    return (
      <View style={{ flex: 1, padding: space.xl, paddingTop: insets.top + 8 }}>
        <Head onBack={() => setResolved(null)} title="Confirm" />

        <View style={styles.panel}>
          <Avatar
            initials={initialsOf(resolved.requester?.fullName ?? '?')}
            tintKey={resolved.requester?.tint}
            size={56}
          />
          <T size={13.5} color={colors.muted} style={{ marginTop: 14 }}>
            {resolved.requester?.fullName ?? 'Someone'} is requesting
          </T>
          <T weight="extrabold" size={38} tabular style={{ marginVertical: 6, letterSpacing: -1.7 }}>
            {resolved.amount.formatted}
          </T>
          {resolved.note ? <T size={14} color={colors.muted}>{resolved.note}</T> : null}
        </View>

        {error ? <Alert message={error} /> : null}

        <Button
          label={busy ? 'Sending…' : `Pay ${resolved.amount.formatted}`}
          loading={busy}
          onPress={() => void pay()}
          style={{ marginTop: 18 }}
        />
        <Button
          label="Scan something else"
          variant="ghost"
          style={{ marginTop: 9 }}
          onPress={() => { setResolved(null); setError(null); }}
        />
      </View>
    );
  }

  /* --------------------------------------------------------- camera */

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={(event) => void onScanned(event)}
      />

      <View style={[styles.overlay, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 30 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.overlayBtn}
          >
            <BackIcon color={colors.white} />
          </Pressable>
          <T weight="bold" size={15} color={colors.white}>Scan to pay</T>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.reticle} />

        <View style={{ alignItems: 'center', gap: 10 }}>
          {error ? (
            <View style={styles.errorChip}>
              <T weight="bold" size={13} color={colors.white}>{error}</T>
            </View>
          ) : (
            <T weight="semibold" size={14} color="rgba(255,255,255,.8)">
              {busy ? 'Reading…' : 'Point at a Finto QR code'}
            </T>
          )}
        </View>
      </View>
    </View>
  );
}

function Head({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.head}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={styles.iconBtn}
      >
        <BackIcon />
      </Pressable>
      <T weight="bold" size={15}>{title}</T>
      <View style={{ width: 44 }} />
    </View>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '')).toUpperCase();
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  overlay: { flex: 1, justifyContent: 'space-between', paddingHorizontal: space.xl },
  overlayBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,.16)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  reticle: {
    alignSelf: 'center',
    width: 236,
    height: 236,
    borderRadius: radius.xxl,
    borderWidth: 3,
    borderColor: colors.lime
  },
  errorChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: colors.danger
  },
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
  },
  panel: {
    alignItems: 'center',
    padding: 24,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline
  },
  successMark: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22
  }
});
