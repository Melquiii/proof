-- PROOF — Initial Schema
-- Supabase / PostgreSQL

-- ─────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  display_name text not null,
  avatar_url  text,
  country     text,
  city        text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- ─────────────────────────────────────────
-- SPORT RATINGS
-- One row per (user, sport). Tennis is the only sport in MVP.
-- Glicko-2: rating + rating_deviation + volatility
-- ─────────────────────────────────────────
create table public.sport_ratings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  sport             text not null default 'tennis',
  rating            real not null default 1500,
  rating_deviation  real not null default 350,   -- Glicko-2 φ (uncertainty)
  volatility        real not null default 0.06,  -- Glicko-2 σ (consistency)
  match_count       integer not null default 0,
  reliability_score real not null default 0,     -- 0–100
  last_match_at     timestamptz,
  updated_at        timestamptz default now(),
  unique (user_id, sport)
);

alter table public.sport_ratings enable row level security;

create policy "Ratings viewable by everyone"
  on public.sport_ratings for select using (true);

create policy "System updates ratings"
  on public.sport_ratings for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- MATCHES
-- ─────────────────────────────────────────
create type match_status as enum ('pending', 'confirmed', 'rejected', 'cancelled');
create type match_surface as enum ('hard', 'clay', 'grass', 'indoor');
create type match_format as enum ('singles', 'doubles');

create table public.matches (
  id          uuid primary key default gen_random_uuid(),
  sport       text not null default 'tennis',
  format      match_format not null default 'singles',
  surface     match_surface,
  status      match_status not null default 'pending',
  -- p1 = match creator, p2 = opponent (must confirm)
  p1_id       uuid not null references public.profiles(id),
  p2_id       uuid not null references public.profiles(id),
  winner_id   uuid references public.profiles(id),  -- null until confirmed
  played_at   timestamptz not null,
  created_at  timestamptz default now(),
  check (p1_id <> p2_id)
);

alter table public.matches enable row level security;

create policy "Matches viewable by participants"
  on public.matches for select
  using (auth.uid() = p1_id or auth.uid() = p2_id);

create policy "Matches viewable by everyone once confirmed"
  on public.matches for select
  using (status = 'confirmed');

create policy "p1 can insert match"
  on public.matches for insert
  with check (auth.uid() = p1_id);

create policy "Participants can update match"
  on public.matches for update
  using (auth.uid() = p1_id or auth.uid() = p2_id);

-- ─────────────────────────────────────────
-- MATCH SETS
-- Stores individual set scores: 6-4, 7-5, 6-3 etc.
-- p1_games / p2_games correspond to matches.p1_id / p2_id
-- ─────────────────────────────────────────
create table public.match_sets (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  set_number  integer not null check (set_number between 1 and 5),
  p1_games    integer not null check (p1_games between 0 and 7),
  p2_games    integer not null check (p2_games between 0 and 7),
  unique (match_id, set_number)
);

alter table public.match_sets enable row level security;

create policy "Sets viewable by match participants"
  on public.match_sets for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.status = 'confirmed' or m.p1_id = auth.uid() or m.p2_id = auth.uid())
    )
  );

create policy "p1 can insert sets"
  on public.match_sets for insert
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id and m.p1_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- RATING HISTORY
-- Immutable log of every rating change.
-- ─────────────────────────────────────────
create table public.rating_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  sport       text not null,
  match_id    uuid references public.matches(id),
  old_rating  real not null,
  new_rating  real not null,
  old_rd      real not null,
  new_rd      real not null,
  delta       real generated always as (new_rating - old_rating) stored,
  created_at  timestamptz default now()
);

alter table public.rating_history enable row level security;

create policy "History viewable by everyone"
  on public.rating_history for select using (true);

-- ─────────────────────────────────────────
-- FRIENDSHIPS
-- ─────────────────────────────────────────
create type friendship_status as enum ('pending', 'accepted');

create table public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  addressee_id  uuid not null references public.profiles(id) on delete cascade,
  status        friendship_status not null default 'pending',
  created_at    timestamptz default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

alter table public.friendships enable row level security;

create policy "Friendships viewable by participants"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can request friendship"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

create policy "Addressee can accept/reject"
  on public.friendships for update
  using (auth.uid() = addressee_id);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
create index idx_sport_ratings_user on public.sport_ratings(user_id);
create index idx_sport_ratings_sport_rating on public.sport_ratings(sport, rating desc);
create index idx_sport_ratings_city on public.sport_ratings(sport, rating desc)
  include (user_id);
create index idx_matches_p1 on public.matches(p1_id, created_at desc);
create index idx_matches_p2 on public.matches(p2_id, created_at desc);
create index idx_matches_status on public.matches(status);
create index idx_rating_history_user on public.rating_history(user_id, created_at desc);
create index idx_friendships_requester on public.friendships(requester_id);
create index idx_friendships_addressee on public.friendships(addressee_id);

-- ─────────────────────────────────────────
-- GEOGRAPHIC RANKINGS VIEW
-- Used for city/country leaderboards.
-- ─────────────────────────────────────────
create view public.rankings_by_city as
  select
    sr.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.city,
    p.country,
    sr.sport,
    sr.rating,
    sr.rating_deviation,
    sr.match_count,
    sr.reliability_score,
    rank() over (partition by sr.sport, p.city order by sr.rating desc) as city_rank,
    rank() over (partition by sr.sport, p.country order by sr.rating desc) as country_rank
  from public.sport_ratings sr
  join public.profiles p on p.id = sr.user_id
  where sr.match_count >= 3;  -- minimum matches for ranking

-- ─────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ─────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger sport_ratings_updated_at
  before update on public.sport_ratings
  for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────
-- NEW USER TRIGGER
-- Creates profile + tennis rating row on signup.
-- ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );

  insert into public.sport_ratings (user_id, sport)
  values (new.id, 'tennis');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
