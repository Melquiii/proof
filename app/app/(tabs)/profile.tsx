import { useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { getRatingBand, isProvisional, computeReliabilityScore } from '@proof/algorithms'
import { useRatingHistory } from '../../hooks/useRatingHistory'
import { RatingChart } from '../../components/RatingChart'
import { Avatar } from '../../components/Avatar'
import type { Profile, SportRating, Match } from '../../types'
import { toPlayerRating } from '../../types'

export default function ProfileScreen() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | undefined>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [rating, setRating] = useState<SportRating | null>(null)
  const [recentMatches, setRecentMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const { history } = useRatingHistory(userId ?? '', 'tennis', 30)

  useFocusEffect(useCallback(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const [{ data: p }, { data: r }, { data: m }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('sport_ratings').select('*').eq('user_id', user.id).eq('sport', 'tennis').single(),
        supabase
          .from('matches')
          .select('*, p1:p1_id(id,display_name,username), p2:p2_id(id,display_name,username)')
          .or(`p1_id.eq.${user.id},p2_id.eq.${user.id}`)
          .eq('status', 'confirmed')
          .order('played_at', { ascending: false })
          .limit(5),
      ])

      setProfile(p)
      setRating(r)
      setRecentMatches((m as any) || [])
      setLoading(false)
    }
    load()
  }, []))

  if (loading) return (
    <View className="flex-1 bg-proof-black items-center justify-center">
      <ActivityIndicator color="#f5f5f5" />
    </View>
  )

  const band = rating ? getRatingBand(rating.rating) : null
  const pr = rating ? toPlayerRating(rating) : null
  const provisional = pr ? isProvisional(pr) : false
  const reliability = pr ? computeReliabilityScore(pr) : 0

  return (
    <ScrollView className="flex-1 bg-proof-black" contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View className="px-4 pt-6 pb-4 border-b border-proof-border">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-3">
            {profile && <Avatar name={profile.display_name} size={52} />}
            <View>
              <Text className="text-proof-white text-2xl font-bold">{profile?.display_name}</Text>
              <Text className="text-proof-muted">@{profile?.username}</Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              className="border border-proof-border rounded-xl px-3 py-2"
              onPress={() => router.push('/edit-profile')}
            >
              <Text className="text-proof-muted text-sm">Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="border border-proof-border rounded-xl px-3 py-2"
              onPress={async () => {
                await supabase.auth.signOut()
                router.replace('/(auth)/login')
              }}
            >
              <Text className="text-proof-muted text-sm">Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {profile?.city && (
          <Text className="text-proof-muted text-sm">📍 {profile.city}{profile.country ? `, ${profile.country}` : ''}</Text>
        )}
      </View>

      {/* Rating card */}
      {rating && (
        <View className="mx-4 mt-4 bg-proof-card border border-proof-border rounded-2xl p-5">
          <View className="flex-row items-end justify-between mb-3">
            <View>
              <Text className="text-proof-muted text-xs uppercase tracking-wider mb-1">Tennis Rating</Text>
              <View className="flex-row items-baseline gap-2">
                <Text className="text-proof-white text-5xl font-bold">{Math.round(rating.rating)}</Text>
                {provisional && (
                  <Text className="text-amber-400 text-sm font-semibold">Provisional</Text>
                )}
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

          {history.length >= 2 && (
            <View className="mt-3 pt-3 border-t border-proof-border">
              <Text className="text-proof-muted text-xs mb-2">Rating progression</Text>
              <RatingChart history={history} height={60} />
            </View>
          )}

          <View className="flex-row gap-4 pt-3 border-t border-proof-border mt-3">
            <View>
              <Text className="text-proof-muted text-xs">Matches</Text>
              <Text className="text-proof-white font-semibold">{rating.match_count}</Text>
            </View>
            <View>
              <Text className="text-proof-muted text-xs">Uncertainty</Text>
              <Text className="text-proof-white font-semibold">±{Math.round(rating.rating_deviation)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Coming soon — other sports */}
      <View className="mx-4 mt-4 bg-proof-card border border-dashed border-proof-border rounded-2xl p-4">
        <Text className="text-proof-muted text-sm font-semibold mb-2">Coming to PROOF</Text>
        {['Badminton', 'Table Tennis', 'Pickleball', 'Basketball'].map(sport => (
          <Text key={sport} className="text-proof-muted text-sm py-0.5">· {sport}</Text>
        ))}
      </View>

      {/* Recent matches */}
      <View className="px-4 mt-6">
        <Text className="text-proof-white font-bold text-lg mb-3">Recent Matches</Text>
        {recentMatches.length === 0
          ? <Text className="text-proof-muted">No confirmed matches yet.</Text>
          : recentMatches.map(match => (
            <TouchableOpacity
              key={match.id}
              className="bg-proof-card border border-proof-border rounded-xl p-4 mb-3"
              onPress={() => router.push(`/match/${match.id}`)}
            >
              <Text className="text-proof-white font-semibold">
                {(match.p1 as any)?.display_name} vs {(match.p2 as any)?.display_name}
              </Text>
              <Text className="text-proof-muted text-sm capitalize mt-0.5">{match.surface ?? 'Unknown surface'}</Text>
            </TouchableOpacity>
          ))
        }
      </View>
    </ScrollView>
  )
}
