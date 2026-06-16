import '../global.css'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useRouter, useSegments } from 'expo-router'
import { supabase } from '../lib/supabase'
import { registerForPushNotifications, setupNotificationListeners } from '../lib/notifications'

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const inAuthGroup = segments[0] === '(auth)'

      if (!session && !inAuthGroup) {
        router.replace('/(auth)/login')
      } else if (session && inAuthGroup) {
        router.replace('/(tabs)')
        registerForPushNotifications()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    return setupNotificationListeners((matchId) => {
      router.push(`/match/confirm/${matchId}`)
    })
  }, [])

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#f5f5f5',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0a0a0a' },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="match/[id]"
          options={{ title: 'Match', presentation: 'card' }}
        />
        <Stack.Screen
          name="match/confirm/[id]"
          options={{ title: 'Confirm Match', presentation: 'modal' }}
        />
        <Stack.Screen
          name="player/[username]"
          options={{ title: 'Player', presentation: 'card' }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{ title: 'Edit Profile', presentation: 'modal' }}
        />
      </Stack>
    </>
  )
}
