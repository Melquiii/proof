import { useCallback, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import type { RankingEntry } from '../../types'
import { Avatar } from '../../components/Avatar'

type Scope = 'city' | 'country'

export default function RankingsScreen() {
  const router = useRouter()
  const [scope, setScope] = useState<Scope>('city')
  const [rankings, setRankings] = useState<RankingEntry[]>([])
  const [userLocation, setUserLocation] = useState<{ city: string | null; country: string | null }>({ city: null, country: null })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('city, country')
      .eq('id', user.id)
      .single()

    if (profile) setUserLocation({ city: profile.city, country: profile.country })

    let query = supabase
      .from('rankings_by_city')
      .select('*')
      .eq('sport', 'tennis')
      .order('rating', { ascending: false })
      .limit(50)

    if (scope === 'city' && profile?.city) {
      query = query.eq('city', profile.city)
    } else if (scope === 'country' && profile?.country) {
      query = query.eq('country', profile.country)
    }

    const { data } = await query
    setRankings((data as any) || [])
    setLoading(false)
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, [scope]))

  const title = scope === 'city'
    ? (userLocation.city ?? 'Your City')
    : (userLocation.country ?? 'Your Country')

  return (
    <View className="flex-1 bg-proof-black">
      {/* Scope toggle */}
      <View className="flex-row px-4 pt-4 pb-3 gap-3">
        {(['city', 'country'] as Scope[]).map(s => (
          <TouchableOpacity
            key={s}
            className={`flex-1 py-2.5 rounded-xl border items-center ${scope === s ? 'bg-proof-white border-proof-white' : 'bg-proof-card border-proof-border'}`}
            onPress={() => setScope(s)}
          >
            <Text className={`text-sm font-semibold capitalize ${scope === s ? 'text-proof-black' : 'text-proof-muted'}`}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text className="text-proof-muted text-xs uppercase tracking-wider px-4 mb-3">{title} — Tennis</Text>

      {loading
        ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="#f5f5f5" /></View>
        : (
          <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="#f5f5f5" />}
          >
            {rankings.length === 0
              ? (
                <View className="px-4 py-10 items-center">
                  <Text className="text-proof-muted text-center">No ranked players here yet.</Text>
                  <Text className="text-proof-muted text-sm text-center mt-1">Need at least 3 confirmed matches to appear.</Text>
                </View>
              )
              : rankings.map((entry, i) => (
                <TouchableOpacity
                  key={entry.user_id}
                  className="flex-row items-center px-4 py-3.5 border-b border-proof-border"
                  onPress={() => router.push(`/player/${entry.username}`)}
                >
                  {/* Rank number */}
                  <Text className={`w-7 text-center font-bold text-sm ${i < 3 ? 'text-proof-gold' : 'text-proof-muted'}`}>
                    {i + 1}
                  </Text>

                  <Avatar name={entry.display_name} size={36} />

                  {/* Player info */}
                  <View className="flex-1 ml-3">
                    <Text className="text-proof-white font-semibold">{entry.display_name}</Text>
                    <Text className="text-proof-muted text-xs">@{entry.username}</Text>
                  </View>

                  {/* Rating */}
                  <View className="items-end">
                    <Text className="text-proof-white font-bold">{Math.round(entry.rating)}</Text>
                    <Text className="text-proof-muted text-xs">{entry.match_count} matches</Text>
                  </View>
                </TouchableOpacity>
              ))
            }
          </ScrollView>
        )
      }
    </View>
  )
}
