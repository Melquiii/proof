import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import type { Match } from '../../types'

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [match, setMatch] = useState<Match | null>(null)
  const [ratingEvents, setRatingEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)

      const { data } = await supabase
        .from('matches')
        .select('*, p1:p1_id(id,display_name,username), p2:p2_id(id,display_name,username), sets:match_sets(*)')
        .eq('id', id)
        .single()

      setMatch(data as any)

      if (data) {
        const { data: events } = await supabase
          .from('rating_history')
          .select('*')
          .eq('match_id', id)
          .in('user_id', [data.p1_id, data.p2_id])

        setRatingEvents(events || [])
      }

      setLoading(false)
    }
    load()
  }, [id])

  async function handleAction(action: 'confirm' | 'reject' | 'cancel') {
    setActing(true)
    const newStatus = action === 'confirm' ? 'confirmed' : action === 'reject' ? 'rejected' : 'cancelled'

    const { error } = await supabase
      .from('matches')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      Alert.alert('Error', 'Could not update match.')
      setActing(false)
      return
    }

    if (action === 'confirm') {
      await supabase.functions.invoke('update-ratings', { body: { matchId: id } })
    }

    router.replace('/(tabs)')
  }

  if (loading) return (
    <View className="flex-1 bg-proof-black items-center justify-center">
      <ActivityIndicator color="#f5f5f5" />
    </View>
  )

  if (!match) return (
    <View className="flex-1 bg-proof-black items-center justify-center px-4">
      <Text className="text-proof-white">Match not found.</Text>
    </View>
  )

  const sets = (match as any).sets?.sort((a: any, b: any) => a.set_number - b.set_number) ?? []
  const p1 = (match.p1 as any)
  const p2 = (match.p2 as any)
  const isConfirmed = match.status === 'confirmed'
  const isPending = match.status === 'pending'
  const isP1 = userId === match.p1_id
  const isP2 = userId === match.p2_id

  const p1Event = ratingEvents.find(e => e.user_id === match.p1_id)
  const p2Event = ratingEvents.find(e => e.user_id === match.p2_id)

  function DeltaBadge({ delta }: { delta: number }) {
    const positive = delta >= 0
    return (
      <Text className={`text-sm font-bold ${positive ? 'text-proof-green' : 'text-red-400'}`}>
        {positive ? '+' : ''}{Math.round(delta)}
      </Text>
    )
  }

  return (
    <ScrollView className="flex-1 bg-proof-black" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Status chip */}
      <View className={`self-start px-3 py-1 rounded-full mb-5 ${
        isConfirmed ? 'bg-proof-green/20' :
        isPending ? 'bg-amber-500/20' :
        'bg-red-500/20'
      }`}>
        <Text className={`text-xs font-semibold capitalize ${
          isConfirmed ? 'text-proof-green' :
          isPending ? 'text-amber-400' :
          'text-red-400'
        }`}>{match.status}</Text>
      </View>

      {/* Players */}
      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-1 items-center">
          <Text className={`font-bold text-lg text-center ${match.winner_id === match.p1_id ? 'text-proof-green' : 'text-proof-white'}`}>
            {p1?.display_name}
          </Text>
          <Text className="text-proof-muted text-xs">@{p1?.username}</Text>
          {isConfirmed && p1Event && <DeltaBadge delta={p1Event.delta} />}
        </View>

        <Text className="text-proof-muted text-xl font-bold mx-4">vs</Text>

        <View className="flex-1 items-center">
          <Text className={`font-bold text-lg text-center ${match.winner_id === match.p2_id ? 'text-proof-green' : 'text-proof-white'}`}>
            {p2?.display_name}
          </Text>
          <Text className="text-proof-muted text-xs">@{p2?.username}</Text>
          {isConfirmed && p2Event && <DeltaBadge delta={p2Event.delta} />}
        </View>
      </View>

      {/* Set scores */}
      <View className="bg-proof-card border border-proof-border rounded-2xl p-4 mb-5">
        <Text className="text-proof-muted text-xs uppercase tracking-wider mb-3">Score</Text>

        <View className="flex-row mb-2">
          <Text className="flex-1 text-center text-proof-muted text-xs">{p1?.display_name}</Text>
          <View className="w-8" />
          <Text className="flex-1 text-center text-proof-muted text-xs">{p2?.display_name}</Text>
        </View>

        {sets.map((set: any, i: number) => {
          const p1Won = set.p1_games > set.p2_games
          return (
            <View key={i} className="flex-row items-center py-2 border-b border-proof-border">
              <Text className={`flex-1 text-center font-bold text-xl ${p1Won ? 'text-proof-white' : 'text-proof-muted'}`}>
                {set.p1_games}
              </Text>
              <Text className="w-8 text-center text-proof-muted text-xs">S{set.set_number}</Text>
              <Text className={`flex-1 text-center font-bold text-xl ${!p1Won ? 'text-proof-white' : 'text-proof-muted'}`}>
                {set.p2_games}
              </Text>
            </View>
          )
        })}
      </View>

      {/* Meta */}
      <View className="bg-proof-card border border-proof-border rounded-xl px-4 py-3 mb-5">
        <Text className="text-proof-muted text-xs uppercase tracking-wider mb-2">Details</Text>
        <Text className="text-proof-muted text-sm">Sport: <Text className="text-proof-white capitalize">{match.sport}</Text></Text>
        <Text className="text-proof-muted text-sm mt-1">Surface: <Text className="text-proof-white capitalize">{match.surface ?? 'Not specified'}</Text></Text>
        <Text className="text-proof-muted text-sm mt-1">
          Played: <Text className="text-proof-white">{new Date(match.played_at).toLocaleDateString()}</Text>
        </Text>
      </View>

      {/* Actions — only for pending matches */}
      {isPending && isP2 && (
        <View className="gap-3">
          <TouchableOpacity
            className="bg-proof-green rounded-xl py-4 items-center"
            onPress={() => handleAction('confirm')}
            disabled={acting}
          >
            {acting
              ? <ActivityIndicator color="#000" />
              : <Text className="text-black font-bold text-base">Confirm Match</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            className="border border-red-500/40 rounded-xl py-4 items-center"
            onPress={() => handleAction('reject')}
            disabled={acting}
          >
            <Text className="text-red-400 font-semibold text-base">Reject — Score is Wrong</Text>
          </TouchableOpacity>
        </View>
      )}

      {isPending && isP1 && (
        <TouchableOpacity
          className="border border-proof-border rounded-xl py-4 items-center"
          onPress={() => Alert.alert(
            'Cancel Match',
            'Remove this match request?',
            [
              { text: 'Keep it', style: 'cancel' },
              { text: 'Cancel Match', style: 'destructive', onPress: () => handleAction('cancel') },
            ]
          )}
          disabled={acting}
        >
          <Text className="text-proof-muted font-semibold">Cancel Match Request</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}
