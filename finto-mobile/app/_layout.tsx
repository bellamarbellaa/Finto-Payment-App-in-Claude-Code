import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { View } from 'react-native';
import {
  useFonts,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold
} from '@expo-google-fonts/manrope';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { LiveProvider } from '../src/lib/live';
import { ToastProvider } from '../src/lib/toast';
import { colors } from '../src/lib/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LiveProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <Gate />
          </ToastProvider>
        </LiveProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/**
 * Sends the user to login or into the app once the stored session has been
 * checked. Redirecting from a layout effect — rather than rendering a
 * different tree — keeps expo-router's navigation state consistent.
 */
function Gate() {
  const { user, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;

    void SplashScreen.hideAsync();

    const inApp = segments[0] === '(tabs)';

    if (!user && inApp) router.replace('/login');
    else if (user && !inApp && segments[0] === 'login') router.replace('/');
  }, [user, ready, segments, router]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.forest }} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
        animation: 'slide_from_right'
      }}
    >
      <Stack.Screen name="login" options={{ animation: 'fade' }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="pay/amount" />
      <Stack.Screen name="activity/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="request" />
      <Stack.Screen name="scan" />
      <Stack.Screen name="cards/[id]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="security" />
      <Stack.Screen name="help" />
    </Stack>
  );
}
