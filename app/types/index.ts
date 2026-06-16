export type Sport = 'tennis'

export type Surface = 'hard' | 'clay' | 'grass' | 'indoor'

export type MatchStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled'

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  country: string | null
  city: string | null
  created_at: string
}

export interface SportRating {
  id: string
  user_id: string
  sport: Sport
  rating: number
  rating_deviation: number
  volatility: number
  match_count: number
  reliability_score: number
  last_match_at: string | null
  updated_at: string
}

export interface SetScore {
  set_number: number
  p1_games: number
  p2_games: number
}

export interface Match {
  id: string
  sport: Sport
  surface: Surface | null
  status: MatchStatus
  p1_id: string
  p2_id: string
  winner_id: string | null
  played_at: string
  created_at: string
  sets?: SetScore[]
  p1?: Profile
  p2?: Profile
}

export function toPlayerRating(r: SportRating) {
  return {
    rating: r.rating,
    ratingDeviation: r.rating_deviation,
    volatility: r.volatility,
    matchCount: r.match_count,
    lastMatchAt: r.last_match_at ? new Date(r.last_match_at) : null,
  }
}

export interface RankingEntry {
  user_id: string
  display_name: string
  username: string
  avatar_url: string | null
  city: string | null
  country: string | null
  sport: Sport
  rating: number
  rating_deviation: number
  match_count: number
  reliability_score: number
  city_rank: number
  country_rank: number
}
