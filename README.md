# PROOF

> Every match is evidence. Your rating is the verdict.

A universal multi-sport skill rating platform. Purpose-built algorithms per sport — not one-size-fits-all ELO. Start with badminton, expand to every sport.

---

## The Problem

Skill rating in amateur sports is broken. Most sports have one of three problems:

- **No rating at all** — players have no way to know their actual level
- **Tournament-only** — you need to enter sanctioned events to get a number (excludes 95% of players)
- **One algorithm for everything** — generic ELO applied blindly regardless of sport structure

PROOF fixes all three. Every match counts. Every sport gets the algorithm it deserves.

---

## Sport Roadmap

| Sport | Status | Algorithm Approach |
|---|---|---|
| Badminton | MVP | Glicko-2 + margin-of-victory + rally structure weighting |
| Table Tennis | Planned | Modified ITTF model + service/receive statistical layers |
| Tennis | Planned | UTR-inspired rolling window + surface-adjusted |
| Pickleball | Planned | DUPR-inspired + partnership/chemistry doubles model |
| Basketball | Future | TrueSkill team-based + individual contribution attribution |

> Each sport has fundamentally different structures, scoring systems, and skill expressions. A badminton rating algorithm should not look like a tennis one. PROOF never takes shortcuts here.

---

## Core Features

- **Sport-specific algorithms** — purpose-built per sport, not ported ELO
- **Casual + verified matches** — every match counts; source quality is weighted
- **Reliability score** — trust rating on every player profile based on match count, recency, and source diversity
- **Opponent confirmation** — low-friction match verification; opponent confirms via link without requiring account on first use
- **Club/gym accounts** — manager-submitted results carry higher weight
- **Friend system + activity feed** — see when friends play, what their rating moved to, head-to-head history
- **Geographic hierarchy rankings** — barangay → city → province → country; your local standing, not just a global number
- **Match history + statistics** — win rates, rating trend, head-to-head breakdown, predictions

---

## Algorithm Philosophy

No single rating model is best for all sports. The sport structure determines the model:

**Individual 1v1 (tennis, table tennis singles)**
- Glicko-2 base with rating deviation and volatility
- Rolling 30-match recency window
- Margin of victory as secondary signal (prevents sandbagging)
- Time decay after inactivity

**Doubles (badminton doubles, pickleball)**
- TrueSkill-style team aggregation (individual Gaussians compose to team skill)
- Partnership tracking (chemistry compounds over repeated pairings)
- Split attribution: serve/receive sides weighted differently

**Rally-scoring racket sports (badminton, table tennis)**
- Point differential normalized to game length
- Third-set/game performance bonus (clutch weighting)
- Service rotation awareness

**Future: Team invasion sports (basketball)**
- Lineup-adjusted contribution (on/off splits)
- Possession-normalized individual metrics
- Role-based weighting (not all players do the same job)

---

## Rating Scale

Universal 0–3000 scale across all sports. Readable, comparable within a sport, never cross-sport.

| Range | Level |
|---|---|
| 0–500 | Beginner |
| 500–1000 | Recreational |
| 1000–1500 | Intermediate |
| 1500–2000 | Competitive |
| 2000–2500 | Advanced |
| 2500–3000 | Elite |

---

## Tech Stack

TBD — decisions to be made before build begins.

---

## Project Structure

```
proof/
├── apps/
│   ├── mobile/          # React Native (iOS + Android)
│   └── web/             # Next.js (admin, profiles, public rankings)
├── packages/
│   ├── algorithms/      # Sport-specific rating engines (pure functions, fully tested)
│   ├── database/        # Schema, migrations, seed data
│   └── shared/          # Types, constants, utilities
└── docs/
    ├── algorithms/      # Per-sport algorithm specs and math
    └── api/             # API documentation
```

---

## Launch Plan

**Phase 1 — Badminton, Philippines (MVP)**
- Metro Manila club network as first users
- Singles rating + basic doubles
- Geographic rankings down to barangay
- Friend system + activity feed
- Club manager accounts

**Phase 2 — Table Tennis + Expand SEA**
- Second sport proves the multi-sport architecture
- Expand to Malaysia, Indonesia

**Phase 3 — Racket Sports Complete**
- Tennis, pickleball
- Coach certification layer
- Tournament integration

---

## Why Badminton First

220M+ players globally. The third most played sport on earth. Zero funded consumer rating app. The BWF has never shipped a consumer product. The closest competitors (UBR, SmashRating) are volunteer-grade web tools. Philippines is a native badminton market.

The gap is real. The timing is right.

---

*PROOF — proof.gg*
