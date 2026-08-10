-- ============================================================
-- TRACEPOINT — Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable Row Level Security
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  display_name text,
  role text not null default 'standard' check (role in ('admin', 'pro', 'standard')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'standard'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- INVESTIGATIONS
-- ============================================================
create table public.investigations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'archived')),
  depth text not null default 'standard' check (depth in ('quick', 'standard', 'deep')),
  is_batch boolean not null default false,
  batch_id text,

  -- Input identifiers
  input_phone text,
  input_phone_normalized text,
  input_email text,
  input_name text,
  input_business text,
  input_country text,
  input_country_code text,

  -- Results
  summary text,
  identity_count integer not null default 0,
  evidence_count integer not null default 0,
  source_count integer not null default 0,
  confidence real,
  has_conflicts boolean not null default false,
  location_status text not null default 'unavailable' check (location_status in ('live', 'last_known', 'historical', 'unavailable')),

  -- AI assessment (stored as JSONB)
  ai_assessment jsonb,

  -- Retention
  is_demo_data boolean not null default false,
  archived_at timestamptz,

  -- Timestamps
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.investigations enable row level security;

create policy "Users can view own investigations"
  on public.investigations for select
  using (auth.uid() = user_id);

create policy "Users can insert own investigations"
  on public.investigations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own investigations"
  on public.investigations for update
  using (auth.uid() = user_id);

create policy "Admins can view all investigations"
  on public.investigations for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- IDENTITY CANDIDATES
-- ============================================================
create table public.identity_candidates (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  rank integer not null,
  name text,
  phone text,
  email text,
  business text,
  website text,
  location text,
  photo_url text,
  confidence real not null default 0,
  verified_status text not null default 'unverified' check (verified_status in ('verified', 'strongly_corroborated', 'possible', 'unverified', 'conflicting')),
  match_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.identity_candidates enable row level security;

create policy "Users can view candidates for own investigations"
  on public.identity_candidates for select
  using (
    investigation_id in (
      select id from public.investigations where user_id = auth.uid()
    )
  );

create policy "Users can insert candidates for own investigations"
  on public.identity_candidates for insert
  with check (
    investigation_id in (
      select id from public.investigations where user_id = auth.uid()
    )
  );

-- ============================================================
-- EVIDENCE ITEMS
-- ============================================================
create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  candidate_id uuid references public.identity_candidates(id) on delete set null,
  claim text not null,
  source_url text,
  source_name text not null,
  source_type text not null,
  discovered_at timestamptz not null default now(),
  published_at timestamptz,
  excerpt text,
  reliability_score real not null default 0,
  relevance_score real not null default 0,
  freshness_score real not null default 0,
  verification_status text not null default 'unverified'
);

alter table public.evidence_items enable row level security;

create policy "Users can view evidence for own investigations"
  on public.evidence_items for select
  using (
    investigation_id in (
      select id from public.investigations where user_id = auth.uid()
    )
  );

create policy "Users can insert evidence for own investigations"
  on public.evidence_items for insert
  with check (
    investigation_id in (
      select id from public.investigations where user_id = auth.uid()
    )
  );

-- ============================================================
-- DEVICE LOCATIONS
-- ============================================================
create table public.device_locations (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  device_id text,
  provider text not null,
  status text not null check (status in ('live', 'last_known', 'historical')),
  latitude real,
  longitude real,
  accuracy real,
  address text,
  timestamp timestamptz,
  freshness text not null,
  device_status text,
  battery_level real,
  network_type text,
  created_at timestamptz not null default now()
);

alter table public.device_locations enable row level security;

create policy "Users can view locations for own investigations"
  on public.device_locations for select
  using (
    investigation_id in (
      select id from public.investigations where user_id = auth.uid()
    )
  );

-- ============================================================
-- TIMELINE EVENTS
-- ============================================================
create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  event_type text not null,
  description text not null,
  metadata jsonb,
  timestamp timestamptz not null default now()
);

alter table public.timeline_events enable row level security;

create policy "Users can view timeline for own investigations"
  on public.timeline_events for select
  using (
    investigation_id in (
      select id from public.investigations where user_id = auth.uid()
    )
  );

create policy "Users can insert timeline for own investigations"
  on public.timeline_events for insert
  with check (
    investigation_id in (
      select id from public.investigations where user_id = auth.uid()
    )
  );

-- ============================================================
-- AUDIT EVENTS (admin viewable)
-- ============================================================
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource text,
  details text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.audit_events enable row level security;

create policy "Users can view own audit events"
  on public.audit_events for select
  using (auth.uid() = user_id);

create policy "Admins can view all audit events"
  on public.audit_events for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Authenticated users can insert audit events"
  on public.audit_events for insert
  with check (auth.uid() is not null);

-- ============================================================
-- USER API KEYS (encrypted, user-managed)
-- ============================================================
create table public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  encrypted_key text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

alter table public.user_api_keys enable row level security;

create policy "Users can manage own API keys"
  on public.user_api_keys for all
  using (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_investigations_user_id on public.investigations(user_id);
create index idx_investigations_status on public.investigations(status);
create index idx_investigations_created_at on public.investigations(created_at desc);
create index idx_identity_candidates_investigation on public.identity_candidates(investigation_id);
create index idx_evidence_items_investigation on public.evidence_items(investigation_id);
create index idx_device_locations_investigation on public.device_locations(investigation_id);
create index idx_timeline_events_investigation on public.timeline_events(investigation_id);
create index idx_audit_events_user on public.audit_events(user_id);
create index idx_audit_events_created on public.audit_events(created_at desc);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.investigations
  for each row execute procedure public.update_updated_at();

create trigger set_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at();