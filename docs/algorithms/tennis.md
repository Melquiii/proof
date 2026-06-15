# PROOF Tennis Rating Algorithm

## Overview

PROOF uses a modified Glicko-2 system for tennis singles. The key improvement over standard ELO or basic Glicko-2 is **margin-of-victory weighting** — the set scores matter, not just the outcome.

A 6-0, 6-0 win against an equal opponent moves your rating more than a 7-6, 7-6 win. A close loss still costs less than a bagel.

---

## Parameters

| Symbol | Name | Default | Description |
|---|---|---|---|
| r | Rating | 1500 | Public-facing number (0–3000 scale) |
| RD | Rating Deviation | 350 | Uncertainty. High = newer/inactive player. |
| σ | Volatility | 0.06 | How erratic a player's results are |
| τ | System constant | 0.5 | Controls how fast σ changes (0.3–1.2) |

**Internal scale conversion:**
- μ = (r - 1500) / 173.7178
- φ = RD / 173.7178

---

## Score Adjustment (Margin of Victory)

Standard Glicko-2 uses binary scores: win = 1, loss = 0.

PROOF replaces this with a continuous score based on set dominance:

```
total_games = sum of all games played across all sets (both players)
game_diff = winner_games - loser_games
dominance = game_diff / total_games   (always positive, range 0–1)

winner_score = 0.5 + (0.5 * dominance * MOV_WEIGHT)
loser_score  = 1 - winner_score

MOV_WEIGHT = 0.8  (caps extreme blowouts, prevents 0 and 1 edges)
```

### Examples

| Result | total_games | game_diff | dominance | winner_score |
|---|---|---|---|---|
| 6-0, 6-0 | 12 | 12 | 1.0 | 0.90 |
| 6-1, 6-1 | 14 | 10 | 0.71 | 0.78 |
| 6-3, 6-3 | 18 | 6 | 0.33 | 0.63 |
| 6-4, 6-4 | 20 | 4 | 0.20 | 0.58 |
| 7-5, 7-5 | 24 | 4 | 0.17 | 0.57 |
| 7-6, 7-6 | 26 | 2 | 0.077 | 0.53 |
| 7-6, 6-7, 7-6 | 39 | 3 | 0.077 | 0.53 |

---

## Glicko-2 Update Steps

### Step 1: Convert to internal scale
```
μ  = (r - 1500) / 173.7178
φ  = RD / 173.7178
σ  = volatility (unchanged)
```

### Step 2: For each opponent j, compute
```
g(φⱼ) = 1 / sqrt(1 + (3 * φⱼ²) / π²)
E(μ, μⱼ, φⱼ) = 1 / (1 + exp(-g(φⱼ) * (μ - μⱼ)))
```
g() reduces the influence of uncertain opponents.
E() is the expected score (0–1) against that opponent.

### Step 3: Compute estimated variance
```
v = 1 / Σ [ g(φⱼ)² * E(1 - E) ]
```

### Step 4: Compute improvement over expected
```
Δ = v * Σ [ g(φⱼ) * (s - E) ]
```
s = margin-adjusted score from above.

### Step 5: Update volatility σ (Illinois algorithm)
Finds σ' such that the change is consistent with the rating deviation.
This step is the most complex — see implementation for full details.

### Step 6: Update φ and μ
```
φ★ = sqrt(φ² + σ'²)           -- pre-rating period φ
φ' = 1 / sqrt(1/φ★² + 1/v)   -- new RD
μ' = μ + φ'² * Σ [ g(φⱼ) * (s - E) ]
```

### Step 7: Convert back
```
r'  = 173.7178 * μ' + 1500
RD' = 173.7178 * φ'
```

---

## Time Decay

If a player hasn't played in > 60 days, their RD increases before the next calculation:

```
days_inactive = days since last match
c = 34.64  (Glicko-2 standard constant for φ growth per rating period)
periods = days_inactive / 30

φ_decayed = min(350/173.7178, sqrt(φ² + (c/173.7178)² * periods))
```

This makes inactive players' ratings more uncertain, but never resets them.

---

## Rolling Window

Only the last **30 matches** (or matches within the last **90 days**, whichever is larger) affect the current rating. Older matches are archived in rating_history but excluded from calculations.

This ensures ratings reflect current form, not a peak from years ago.

---

## Reliability Score

```
base_score = min(50, match_count * 5)
recency_bonus =
  20  if last_match_at within 30 days
  10  if last_match_at within 90 days
   0  otherwise
provisional_penalty = -20  if match_count < 10

reliability = max(0, min(100, base_score + recency_bonus + provisional_penalty))
```

Displayed as a percentage on every profile. Players with < 10 matches are marked "Provisional."

---

## Rating Bands

| Rating | Label |
|---|---|
| 0–500 | Beginner |
| 500–1000 | Recreational |
| 1000–1500 | Intermediate |
| 1500–2000 | Competitive |
| 2000–2500 | Advanced |
| 2500–3000 | Elite |

New players start at 1500 (Intermediate floor) with RD 350.

---

## Constants

```ts
export const TENNIS_CONSTANTS = {
  DEFAULT_RATING: 1500,
  DEFAULT_RD: 350,
  DEFAULT_VOLATILITY: 0.06,
  TAU: 0.5,
  MOV_WEIGHT: 0.8,
  SCALE: 173.7178,
  ROLLING_WINDOW_MATCHES: 30,
  ROLLING_WINDOW_DAYS: 90,
  DECAY_THRESHOLD_DAYS: 60,
  DECAY_C: 34.64,
  MIN_MATCHES_FOR_RANKING: 3,
  PROVISIONAL_THRESHOLD: 10,
}
```
