# PROOF — Setup Guide

## Prerequisites

- Node 18+
- Expo CLI: `npm install -g expo-cli`
- Supabase CLI: `brew install supabase/tap/supabase`
- EAS CLI: `npm install -g eas-cli`

---

## 1. Supabase Project

1. Create a project at https://supabase.com
2. Copy your **Project URL** and **anon key** from Project Settings → API

```bash
# Link CLI to your project
supabase login
supabase link --project-ref your-project-ref
```

3. Run the migration:

```bash
supabase db push
```

4. Deploy Edge Functions:

```bash
supabase functions deploy update-ratings
supabase functions deploy notify-match-request
```

5. Set the service role secret for Edge Functions:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 2. App Environment

```bash
cp app/.env.example app/.env
```

Edit `app/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 3. Run the App

```bash
cd app
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or press `i` for iOS simulator.

> **Push notifications require a physical device.** Expo Go on a real phone is the fastest way to test the full match confirmation flow.

---

## 4. Algorithm Tests

```bash
cd packages/algorithms
npm install
npm test
```

Expected: 25 tests passing.

---

## 5. TestFlight (when ready)

```bash
eas build --platform ios --profile preview
eas submit --platform ios
```

Requires an Apple Developer account ($99/year) and EAS account.

---

## Project Structure

```
proof/
├── app/                     # Expo app
│   ├── app/                 # Expo Router screens
│   │   ├── (auth)/          # Login, Register
│   │   ├── (tabs)/          # Home, Log, Rankings, Profile
│   │   ├── match/           # Match detail + confirm modal
│   │   └── player/          # Player profile
│   ├── lib/                 # supabase.ts, notifications.ts
│   ├── hooks/               # useSession
│   └── types/               # Shared TypeScript types
├── packages/
│   └── algorithms/          # Tennis rating engine (pure TS, tested)
├── supabase/
│   ├── migrations/          # 001_initial_schema.sql
│   └── functions/           # update-ratings, notify-match-request
└── docs/
    └── algorithms/          # tennis.md — algorithm spec
```
