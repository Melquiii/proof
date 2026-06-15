// PROOF Tennis Rating Algorithm
// Glicko-2 with margin-of-victory weighting

export const TENNIS_CONSTANTS = {
  DEFAULT_RATING: 1500,
  DEFAULT_RD: 350,
  DEFAULT_VOLATILITY: 0.06,
  TAU: 0.5,           // system constant — controls volatility change speed
  MOV_WEIGHT: 0.8,    // margin-of-victory dampener (prevents edge scores)
  SCALE: 173.7178,    // Glicko-2 internal scale factor
  ROLLING_WINDOW_MATCHES: 30,
  ROLLING_WINDOW_DAYS: 90,
  DECAY_THRESHOLD_DAYS: 60,
  DECAY_C: 34.64,
  MIN_MATCHES_FOR_RANKING: 3,
  PROVISIONAL_THRESHOLD: 10,
} as const

export interface PlayerRating {
  rating: number
  ratingDeviation: number
  volatility: number
  matchCount: number
  lastMatchAt: Date | null
}

export interface SetScore {
  p1Games: number
  p2Games: number
}

export interface MatchResult {
  opponentRating: PlayerRating
  sets: SetScore[]   // p1 is always the player being updated
  playedAt: Date
}

export interface RatingUpdate {
  rating: number
  ratingDeviation: number
  volatility: number
  delta: number      // rating change for display
}

// ─────────────────────────────────────────
// MARGIN OF VICTORY
// ─────────────────────────────────────────

/**
 * Converts set scores into a continuous score (0–1) for the match winner.
 * A bagel 6-0, 6-0 win scores ~0.90. A tight 7-6, 7-6 scores ~0.53.
 * p1 wins if they won more sets; loser gets (1 - winner_score).
 */
export function computeMatchScore(sets: SetScore[]): { p1Score: number; p2Score: number } {
  let p1Sets = 0
  let p2Sets = 0
  let p1Games = 0
  let p2Games = 0

  for (const set of sets) {
    p1Games += set.p1Games
    p2Games += set.p2Games
    if (set.p1Games > set.p2Games) p1Sets++
    else p2Sets++
  }

  const totalGames = p1Games + p2Games
  if (totalGames === 0) return { p1Score: 0.5, p2Score: 0.5 }

  const p1WonMatch = p1Sets > p2Sets
  const winnerGames = p1WonMatch ? p1Games : p2Games
  const loserGames = p1WonMatch ? p2Games : p1Games
  const gameDiff = winnerGames - loserGames
  const dominance = gameDiff / totalGames

  const winnerScore = 0.5 + 0.5 * dominance * TENNIS_CONSTANTS.MOV_WEIGHT
  const loserScore = 1 - winnerScore

  return {
    p1Score: p1WonMatch ? winnerScore : loserScore,
    p2Score: p1WonMatch ? loserScore : winnerScore,
  }
}

// ─────────────────────────────────────────
// GLICKO-2 HELPERS
// ─────────────────────────────────────────

function toInternalScale(rating: number, rd: number) {
  const scale = TENNIS_CONSTANTS.SCALE
  return { mu: (rating - 1500) / scale, phi: rd / scale }
}

function toPublicScale(mu: number, phi: number) {
  const scale = TENNIS_CONSTANTS.SCALE
  return { rating: scale * mu + 1500, rd: scale * phi }
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI))
}

function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)))
}

// Illinois algorithm to find new volatility
function updateVolatility(
  phi: number,
  sigma: number,
  delta: number,
  v: number,
  tau: number
): number {
  const a = Math.log(sigma * sigma)
  const deltaSq = delta * delta
  const phiSq = phi * phi

  function f(x: number): number {
    const ex = Math.exp(x)
    const d = phiSq + v + ex
    return (ex * (deltaSq - d)) / (2 * d * d) - (x - a) / (tau * tau)
  }

  let A = a
  let B: number

  if (deltaSq > phiSq + v) {
    B = Math.log(deltaSq - phiSq - v)
  } else {
    let k = 1
    while (f(a - k * tau) < 0) k++
    B = a - k * tau
  }

  let fA = f(A)
  let fB = f(B)
  const epsilon = 1e-6
  const maxIter = 100

  for (let i = 0; i < maxIter; i++) {
    if (Math.abs(B - A) <= epsilon) break
    const C = A + ((A - B) * fA) / (fB - fA)
    const fC = f(C)
    if (fC * fB <= 0) {
      A = B
      fA = fB
    } else {
      fA /= 2
    }
    B = C
    fB = fC
  }

  return Math.exp(A / 2)
}

// ─────────────────────────────────────────
// TIME DECAY
// ─────────────────────────────────────────

/**
 * Increases RD for players who haven't played recently.
 * Called before each rating update, not on a schedule.
 */
export function applyTimeDecay(player: PlayerRating, asOf: Date): PlayerRating {
  if (!player.lastMatchAt) return player

  const daysSince = (asOf.getTime() - player.lastMatchAt.getTime()) / 86_400_000
  if (daysSince <= TENNIS_CONSTANTS.DECAY_THRESHOLD_DAYS) return player

  const scale = TENNIS_CONSTANTS.SCALE
  const phi = player.ratingDeviation / scale
  const c = TENNIS_CONSTANTS.DECAY_C / scale
  const periods = daysSince / 30
  const maxPhi = TENNIS_CONSTANTS.DEFAULT_RD / scale

  const decayedPhi = Math.min(maxPhi, Math.sqrt(phi * phi + c * c * periods))
  return { ...player, ratingDeviation: scale * decayedPhi }
}

// ─────────────────────────────────────────
// MAIN RATING UPDATE
// ─────────────────────────────────────────

/**
 * Computes a new rating for a player given a set of match results.
 * Handles multiple matches in one period (Glicko-2 batch update).
 * Returns the updated rating values and the rating delta.
 */
export function computeRatingUpdate(
  player: PlayerRating,
  results: MatchResult[]
): RatingUpdate {
  if (results.length === 0) {
    // No matches — only time decay
    const decayed = applyTimeDecay(player, new Date())
    return {
      rating: decayed.rating,
      ratingDeviation: decayed.ratingDeviation,
      volatility: decayed.volatility,
      delta: 0,
    }
  }

  // Apply time decay before update
  const decayed = applyTimeDecay(player, results[0].playedAt)

  const { mu, phi } = toInternalScale(decayed.rating, decayed.ratingDeviation)
  const sigma = decayed.volatility
  const tau = TENNIS_CONSTANTS.TAU

  // Build opponent data
  const opponents = results.map((r) => {
    const { mu: muJ, phi: phiJ } = toInternalScale(
      r.opponentRating.rating,
      r.opponentRating.ratingDeviation
    )
    const { p1Score } = computeMatchScore(r.sets)
    return { muJ, phiJ, score: p1Score }
  })

  // Step 3: estimated variance v
  const v =
    1 /
    opponents.reduce((sum, o) => {
      const gj = g(o.phiJ)
      const ej = E(mu, o.muJ, o.phiJ)
      return sum + gj * gj * ej * (1 - ej)
    }, 0)

  // Step 4: improvement over expected Δ
  const delta =
    v *
    opponents.reduce((sum, o) => {
      const gj = g(o.phiJ)
      const ej = E(mu, o.muJ, o.phiJ)
      return sum + gj * (o.score - ej)
    }, 0)

  // Step 5: new volatility
  const sigmaPrime = updateVolatility(phi, sigma, delta, v, tau)

  // Step 6: new RD and rating
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime)
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v)
  const muPrime =
    mu +
    phiPrime *
      phiPrime *
      opponents.reduce((sum, o) => {
        const gj = g(o.phiJ)
        const ej = E(mu, o.muJ, o.phiJ)
        return sum + gj * (o.score - ej)
      }, 0)

  const { rating: newRating, rd: newRd } = toPublicScale(muPrime, phiPrime)

  return {
    rating: Math.max(0, Math.min(3000, newRating)),
    ratingDeviation: Math.max(30, Math.min(350, newRd)),
    volatility: sigmaPrime,
    delta: newRating - player.rating,
  }
}

// ─────────────────────────────────────────
// RELIABILITY SCORE
// ─────────────────────────────────────────

export function computeReliabilityScore(player: PlayerRating, asOf = new Date()): number {
  const base = Math.min(80, player.matchCount * 5)

  let recency = 0
  if (player.lastMatchAt) {
    const days = (asOf.getTime() - player.lastMatchAt.getTime()) / 86_400_000
    if (days <= 30) recency = 20
    else if (days <= 90) recency = 10
  }

  const provisional = player.matchCount < TENNIS_CONSTANTS.PROVISIONAL_THRESHOLD ? -20 : 0
  return Math.max(0, Math.min(100, base + recency + provisional))
}

export function isProvisional(player: PlayerRating): boolean {
  return player.matchCount < TENNIS_CONSTANTS.PROVISIONAL_THRESHOLD
}

// ─────────────────────────────────────────
// RATING BAND
// ─────────────────────────────────────────

export type RatingBand = 'Beginner' | 'Recreational' | 'Intermediate' | 'Competitive' | 'Advanced' | 'Elite'

export function getRatingBand(rating: number): RatingBand {
  if (rating < 500) return 'Beginner'
  if (rating < 1000) return 'Recreational'
  if (rating <= 1500) return 'Intermediate'
  if (rating < 2000) return 'Competitive'
  if (rating < 2500) return 'Advanced'
  return 'Elite'
}

// ─────────────────────────────────────────
// WIN PROBABILITY PREVIEW (for predictions screen)
// ─────────────────────────────────────────

export function winProbability(playerRating: PlayerRating, opponentRating: PlayerRating): number {
  const { mu: muA, phi: phiA } = toInternalScale(playerRating.rating, playerRating.ratingDeviation)
  const { mu: muB, phi: phiB } = toInternalScale(opponentRating.rating, opponentRating.ratingDeviation)
  return E(muA, muB, phiB)
}
