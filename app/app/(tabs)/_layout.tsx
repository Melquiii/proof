import { Tabs } from 'expo-router'
import { Text, View } from 'react-native'
import { usePendingCount } from '../../hooks/usePendingCount'

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>{label}</Text>
}

function HomeIcon({ focused, badge }: { focused: boolean; badge: number }) {
  return (
    <View>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>🏠</Text>
      {badge > 0 && (
        <View style={{
          position: 'absolute', top: -2, right: -6,
          backgroundColor: '#f59e0b', borderRadius: 8,
          minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 3,
        }}>
          <Text style={{ color: '#000', fontSize: 10, fontWeight: '700' }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      )}
    </View>
  )
}

export default function TabsLayout() {
  const pending = usePendingCount()

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0a0a0a' },
        headerTintColor: '#f5f5f5',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#262626',
          paddingBottom: 4,
        },
        tabBarActiveTintColor: '#f5f5f5',
        tabBarInactiveTintColor: '#737373',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'PROOF',
          tabBarIcon: ({ focused }) => <HomeIcon focused={focused} badge={pending} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log Match',
          tabBarIcon: ({ focused }) => <TabIcon label="✚" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="rankings"
        options={{
          title: 'Rankings',
          tabBarIcon: ({ focused }) => <TabIcon label="🏆" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarIcon: ({ focused }) => <TabIcon label="🔍" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} />,
        }}
      />
    </Tabs>
  )
}
