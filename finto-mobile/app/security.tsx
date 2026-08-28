import { useState } from 'react';
import { View } from 'react-native';
import { FintoApiError } from '@finto/api-client';
import { api } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { useApi } from '../src/lib/useApi';
import { useToast } from '../src/lib/toast';
import { StackScreen } from '../src/components/Screen';
import { Button, Loading, Pill, Row, T, Toggle } from '../src/components/UI';
import { colors } from '../src/lib/theme';

export default function Security() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const sessions = useApi(() => api.auth.sessions(), [], { live: false });
  const [saving, setSaving] = useState(false);

  async function toggle(
    patch: { biometricEnabled?: boolean; confirmPayments?: boolean },
    label: string
  ) {
    setSaving(true);
    try {
      await api.users.updateSecurity(patch);
      await refreshUser();
      toast(label);
    } catch (err) {
      toast(err instanceof FintoApiError ? err.message : 'That did not save', '!');
    } finally {
      setSaving(false);
    }
  }

  async function signOutEverywhere() {
    setSaving(true);
    try {
      const result = await api.auth.revokeAllSessions(true);
      toast(`${result.revoked} device(s) signed out`);
      sessions.reload();
    } catch (err) {
      toast(err instanceof FintoApiError ? err.message : 'That did not work', '!');
    } finally {
      setSaving(false);
    }
  }

  return (
    <StackScreen title="Security">
      <View style={{ gap: 9 }}>
        <Toggle
          label="Face ID"
          hint="Approve payments and unlock with Face ID"
          value={user?.security.biometricEnabled ?? false}
          disabled={saving}
          onChange={(v) => void toggle({ biometricEnabled: v }, v ? 'Face ID on' : 'Face ID off')}
        />
        <Toggle
          label="Confirm every payment"
          hint="Ask before money leaves your account"
          value={user?.security.confirmPayments ?? true}
          disabled={saving}
          onChange={(v) =>
            void toggle({ confirmPayments: v }, v ? 'Confirmation on' : 'Confirmation off')
          }
        />
      </View>

      <T weight="bold" size={12.5} color={colors.faint} style={{ marginTop: 26, marginBottom: 11, letterSpacing: 0.5 }}>
        SIGNED-IN DEVICES
      </T>

      {sessions.loading && !sessions.data ? (
        <Loading />
      ) : (
        <View style={{ gap: 9 }}>
          {sessions.data?.sessions.map((session) => (
            <Row key={session.id}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T weight="bold" size={14} numberOfLines={1} style={{ flexShrink: 1 }}>
                    {shortenAgent(session.userAgent)}
                  </T>
                  {session.current ? (
                    <Pill label="This device" bg={colors.limeWash} fg={colors.limeDeep} />
                  ) : null}
                </View>
                <T size={12.5} color={colors.muted} style={{ marginTop: 1 }}>
                  {session.ip ?? 'Unknown location'}
                </T>
              </View>
            </Row>
          ))}
        </View>
      )}

      <Button
        label="Log out of all other devices"
        variant="ghost"
        style={{ marginTop: 14 }}
        loading={saving}
        onPress={() => void signOutEverywhere()}
      />
    </StackScreen>
  );
}

function shortenAgent(agent: string | null): string {
  if (!agent) return 'Unknown device';
  if (/iPhone|iOS|Darwin/.test(agent)) return 'iPhone';
  if (/Android/.test(agent)) return 'Android';
  if (/Edg\//.test(agent)) return 'Edge';
  if (/Chrome\//.test(agent)) return 'Chrome';
  if (/Firefox\//.test(agent)) return 'Firefox';
  if (/Safari\//.test(agent)) return 'Safari';
  return 'Browser';
}
