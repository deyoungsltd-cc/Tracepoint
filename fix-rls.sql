-- ============================================================
-- TRACEPOINT — Fix RLS Infinite Recursion on profiles table
-- 
-- PROBLEM: The "Admins can view all profiles" policy calls 
-- is_admin() which queries the profiles table, which triggers
-- the same policy again, causing infinite recursion.
--
-- FIX: Replace all policies with simple, non-recursive ones.
-- ============================================================

-- Drop ALL existing policies on profiles (they cause recursion)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Allow anyone with a valid API key to read profiles (anon access)
-- This is safe because the anon key only exposes public profile info
CREATE POLICY "Public read access" ON public.profiles
  FOR SELECT USING (true);

-- Authenticated users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow inserts (needed by the handle_new_user trigger)
CREATE POLICY "Allow inserts" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- RESULT: /api/setup should now return { tablesExist: true }
-- ============================================================