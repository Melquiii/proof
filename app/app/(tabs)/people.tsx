import { useState, useEffect } from 'react'
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { getRatingBand } from '@proof/algorithms'

interface PlayerResult {
  id: string
  username: string
  display_name: string
  city: string | null
  country: string | null
  rating: number | null
  match_count: number | null
}

export default function PeopleScreen() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlayerResult[]>([])
  const [searching, setSearching] = useState(false)
  const [myId, setMyId] = useState<string | null>(null)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setMyId(user.id)
      supabase
        .from('friendships')
        .select('addressee_id')
        .eq('requester_id', user.id)
        .eq('status', 'accepted')
        .then(({ data }) => {
          setFollowedIds(new Set((data ?? []).map(r => r.addressee_id)))
        })
    })
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('profiles')
        .select(`
          id, username, display_name, city, country,
          sport_ratings!inner(rating, match_count)
        `)
        .ilike('username', `%${query.trim()}%`)
        .neq('id', myId ?? '')
        .limit(20)

      setResults(
        (data ?? []).map((p: any) => ({
          id: p.id,
          username: p.username,
          display_name: p.display_name,
          city: p.city,
          country: p.country,
          rating: p.sport_ratings?.[0]?.rating ?? null,
          match_count: p.sport_ratings?.[0]?.match_count ?? null,
        }))
      )
      setSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, myId])

  async function follow(targetId: string) {
    if (!myId) return
    await supabase.from('friendships').upsert({
      requester_id: myId,
      addressee_id: targetId,
      status: 'accepted',
    })
    setFollowedIds(prev => new Set([...prev, targetId]))
  }

  async function unfollow(targetId: string) {
    if (!myId) return
    await supabase
      .from('friendships')
      .delete()
      .eq('requester_id', myId)
      .eq('addressee_id', targetId)
    setFollowedIds(prev => {
      const next = new Set(prev)
      next.delete(targetId)
      return next
    })
  }

  return (
    <View className="flex-1 bg-proof-black">
      <View className="px-4 pt-4 pb-3 border-b border-proof-border">
        <TextInput
          className="bg-proof-card border border-proof-border rounded-xl px-4 py-3 text-proof-white"
          placeholder="Search by username..."
          placeholderTextColor="#737373"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        {searching && (
          <View className="items-center py-8">
            <ActivityIndicator color="#f5f5f5" />
          </View>
        )}

        {!searching && query.length >= 2 && results.length === 0 && (
          <View className="items-center py-12">
            <Text className="text-proof-muted">No players found for "{query}"</Text>
          </View>
        )}

        {results.map(player => {
          const band = player.rating ? getRatingBand(player.rating) : null
          const followed = followedIds.has(player.id)

          return (
            <TouchableOpacity
              key={player.id}
              className="flex-row items-center justify-between px-4 py-4 border-b border-proof-border"
              onPress={() => router.push(`/player/${player.username}`)}
            >
              <View className="flex-1">
                <Text className="text-proof-white font-semibold">{player.display_name}</Text>
                <Text className="text-proof-muted text-sm">@{player.username}</Text>
                {(player.city || player.country) && (
                  <Text className="text-proof-muted text-xs mt-0.5">
                    {[player.city, player.country].filter(Boolean).join(', ')}
                  </Text>
                )}
              </View>

              <View className="items-end gap-2">
                {player.rating && (
                  <View className="items-end">
                    <Text className="text-proof-white font-bold">{Math.round(player.rating)}</Text>
                    <Text className="text-proof-muted text-xs">{band}</Text>
                  </View>
                )}
                <TouchableOpacity
                  className={`px-3 py-1 rounded-lg border ${followed ? 'border-proof-green' : 'border-proof-border'}`}
                  onPress={() => followed ? unfollow(player.id) : follow(player.id)}
                >
                  <Text className={`text-xs font-semibold ${followed ? 'text-proof-green' : 'text-proof-muted'}`}>
                    {followed ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )
        })}

        {query.length < 2 && (
          <View className="items-center py-16 px-8">
            <Text className="text-proof-muted text-center">Search for players to follow and challenge to matches.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
