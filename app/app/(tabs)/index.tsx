import { useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import type { Match } from '../../types'

export default function HomeScreen() {
  const router = useRouter()
  const [myId, setMyId] = useState<string | null>(null)
  const [pendingMatches, setPendingMatches] = useState<Match[]>([])
  const [recentMatches, setRecentMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    const { data: pending } = await supabase
      .from('matches')
      .select('*, p1:p1_id(id,display_name,username,avatar_url), p2:p2_id(id,display_name,username,avatar_url)')
      .eq('p2_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    const { data: recent } = await supabase
      .from('matches')
      .select('*, p1:p1_id(id,display_name,username,avatar_url), p2:p2_id(id,display_name,username,avatar_url), sets:match_sets(*)')
      .or(`p1_id.eq.${user.id},p2_id.eq.${user.id}`)
      .eq('status', 'confirmed')
      .order('played_at', { ascending: false })
      .limit(10)

    setPendingMatches((pending as any) || [])
    setRecentMatches((recent as any) || [])
    setLoading(false)
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, []))

  if (loading) return (
    <View className="flex-1 bg-proof-black items-center justify-center">
      <ActivityIndicator color="#f5f5f5" />
    </View>
  )

  return (
    <ScrollView
      className="flex-1 bg-proof-black"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="#f5f5f5" />}
    >
      {pendingMatches.length > 0 && (
        <View className="px-4 pt-4">
          <Text className="text-proof-white font-bold text-lg mb-3">Awaiting Confirmation</Text>
          {pendingMatches.map(match => (
            <TouchableOpacity
              key={match.id}
              className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-3"
              onPress={() => router.push(`/match/confirm/${match.id}`)}
            >
              <Text className="text-proof-white font-semibold">
                {(match.p1 as any)?.display_name} challenged you
              </Text>
              <Text className="text-proof-muted text-sm mt-1">Tap to confirm or reject</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View className="px-4 pt-4 pb-8">
        <Text className="text-proof-white font-bold text-lg mb-3">Recent Matches</Text>
        {recentMatches.length === 0
          ? (
            <View className="bg-proof-card border border-proof-border rounded-xl p-6 items-center">
              <Text className="text-proof-muted text-center">No matches yet.</Text>
              <Text className="text-proof-muted text-sm text-center mt-1">Log your first match to start building your rating.</Text>
            </View>
          )
          : recentMatches.map(match => {
            const won = match.winner_id === myId
            const isP1 = match.p1_id === myId
            const opponent = isP1 ? (match.p2 as any) : (match.p1 as any)
            const sets = (match as any).sets?.sort((a: any, b: any) => a.set_number - b.set_number) ?? []
            const scoreStr = sets.map((s: any) =>
              isP1 ? `${s.p1_games}-${s.p2_games}` : `${s.p2_games}-${s.p1_games}`
            ).join('  ')

            return (
              <TouchableOpacity
                key={match.id}
                className="bg-proof-card border border-proof-border rounded-xl p-4 mb-3 flex-row items-center"
                onPress={() => router.push(`/match/${match.id}`)}
              >
                <View className={`w-8 h-8 rounded-lg items-center justify-center mr-3 ${won ? 'bg-proof-green/20' : 'bg-red-500/20'}`}>
                  <Text className={`text-xs font-bold ${won ? 'text-proof-green' : 'text-red-400'}`}>
                    {won ? 'W' : 'L'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-proof-white font-semibold">vs {opponent?.display_name}</Text>
                  <Text className="text-proof-muted text-sm mt-0.5">
                    {scoreStr || match.surface || 'Unknown surface'}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          })
        }
      </View>
    </ScrollView>
  )
}
