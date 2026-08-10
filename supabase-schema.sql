-- ============================================================
-- TRACEPOINT — Supabase Database Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text,
  display_name text,
  role text NOT NULL DEFAULT 'standard' CHECK (role IN ('admin', 'pro', 'standard')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'standard'
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- INVESTIGATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'archived')),
  depth text NOT NULL DEFAULT 'standard' CHECK (depth IN ('quick', 'standard', 'deep')),
  is_batch boolean NOT NULL DEFAULT false,
  batch_id text,
  input_phone text,
  input_phone_normalized text,
  input_email text,
  input_name text,
  input_business text,
  input_country text,
  input_country_code text,
  summary text,
  identity_count integer NOT NULL DEFAULT 0,
  evidence_count integer NOT NULL DEFAULT 0,
  source_count integer NOT NULL DEFAULT 0,
  confidence real,
  has_conflicts boolean NOT NULL DEFAULT false,
  location_status text NOT NULL DEFAULT 'unavailable' CHECK (location_status IN ('live', 'last_known', 'historical', 'unavailable')),
  ai_assessment jsonb,
  is_demo_data boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own investigations" ON public.investigations FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert own investigations" ON public.investigations FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update own investigations" ON public.investigations FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Admins can view all investigations" ON public.investigations FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- IDENTITY CANDIDATES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.identity_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  rank integer NOT NULL,
  name text,
  phone text,
  email text,
  business text,
  website text,
  location text,
  photo_url text,
  confidence real NOT NULL DEFAULT 0,
  verified_status text NOT NULL DEFAULT 'unverified' CHECK (verified_status IN ('verified', 'strongly_corroborated', 'possible', 'unverified', 'conflicting')),
  match_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.identity_candidates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view candidates for own investigations" ON public.identity_candidates FOR SELECT USING (investigation_id IN (SELECT id FROM public.investigations WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert candidates for own investigations" ON public.identity_candidates FOR INSERT WITH CHECK (investigation_id IN (SELECT id FROM public.investigations WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- EVIDENCE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.identity_candidates(id) ON DELETE SET NULL,
  claim text NOT NULL,
  source_url text,
  source_name text NOT NULL,
  source_type text NOT NULL,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  excerpt text,
  reliability_score real NOT NULL DEFAULT 0,
  relevance_score real NOT NULL DEFAULT 0,
  freshness_score real NOT NULL DEFAULT 0,
  verification_status text NOT NULL DEFAULT 'unverified'
);

ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view evidence for own investigations" ON public.evidence_items FOR SELECT USING (investigation_id IN (SELECT id FROM public.investigations WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert evidence for own investigations" ON public.evidence_items FOR INSERT WITH CHECK (investigation_id IN (SELECT id FROM public.investigations WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- DEVICE LOCATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.device_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  device_id text,
  provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('live', 'last_known', 'historical')),
  latitude real,
  longitude real,
  accuracy real,
  address text,
  timestamp timestamptz,
  freshness text NOT NULL,
  device_status text,
  battery_level real,
  network_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.device_locations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view locations for own investigations" ON public.device_locations FOR SELECT USING (investigation_id IN (SELECT id FROM public.investigations WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TIMELINE EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  description text NOT NULL,
  metadata jsonb,
  timestamp timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view timeline for own investigations" ON public.timeline_events FOR SELECT USING (investigation_id IN (SELECT id FROM public.investigations WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert timeline for own investigations" ON public.timeline_events FOR INSERT WITH CHECK (investigation_id IN (SELECT id FROM public.investigations WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- AUDIT EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource text,
  details text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own audit events" ON public.audit_events FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Admins can view all audit events" ON public.audit_events FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert audit events" ON public.audit_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- USER API KEYS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  encrypted_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own API keys" ON public.user_api_keys FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_investigations_user_id ON public.investigations(user_id);
CREATE INDEX IF NOT EXISTS idx_investigations_status ON public.investigations(status);
CREATE INDEX IF NOT EXISTS idx_investigations_created_at ON public.investigations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_identity_candidates_investigation ON public.identity_candidates(investigation_id);
CREATE INDEX IF NOT EXISTS idx_evidence_items_investigation ON public.evidence_items(investigation_id);
CREATE INDEX IF NOT EXISTS idx_device_locations_investigation ON public.device_locations(investigation_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_investigation ON public.timeline_events(investigation_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_user ON public.audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON public.audit_events(created_at DESC);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.investigations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.investigations
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();
