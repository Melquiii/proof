import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import type { Surface } from '../../types'

const SURFACES: { value: Surface; label: string }[] = [
  { value: 'hard', label: 'Hard' },
  { value: 'clay', label: 'Clay' },
  { value: 'grass', label: 'Grass' },
  { value: 'indoor', label: 'Indoor' },
]

interface SetInput { p1: string; p2: string }

export default function LogMatchScreen() {
  const router = useRouter()
  const [myId, setMyId] = useState<string | null>(null)
  const [opponentSearch, setOpponentSearch] = useState('')
  const [opponent, setOpponent] = useState<{ id: string; display_name: string; username: string } | null>(null)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [surface, setSurface] = useState<Surface>('hard')
  const [sets, setSets] = useState<SetInput[]>([{ p1: '', p2: '' }])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setMyId(user?.id ?? null))
  }, [])

  async function searchOpponents(query: string) {
    setOpponentSearch(query)
    if (query.length < 2) { setSearchResults([]); return }
    let q = supabase
      .from('profiles')
      .select('id, display_name, username')
      .ilike('username', `%${query}%`)
      .limit(6)
    if (myId) q = q.neq('id', myId)
    const { data } = await q
    setSearchResults(data || [])
  }

  function addSet() {
    if (sets.length < 5) setSets(s => [...s, { p1: '', p2: '' }])
  }

  function removeSet() {
    if (sets.length > 1) setSets(s => s.slice(0, -1))
  }

  function updateSet(index: number, side: 'p1' | 'p2', value: string) {
    setSets(s => s.map((set, i) => i === index ? { ...set, [side]: value } : set))
  }

  function validateSets() {
    for (const set of sets) {
      const p1 = parseInt(set.p1)
      const p2 = parseInt(set.p2)
      if (isNaN(p1) || isNaN(p2)) return false
      if (p1 < 0 || p2 < 0 || p1 > 7 || p2 > 7) return false
      if (p1 === p2) return false
    }
    return true
  }

  async function handleSubmit() {
    if (!opponent) { Alert.alert('Select an opponent first'); return }
    if (!validateSets()) { Alert.alert('Check set scores', 'Each set needs valid game scores (no ties, max 7).'); return }

    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const parsedSets = sets.map((set, i) => ({
      set_number: i + 1,
      p1_games: parseInt(set.p1),
      p2_games: parseInt(set.p2),
    }))

    const p1Sets = parsedSets.filter(s => s.p1_games > s.p2_games).length
    const p2Sets = parsedSets.filter(s => s.p2_games > s.p1_games).length
    const winnerId = p1Sets > p2Sets ? user.id : opponent.id

    const { data: match, error } = await supabase
      .from('matches')
      .insert({
        sport: 'tennis',
        format: 'singles',
        surface,
        status: 'pending',
        p1_id: user.id,
        p2_id: opponent.id,
        winner_id: winnerId,
        played_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !match) {
      Alert.alert('Error', 'Could not log match.')
      setSubmitting(false)
      return
    }

    await supabase.from('match_sets').insert(
      parsedSets.map(s => ({ ...s, match_id: match.id }))
    )

    // Notify opponent via push notification
    await supabase.functions.invoke('notify-match-request', { body: { matchId: match.id } })

    setSubmitting(false)
    Alert.alert(
      'Match Logged',
      `Waiting for ${opponent.display_name} to confirm.`,
      [{ text: 'OK', onPress: () => router.push('/(tabs)') }]
    )
  }

  return (
    <ScrollView className="flex-1 bg-proof-black" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text className="text-proof-white font-bold text-xl mb-5">Log a Match</Text>

      {/* Opponent */}
      <Text className="text-proof-muted text-xs uppercase tracking-wider mb-2">Opponent</Text>
      {opponent
        ? (
          <View className="bg-proof-card border border-proof-green/40 rounded-xl px-4 py-3 flex-row items-center justify-between mb-5">
            <Text className="text-proof-white font-semibold">{opponent.display_name}</Text>
            <TouchableOpacity onPress={() => setOpponent(null)}>
              <Text className="text-proof-muted">Change</Text>
            </TouchableOpacity>
          </View>
        )
        : (
          <View className="mb-5">
            <TextInput
              className="bg-proof-card border border-proof-border rounded-xl px-4 py-3.5 text-proof-white mb-2"
              placeholder="Search by username..."
              placeholderTextColor="#737373"
              value={opponentSearch}
              onChangeText={searchOpponents}
              autoCapitalize="none"
            />
            {searchResults.map(r => (
              <TouchableOpacity
                key={r.id}
                className="bg-proof-card border border-proof-border rounded-xl px-4 py-3 mb-1"
                onPress={() => { setOpponent(r); setSearchResults([]) }}
              >
                <Text className="text-proof-white">{r.display_name}</Text>
                <Text className="text-proof-muted text-sm">@{r.username}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )
      }

      {/* Surface */}
      <Text className="text-proof-muted text-xs uppercase tracking-wider mb-2">Surface</Text>
      <View className="flex-row gap-2 mb-5">
        {SURFACES.map(s => (
          <TouchableOpacity
            key={s.value}
            className={`flex-1 py-2.5 rounded-xl border items-center ${surface === s.value ? 'bg-proof-white border-proof-white' : 'bg-proof-card border-proof-border'}`}
            onPress={() => setSurface(s.value)}
          >
            <Text className={`text-sm font-semibold ${surface === s.value ? 'text-proof-black' : 'text-proof-muted'}`}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Set Scores */}
      <Text className="text-proof-muted text-xs uppercase tracking-wider mb-2">Set Scores</Text>
      <View className="flex-row mb-2">
        <Text className="flex-1 text-center text-proof-muted text-xs">You</Text>
        <View className="w-8" />
        <Text className="flex-1 text-center text-proof-muted text-xs">Opponent</Text>
      </View>

      {sets.map((set, i) => (
        <View key={i} className="flex-row items-center mb-2">
          <TextInput
            className="flex-1 bg-proof-card border border-proof-border rounded-xl px-4 py-3 text-proof-white text-center text-lg font-bold"
            keyboardType="number-pad"
            maxLength={1}
            value={set.p1}
            onChangeText={v => updateSet(i, 'p1', v)}
          />
          <Text className="text-proof-muted text-xl font-bold w-8 text-center">–</Text>
          <TextInput
            className="flex-1 bg-proof-card border border-proof-border rounded-xl px-4 py-3 text-proof-white text-center text-lg font-bold"
            keyboardType="number-pad"
            maxLength={1}
            value={set.p2}
            onChangeText={v => updateSet(i, 'p2', v)}
          />
        </View>
      ))}

      <View className="flex-row gap-3 mb-6">
        {sets.length < 5 && (
          <TouchableOpacity className="flex-1 border border-proof-border rounded-xl py-2.5 items-center" onPress={addSet}>
            <Text className="text-proof-muted text-sm">+ Add Set</Text>
          </TouchableOpacity>
        )}
        {sets.length > 1 && (
          <TouchableOpacity className="flex-1 border border-proof-border rounded-xl py-2.5 items-center" onPress={removeSet}>
            <Text className="text-proof-muted text-sm">– Remove Set</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        className="bg-proof-white rounded-xl py-4 items-center"
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color="#0a0a0a" />
          : <Text className="text-proof-black font-bold text-base">Submit Match</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  )
}
