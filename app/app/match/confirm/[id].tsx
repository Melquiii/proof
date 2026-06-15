import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import type { Match } from '../../../types'

export default function ConfirmMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('matches')
        .select('*, p1:p1_id(id,display_name,username), p2:p2_id(id,display_name,username), sets:match_sets(*)')
        .eq('id', id)
        .single()
      setMatch(data as any)
      setLoading(false)
    }
    load()
  }, [id])

  async function handleAction(action: 'confirm' | 'reject') {
    setActing(true)
    const newStatus = action === 'confirm' ? 'confirmed' : 'rejected'

    const { error } = await supabase
      .from('matches')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      Alert.alert('Error', 'Could not update match.')
      setActing(false)
      return
    }

    // If confirmed, trigger rating update via Edge Function (to be built)
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
      <Text className="text-proof-white text-center">Match not found.</Text>
    </View>
  )

  const sets = (match as any).sets?.sort((a: any, b: any) => a.set_number - b.set_number) ?? []
  const p1Name = (match.p1 as any)?.display_name
  const p2Name = (match.p2 as any)?.display_name

  return (
    <ScrollView className="flex-1 bg-proof-black" contentContainerStyle={{ padding: 16 }}>
      <Text className="text-proof-muted text-xs uppercase tracking-wider mb-1">Match Request</Text>
      <Text className="text-proof-white text-2xl font-bold mb-6">
        {p1Name} challenged you
      </Text>

      <View className="bg-proof-card border border-proof-border rounded-2xl p-5 mb-6">
        <Text className="text-proof-muted text-xs uppercase tracking-wider mb-3">Reported Score</Text>

        <View className="flex-row mb-2">
          <Text className="flex-1 text-proof-muted text-sm text-center">{p1Name}</Text>
          <View className="w-8" />
          <Text className="flex-1 text-proof-muted text-sm text-center">{p2Name}</Text>
        </View>

        {sets.map((set: any) => (
          <View key={set.set_number} className="flex-row items-center py-1.5 border-b border-proof-border">
            <Text className="flex-1 text-center text-proof-white font-bold text-xl">{set.p1_games}</Text>
            <Text className="w-8 text-center text-proof-muted">–</Text>
            <Text className="flex-1 text-center text-proof-white font-bold text-xl">{set.p2_games}</Text>
          </View>
        ))}

        <Text className="text-proof-muted text-xs mt-3 capitalize">Surface: {match.surface ?? 'not specified'}</Text>
      </View>

      <Text className="text-proof-muted text-sm mb-6">
        Confirming this match will update both players' ratings. Reject if the score is incorrect.
      </Text>

      <TouchableOpacity
        className="bg-proof-green rounded-xl py-4 items-center mb-3"
        onPress={() => handleAction('confirm')}
        disabled={acting}
      >
        {acting ? <ActivityIndicator color="#0a0a0a" /> : <Text className="text-black font-bold text-base">Confirm Match</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        className="border border-red-500/40 rounded-xl py-4 items-center"
        onPress={() => handleAction('reject')}
        disabled={acting}
      >
        <Text className="text-red-400 font-semibold text-base">Reject — Score is Wrong</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
