import { describe, it, expect } from 'vitest'
import {
  computeMatchScore,
  computeRatingUpdate,
  computeReliabilityScore,
  applyTimeDecay,
  winProbability,
  getRatingBand,
  isProvisional,
  TENNIS_CONSTANTS,
  type PlayerRating,
  type MatchResult,
} from './tennis'

const defaultPlayer = (): PlayerRating => ({
  rating: 1500,
  ratingDeviation: 350,
  volatility: 0.06,
  matchCount: 20,
  lastMatchAt: new Date(),
})

const establishedPlayer = (rating: number, rd = 50): PlayerRating => ({
  rating,
  ratingDeviation: rd,
  volatility: 0.06,
  matchCount: 50,
  lastMatchAt: new Date(),
})

// ─────────────────────────────────────────
// MARGIN OF VICTORY
// ─────────────────────────────────────────

describe('computeMatchScore', () => {
  it('bagel gives winner ~0.90', () => {
    const { p1Score, p2Score } = computeMatchScore([
      { p1Games: 6, p2Games: 0 },
      { p1Games: 6, p2Games: 0 },
    ])
    expect(p1Score).toBeGreaterThan(0.88)
    expect(p1Score).toBeLessThan(0.95)
    expect(p1Score + p2Score).toBeCloseTo(1)
  })

  it('tight 7-6 7-6 gives winner ~0.53', () => {
    const { p1Score } = computeMatchScore([
      { p1Games: 7, p2Games: 6 },
      { p1Games: 7, p2Games: 6 },
    ])
    expect(p1Score).toBeGreaterThan(0.51)
    expect(p1Score).toBeLessThan(0.57)
  })

  it('winner scores more than loser', () => {
    const { p1Score, p2Score } = computeMatchScore([
      { p1Games: 6, p2Games: 3 },
      { p1Games: 6, p2Games: 4 },
    ])
    expect(p1Score).toBeGreaterThan(p2Score)
  })

  it('p2 wins returns p2Score > p1Score', () => {
    const { p1Score, p2Score } = computeMatchScore([
      { p1Games: 2, p2Games: 6 },
      { p1Games: 3, p2Games: 6 },
    ])
    expect(p2Score).toBeGreaterThan(p1Score)
  })

  it('3-set match sums to 1', () => {
    const { p1Score, p2Score } = computeMatchScore([
      { p1Games: 7, p2Games: 5 },
      { p1Games: 4, p2Games: 6 },
      { p1Games: 6, p2Games: 4 },
    ])
    expect(p1Score + p2Score).toBeCloseTo(1)
    expect(p1Score).toBeGreaterThan(0.5) // p1 won
  })
})

// ─────────────────────────────────────────
// RATING UPDATE
// ─────────────────────────────────────────

describe('computeRatingUpdate', () => {
  it('beating a higher-rated player increases rating', () => {
    const player = establishedPlayer(1500)
    const opponent = establishedPlayer(1700)

    const result: MatchResult = {
      opponentRating: opponent,
      sets: [{ p1Games: 6, p2Games: 3 }, { p1Games: 6, p2Games: 4 }],
      playedAt: new Date(),
    }

    const update = computeRatingUpdate(player, [result])
    expect(update.rating).toBeGreaterThan(1500)
    expect(update.delta).toBeGreaterThan(0)
  })

  it('losing to a lower-rated player decreases rating', () => {
    const player = establishedPlayer(1700)
    const opponent = establishedPlayer(1300)

    const result: MatchResult = {
      opponentRating: opponent,
      sets: [{ p1Games: 2, p2Games: 6 }, { p1Games: 1, p2Games: 6 }],
      playedAt: new Date(),
    }

    const update = computeRatingUpdate(player, [result])
    expect(update.rating).toBeLessThan(1700)
    expect(update.delta).toBeLessThan(0)
  })

  it('expected win barely moves an established rating', () => {
    const player = establishedPlayer(1700, 50)
    const opponent = establishedPlayer(1300, 50)

    const result: MatchResult = {
      opponentRating: opponent,
      sets: [{ p1Games: 6, p2Games: 3 }, { p1Games: 6, p2Games: 4 }],
      playedAt: new Date(),
    }

    const update = computeRatingUpdate(player, [result])
    expect(Math.abs(update.delta)).toBeLessThan(10)
  })

  it('bagel win moves rating more than tight win', () => {
    const player = establishedPlayer(1500)
    const opponent = establishedPlayer(1500)

    const bagel: MatchResult = {
      opponentRating: opponent,
      sets: [{ p1Games: 6, p2Games: 0 }, { p1Games: 6, p2Games: 0 }],
      playedAt: new Date(),
    }
    const tight: MatchResult = {
      opponentRating: opponent,
      sets: [{ p1Games: 7, p2Games: 6 }, { p1Games: 7, p2Games: 6 }],
      playedAt: new Date(),
    }

    const bagelUpdate = computeRatingUpdate(player, [bagel])
    const tightUpdate = computeRatingUpdate(player, [tight])
    expect(bagelUpdate.delta).toBeGreaterThan(tightUpdate.delta)
  })

  it('new player with high RD gains/loses more per match', () => {
    const newPlayer = defaultPlayer() // RD 350
    const established = establishedPlayer(1500)

    const sameResult: MatchResult = {
      opponentRating: establishedPlayer(1500),
      sets: [{ p1Games: 6, p2Games: 3 }, { p1Games: 6, p2Games: 2 }],
      playedAt: new Date(),
    }

    const newUpdate = computeRatingUpdate(newPlayer, [sameResult])
    const estUpdate = computeRatingUpdate(established, [sameResult])
    expect(Math.abs(newUpdate.delta)).toBeGreaterThan(Math.abs(estUpdate.delta))
  })

  it('empty results returns unchanged rating', () => {
    const player = establishedPlayer(1600)
    const update = computeRatingUpdate(player, [])
    expect(update.rating).toBeCloseTo(1600, 0)
    expect(update.delta).toBe(0)
  })

  it('rating stays within 0–3000 bounds', () => {
    const highPlayer = establishedPlayer(2900)
    const lowOpponent = establishedPlayer(100)

    const result: MatchResult = {
      opponentRating: lowOpponent,
      sets: [{ p1Games: 6, p2Games: 0 }, { p1Games: 6, p2Games: 0 }],
      playedAt: new Date(),
    }

    const update = computeRatingUpdate(highPlayer, [result])
    expect(update.rating).toBeLessThanOrEqual(3000)
    expect(update.rating).toBeGreaterThanOrEqual(0)
  })
})

// ─────────────────────────────────────────
// TIME DECAY
// ─────────────────────────────────────────

describe('applyTimeDecay', () => {
  it('no decay if played recently', () => {
    const player = establishedPlayer(1500, 100)
    player.lastMatchAt = new Date(Date.now() - 30 * 86_400_000) // 30 days ago
    const decayed = applyTimeDecay(player, new Date())
    expect(decayed.ratingDeviation).toBeCloseTo(100, 1)
  })

  it('RD increases after 60+ inactive days', () => {
    const player = establishedPlayer(1500, 50)
    player.lastMatchAt = new Date(Date.now() - 120 * 86_400_000) // 120 days ago
    const decayed = applyTimeDecay(player, new Date())
    expect(decayed.ratingDeviation).toBeGreaterThan(50)
  })

  it('RD never exceeds 350', () => {
    const player = establishedPlayer(1500, 30)
    player.lastMatchAt = new Date(Date.now() - 3650 * 86_400_000) // 10 years
    const decayed = applyTimeDecay(player, new Date())
    expect(decayed.ratingDeviation).toBeLessThanOrEqual(350)
  })
})

// ─────────────────────────────────────────
// RELIABILITY SCORE
// ─────────────────────────────────────────

describe('computeReliabilityScore', () => {
  it('new player with 0 matches scores 0', () => {
    const player = defaultPlayer()
    player.matchCount = 0
    player.lastMatchAt = null
    expect(computeReliabilityScore(player)).toBe(0)
  })

  it('active player with many matches scores high', () => {
    const player = defaultPlayer()
    player.matchCount = 30
    player.lastMatchAt = new Date()
    const score = computeReliabilityScore(player)
    expect(score).toBeGreaterThan(60)
  })

  it('capped at 100', () => {
    const player = defaultPlayer()
    player.matchCount = 999
    player.lastMatchAt = new Date()
    expect(computeReliabilityScore(player)).toBe(100)
  })

  it('inactive player loses recency bonus', () => {
    const active = defaultPlayer()
    active.matchCount = 20
    active.lastMatchAt = new Date()

    const inactive = { ...active }
    inactive.lastMatchAt = new Date(Date.now() - 200 * 86_400_000)

    expect(computeReliabilityScore(active)).toBeGreaterThan(computeReliabilityScore(inactive))
  })
})

// ─────────────────────────────────────────
// PROVISIONAL
// ─────────────────────────────────────────

describe('isProvisional', () => {
  it('player under 10 matches is provisional', () => {
    const player = defaultPlayer()
    player.matchCount = 5
    expect(isProvisional(player)).toBe(true)
  })

  it('player with 10+ matches is not provisional', () => {
    const player = defaultPlayer()
    player.matchCount = 10
    expect(isProvisional(player)).toBe(false)
  })
})

// ─────────────────────────────────────────
// WIN PROBABILITY
// ─────────────────────────────────────────

describe('winProbability', () => {
  it('equal players have ~50% win probability', () => {
    const a = establishedPlayer(1500)
    const b = establishedPlayer(1500)
    expect(winProbability(a, b)).toBeCloseTo(0.5, 1)
  })

  it('higher-rated player has >50% win probability', () => {
    const a = establishedPlayer(1700)
    const b = establishedPlayer(1500)
    expect(winProbability(a, b)).toBeGreaterThan(0.5)
  })

  it('win probability is symmetric (p(A>B) + p(B>A) ≈ 1)', () => {
    const a = establishedPlayer(1600)
    const b = establishedPlayer(1400)
    expect(winProbability(a, b) + winProbability(b, a)).toBeCloseTo(1, 5)
  })
})

// ─────────────────────────────────────────
// RATING BAND
// ─────────────────────────────────────────

describe('getRatingBand', () => {
  it('returns correct bands', () => {
    expect(getRatingBand(200)).toBe('Beginner')
    expect(getRatingBand(750)).toBe('Recreational')
    expect(getRatingBand(1200)).toBe('Intermediate')
    expect(getRatingBand(1500)).toBe('Intermediate')
    expect(getRatingBand(1800)).toBe('Competitive')
    expect(getRatingBand(2200)).toBe('Advanced')
    expect(getRatingBand(2700)).toBe('Elite')
  })
})
