import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile, SportRating } from '../types'

export function useProfile(userId?: string) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [rating, setRating] = useState<SportRating | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('sport_ratings').select('*').eq('user_id', userId).eq('sport', 'tennis').single(),
    ]).then(([{ data: p }, { data: r }]) => {
      setProfile(p)
      setRating(r)
      setLoading(false)
    })
  }, [userId])

  return { profile, rating, loading }
}
