// ============================================================
// TRACEPOINT — Database Setup API Route
// Checks if the schema is applied, returns status.
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET() {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({
      configured: false,
      tablesExist: false,
      error: 'Supabase credentials not set in environment variables',
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Try a lightweight query — select from profiles
    const { data, error } = await supabase.from('profiles').select('id').limit(1);

    if (!error) {
      return NextResponse.json({ configured: true, tablesExist: true });
    }

    // Table doesn't exist
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
      return NextResponse.json({
        configured: true,
        tablesExist: false,
        error: 'Database tables not found',
        projectRef,
        fix: 'run_schema',
        instructions: [
          '1. Go to your Supabase Dashboard → SQL Editor',
          '2. Paste the contents of supabase-schema.sql',
          '3. Click Run',
        ],
      });
    }

    // RLS policy issue — table exists but policies are broken (infinite recursion)
    if (error.message?.includes('infinite recursion') || error.message?.includes('policy')) {
      const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
      return NextResponse.json({
        configured: true,
        tablesExist: false,
        error: 'RLS policy error — infinite recursion detected.',
        projectRef,
        fix: 'rls_policy',
        sqlUrl: `https://supabase.com/dashboard/project/${projectRef}/sql`,
        instructions: [
          '1. Go to Supabase Dashboard → SQL Editor',
          '2. Run: DROP POLICY "Admins can view all profiles" ON public.profiles; CREATE POLICY "Public read access" ON public.profiles FOR SELECT USING (true);',
        ],
      });
    }

    // API key issue — the key is invalid or revoked
    if (error.message?.includes('API key') || error.code === 'PGRST301' || error.message?.includes('Invalid')) {
      return NextResponse.json({
        configured: true,
        tablesExist: false,
        error: 'Invalid Supabase API key — copy the correct anon key from Supabase Dashboard > Settings > API.',
        fix: 'invalid_key',
      });
    }

    // Row-level security policy error — table exists but anon can't read
    if (error.code === '42501' || error.message?.includes('row-level security') || error.message?.includes('policy') || error.message?.includes('permission denied')) {
      const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
      return NextResponse.json({
        configured: true,
        tablesExist: true,
        error: 'RLS policy blocks anonymous reads. Tables exist but policies need updating.',
        projectRef,
        fix: 'rls_policy',
        sqlUrl: `https://supabase.com/dashboard/project/${projectRef}/sql`,
        instructions: [
          'Run in SQL Editor:',
          'CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);',
          'CREATE POLICY "Public read investigations" ON public.investigations FOR SELECT USING (true);',
        ],
      });
    }

    // Other errors (RLS, permissions, etc.) — show as schema issue, not generic
    return NextResponse.json({
      configured: true,
      tablesExist: false,
      error: error.message,
      fix: 'run_schema',
    });
  } catch (err: any) {
    return NextResponse.json({ configured: false, tablesExist: false, error: err.message });
  }
}
