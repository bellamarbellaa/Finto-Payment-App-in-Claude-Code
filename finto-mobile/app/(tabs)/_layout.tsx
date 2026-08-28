import { Tabs } from 'expo-router';
import { colors, font } from '../../src/lib/theme';
import {
  ActivityIcon,
  CardsIcon,
  HomeIcon,
  PayIcon,
  ProfileIcon
} from '../../src/components/Icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          height: 84,
          paddingTop: 8
        },
        tabBarLabelStyle: { fontFamily: font.bold, fontSize: 10.5, marginTop: 4 },
        sceneStyle: { backgroundColor: colors.paper }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <HomeIcon color={color} size={21} /> }}
      />
      <Tabs.Screen
        name="pay"
        options={{ title: 'Pay', tabBarIcon: ({ color }) => <PayIcon color={color} size={21} /> }}
      />
      <Tabs.Screen
        name="activity"
        options={{ title: 'Activity', tabBarIcon: ({ color }) => <ActivityIcon color={color} size={21} /> }}
      />
      <Tabs.Screen
        name="cards"
        options={{ title: 'Cards', tabBarIcon: ({ color }) => <CardsIcon color={color} size={21} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <ProfileIcon color={color} size={21} /> }}
      />
    </Tabs>
  );
}
