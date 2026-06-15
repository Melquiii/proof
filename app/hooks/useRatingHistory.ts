import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface RatingPoint {
  rating: number
  delta: number
  matchId: string
  createdAt: string
}

export function useRatingHistory(userId: string, sport = 'tennis', limit = 20) {
  const [history, setHistory] = useState<RatingPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    supabase
      .from('rating_history')
      .select('new_rating, delta, match_id, created_at')
      .eq('user_id', userId)
      .eq('sport', sport)
      .order('created_at', { ascending: true })
      .limit(limit)
      .then(({ data }) => {
        setHistory(
          (data ?? []).map(r => ({
            rating: Math.round(r.new_rating),
            delta: Math.round(r.delta),
            matchId: r.match_id,
            createdAt: r.created_at,
          }))
        )
        setLoading(false)
      })
  }, [userId, sport, limit])

  return { history, loading }
}
