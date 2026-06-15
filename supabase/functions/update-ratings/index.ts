// Supabase Edge Function — runs after a match is confirmed
// Computes Glicko-2 rating updates for both players and writes to sport_ratings + rating_history

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  computeRatingUpdate,
  computeReliabilityScore,
  type PlayerRating,
  type MatchResult,
  type SetScore,
} from '../../packages/algorithms/src/tennis.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  try {
    const { matchId } = await req.json()
    if (!matchId) return new Response('matchId required', { status: 400 })

    // Fetch match + sets + both player ratings
    const { data: match, error: matchErr } = await supabase
      .from('matches')
      .select('*, sets:match_sets(*)')
      .eq('id', matchId)
      .eq('status', 'confirmed')
      .single()

    if (matchErr || !match) {
      return new Response('Match not found or not confirmed', { status: 404 })
    }

    const [{ data: r1 }, { data: r2 }] = await Promise.all([
      supabase.from('sport_ratings').select('*').eq('user_id', match.p1_id).eq('sport', 'tennis').single(),
      supabase.from('sport_ratings').select('*').eq('user_id', match.p2_id).eq('sport', 'tennis').single(),
    ])

    if (!r1 || !r2) return new Response('Player ratings not found', { status: 404 })

    const toPlayerRating = (r: any): PlayerRating => ({
      rating: r.rating,
      ratingDeviation: r.rating_deviation,
      volatility: r.volatility,
      matchCount: r.match_count,
      lastMatchAt: r.last_match_at ? new Date(r.last_match_at) : null,
    })

    const p1Rating = toPlayerRating(r1)
    const p2Rating = toPlayerRating(r2)

    const sets: SetScore[] = match.sets
      .sort((a: any, b: any) => a.set_number - b.set_number)
      .map((s: any) => ({ p1Games: s.p1_games, p2Games: s.p2_games }))

    const playedAt = new Date(match.played_at)

    // Compute updates (each player's perspective: p1 sees p2 as opponent, and vice versa)
    const p1Result: MatchResult = { opponentRating: p2Rating, sets, playedAt }
    const p2Sets = sets.map(s => ({ p1Games: s.p2Games, p2Games: s.p1Games })) // flip for p2's view
    const p2Result: MatchResult = { opponentRating: p1Rating, sets: p2Sets, playedAt }

    const p1Update = computeRatingUpdate(p1Rating, [p1Result])
    const p2Update = computeRatingUpdate(p2Rating, [p2Result])

    const newP1Reliability = computeReliabilityScore({
      ...p1Rating,
      rating: p1Update.rating,
      matchCount: p1Rating.matchCount + 1,
      lastMatchAt: playedAt,
    })
    const newP2Reliability = computeReliabilityScore({
      ...p2Rating,
      rating: p2Update.rating,
      matchCount: p2Rating.matchCount + 1,
      lastMatchAt: playedAt,
    })

    // Write updates in parallel
    await Promise.all([
      supabase.from('sport_ratings').update({
        rating: p1Update.rating,
        rating_deviation: p1Update.ratingDeviation,
        volatility: p1Update.volatility,
        match_count: r1.match_count + 1,
        reliability_score: newP1Reliability,
        last_match_at: playedAt.toISOString(),
      }).eq('user_id', match.p1_id).eq('sport', 'tennis'),

      supabase.from('sport_ratings').update({
        rating: p2Update.rating,
        rating_deviation: p2Update.ratingDeviation,
        volatility: p2Update.volatility,
        match_count: r2.match_count + 1,
        reliability_score: newP2Reliability,
        last_match_at: playedAt.toISOString(),
      }).eq('user_id', match.p2_id).eq('sport', 'tennis'),

      supabase.from('rating_history').insert([
        {
          user_id: match.p1_id,
          sport: 'tennis',
          match_id: matchId,
          old_rating: p1Rating.rating,
          new_rating: p1Update.rating,
          old_rd: p1Rating.ratingDeviation,
          new_rd: p1Update.ratingDeviation,
        },
        {
          user_id: match.p2_id,
          sport: 'tennis',
          match_id: matchId,
          old_rating: p2Rating.rating,
          new_rating: p2Update.rating,
          old_rd: p2Rating.ratingDeviation,
          new_rd: p2Update.ratingDeviation,
        },
      ]),
    ])

    return new Response(JSON.stringify({
      p1: { old: Math.round(p1Rating.rating), new: Math.round(p1Update.rating), delta: Math.round(p1Update.delta) },
      p2: { old: Math.round(p2Rating.rating), new: Math.round(p2Update.rating), delta: Math.round(p2Update.delta) },
    }), { headers: { 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error(err)
    return new Response('Internal error', { status: 500 })
  }
})
