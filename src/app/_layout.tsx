import { Tabs } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { Music, Library, Youtube } from 'lucide-react-native';

import { PlayerProvider } from '@/context/PlayerContext';
import PlayerBar from '@/components/PlayerBar';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <PlayerProvider>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: isDark ? '#E53E3E' : '#C53030',
            tabBarInactiveTintColor: '#718096',
            tabBarStyle: {
              backgroundColor: isDark ? '#1A202C' : '#FFFFFF',
              borderTopColor: isDark ? '#2D3748' : '#E2E8F0',
              height: 60,
              paddingBottom: 8,
              paddingTop: 8,
            },
            headerShown: false,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'İndirici',
              tabBarIcon: ({ color }) => (
                <Music size={22} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="youtube"
            options={{
              title: 'YouTube',
              tabBarIcon: ({ color }) => (
                <Youtube size={22} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="explore"
            options={{
              title: 'Kütüphane',
              tabBarIcon: ({ color }) => (
                <Library size={22} color={color} />
              ),
            }}
          />
        </Tabs>
        <PlayerBar />
      </ThemeProvider>
    </PlayerProvider>
  );
}
