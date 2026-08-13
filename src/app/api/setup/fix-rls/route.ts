// ============================================================
// TRACEPOINT — Fix RLS Infinite Recursion
// Returns the SQL needed to fix RLS policies.
// ============================================================

import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function POST() {
  const projectRef = supabaseUrl?.split('//')[1]?.split('.')[0] || '';

  return NextResponse.json({
    success: false,
    error: 'RLS policies must be fixed manually in Supabase SQL Editor.',
    sqlUrl: `https://supabase.com/dashboard/project/${projectRef}/sql`,
    sql: `-- Fix RLS infinite recursion on profiles table
-- Run this in Supabase Dashboard → SQL Editor

-- Drop existing policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Add simple public read policy (anon key can read profiles)
CREATE POLICY "Public read access" ON public.profiles
  FOR SELECT USING (true);

-- Authenticated users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow service role to insert (for trigger)
CREATE POLICY "Service role insert" ON public.profiles
  FOR INSERT WITH CHECK (true);`,
  });
}
