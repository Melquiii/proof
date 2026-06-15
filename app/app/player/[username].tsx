import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { getRatingBand, isProvisional, computeReliabilityScore, winProbability } from '../../../packages/algorithms/src/tennis'
import type { Profile, SportRating, Match } from '../../types'

export default function PlayerProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [rating, setRating] = useState<SportRating | null>(null)
  const [recentMatches, setRecentMatches] = useState<Match[]>([])
  const [myRating, setMyRating] = useState<SportRating | null>(null)
  const [isFriend, setIsFriend] = useState(false)
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted'>('none')
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)

      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()

      if (!p) { setLoading(false); return }
      setProfile(p)

      const [{ data: r }, { data: m }, { data: myR }] = await Promise.all([
        supabase.from('sport_ratings').select('*').eq('user_id', p.id).eq('sport', 'tennis').single(),
        supabase
          .from('matches')
          .select('*, p1:p1_id(id,display_name,username), p2:p2_id(id,display_name,username), sets:match_sets(*)')
          .or(`p1_id.eq.${p.id},p2_id.eq.${p.id}`)
          .eq('status', 'confirmed')
          .order('played_at', { ascending: false })
          .limit(10),
        user ? supabase.from('sport_ratings').select('*').eq('user_id', user.id).eq('sport', 'tennis').single() : Promise.resolve({ data: null }),
      ])

      setRating(r)
      setRecentMatches((m as any) || [])
      setMyRating(myR)

      // Check friendship status
      if (user && p.id !== user.id) {
        const { data: friendship } = await supabase
          .from('friendships')
          .select('status')
          .or(`and(requester_id.eq.${user.id},addressee_id.eq.${p.id}),and(requester_id.eq.${p.id},addressee_id.eq.${user.id})`)
          .single()

        if (friendship) setFriendStatus(friendship.status as any)
      }

      setLoading(false)
    }
    load()
  }, [username])

  async function handleFollow() {
    if (!currentUserId || !profile) return
    const { error } = await supabase.from('friendships').insert({
      requester_id: currentUserId,
      addressee_id: profile.id,
    })
    if (!error) setFriendStatus('pending')
    else Alert.alert('Error', 'Could not send follow request.')
  }

  if (loading) return (
    <View className="flex-1 bg-proof-black items-center justify-center">
      <ActivityIndicator color="#f5f5f5" />
    </View>
  )

  if (!profile) return (
    <View className="flex-1 bg-proof-black items-center justify-center px-4">
      <Text className="text-proof-white text-center">Player not found.</Text>
    </View>
  )

  const isOwnProfile = currentUserId === profile.id
  const band = rating ? getRatingBand(rating.rating) : null
  const provisional = rating ? isProvisional({ ...rating, lastMatchAt: rating.last_match_at ? new Date(rating.last_match_at) : null }) : false
  const reliability = rating ? computeReliabilityScore({ ...rating, lastMatchAt: rating.last_match_at ? new Date(rating.last_match_at) : null }) : 0

  // Win probability against this player (if I have a rating too)
  const winProb = myRating && rating && !isOwnProfile
    ? winProbability(
        { ...myRating, lastMatchAt: myRating.last_match_at ? new Date(myRating.last_match_at) : null },
        { ...rating, lastMatchAt: rating.last_match_at ? new Date(rating.last_match_at) : null }
      )
    : null

  return (
    <ScrollView className="flex-1 bg-proof-black" contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View className="px-4 pt-6 pb-4 border-b border-proof-border">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-proof-white text-2xl font-bold">{profile.display_name}</Text>
            <Text className="text-proof-muted">@{profile.username}</Text>
            {profile.city && (
              <Text className="text-proof-muted text-sm mt-1">
                📍 {profile.city}{profile.country ? `, ${profile.country}` : ''}
              </Text>
            )}
          </View>

          {!isOwnProfile && (
            <TouchableOpacity
              className={`ml-4 px-4 py-2 rounded-xl border ${
                friendStatus === 'accepted' ? 'border-proof-green' :
                friendStatus === 'pending' ? 'border-proof-muted' :
                'border-proof-white bg-proof-white'
              }`}
              onPress={friendStatus === 'none' ? handleFollow : undefined}
              disabled={friendStatus !== 'none'}
            >
              <Text className={`text-sm font-semibold ${
                friendStatus === 'accepted' ? 'text-proof-green' :
                friendStatus === 'pending' ? 'text-proof-muted' :
                'text-proof-black'
              }`}>
                {friendStatus === 'accepted' ? 'Following' :
                 friendStatus === 'pending' ? 'Requested' :
                 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Rating card */}
      {rating ? (
        <View className="mx-4 mt-4 bg-proof-card border border-proof-border rounded-2xl p-5">
          <View className="flex-row items-end justify-between mb-3">
            <View>
              <Text className="text-proof-muted text-xs uppercase tracking-wider mb-1">Tennis Rating</Text>
              <View className="flex-row items-baseline gap-2">
                <Text className="text-proof-white text-5xl font-bold">{Math.round(rating.rating)}</Text>
                {provisional && <Text className="text-amber-400 text-sm font-semibold">Provisional</Text>}
              </View>
              <Text className="text-proof-muted mt-1">{band}</Text>
            </View>

            <View className="items-end">
              <Text className="text-proof-muted text-xs mb-1">Reliability</Text>
              <Text className={`text-2xl font-bold ${reliability >= 70 ? 'text-proof-green' : reliability >= 40 ? 'text-amber-400' : 'text-proof-muted'}`}>
                {reliability}%
              </Text>
            </View>
          </View>

          <View className="flex-row gap-4 pt-3 border-t border-proof-border">
            <View>
              <Text className="text-proof-muted text-xs">Matches</Text>
              <Text className="text-proof-white font-semibold">{rating.match_count}</Text>
            </View>
            <View>
              <Text className="text-proof-muted text-xs">Uncertainty</Text>
              <Text className="text-proof-white font-semibold">±{Math.round(rating.rating_deviation)}</Text>
            </View>
            {winProb !== null && (
              <View>
                <Text className="text-proof-muted text-xs">Your Win %</Text>
                <Text className={`font-semibold ${winProb >= 0.5 ? 'text-proof-green' : 'text-red-400'}`}>
                  {Math.round(winProb * 100)}%
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View className="mx-4 mt-4 bg-proof-card border border-proof-border rounded-2xl p-5">
          <Text className="text-proof-muted">No rating yet. Needs at least 1 confirmed match.</Text>
        </View>
      )}

      {/* Recent matches */}
      <View className="px-4 mt-6">
        <Text className="text-proof-white font-bold text-lg mb-3">Match History</Text>
        {recentMatches.length === 0
          ? <Text className="text-proof-muted">No confirmed matches yet.</Text>
          : recentMatches.map(match => {
            const isP1 = match.p1_id === profile.id
            const opponent = isP1 ? (match.p2 as any) : (match.p1 as any)
            const won = match.winner_id === profile.id
            const sets = (match as any).sets?.sort((a: any, b: any) => a.set_number - b.set_number) ?? []
            const scoreStr = sets.map((s: any) => isP1 ? `${s.p1_games}-${s.p2_games}` : `${s.p2_games}-${s.p1_games}`).join(', ')

            return (
              <TouchableOpacity
                key={match.id}
                className="bg-proof-card border border-proof-border rounded-xl p-4 mb-3"
                onPress={() => router.push(`/match/${match.id}`)}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-proof-white font-semibold">vs {opponent?.display_name}</Text>
                    <Text className="text-proof-muted text-sm">{scoreStr}</Text>
                  </View>
                  <Text className={`font-bold text-sm ${won ? 'text-proof-green' : 'text-red-400'}`}>
                    {won ? 'W' : 'L'}
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
