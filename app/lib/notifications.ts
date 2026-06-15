import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from './supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device')
    return null
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('match-requests', {
      name: 'Match Requests',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    })
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data

  // Store in push_tokens table — separate from profiles, not publicly readable
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase
      .from('push_tokens')
      .upsert({ user_id: user.id, token, updated_at: new Date().toISOString() })
  }

  return token
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Called from root _layout to wire up notification tap handling
export function setupNotificationListeners(
  onMatchConfirmation: (matchId: string) => void
) {
  const sub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as any
    if (
      data?.type === 'match_request' &&
      typeof data?.matchId === 'string' &&
      UUID_RE.test(data.matchId)  // validate before using in navigation
    ) {
      onMatchConfirmation(encodeURIComponent(data.matchId))
    }
  })

  return () => sub.remove()
}
