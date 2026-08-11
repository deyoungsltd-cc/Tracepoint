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
        error: 'RLS policy error — infinite recursion detected. The table exists but the policies need fixing.',
        projectRef,
        fix: 'rls_policy',
        sqlUrl: `https://supabase.com/dashboard/project/${projectRef}/sql`,
        instructions: [
          '1. Go to Supabase Dashboard → SQL Editor',
          '2. Run the fix-rls.sql script',
          '3. Or run: DROP POLICY "Admins can view all profiles" ON public.profiles; CREATE POLICY "Public read access" ON public.profiles FOR SELECT USING (true);',
        ],
      });
    }

    // API key issue — the key is invalid or revoked
    if (error.message?.includes('API key') || error.code === 'PGRST301' || error.message?.includes('Invalid')) {
      return NextResponse.json({
        configured: true,
        tablesExist: false,
        error: `Invalid Supabase API key — the anon key in your environment variables doesn't match this project. Go to Supabase Dashboard > Settings > API and copy the correct anon (public) key.`,
        fix: 'invalid_key',
      });
    }

    // Other errors (RLS, permissions, etc.)
    return NextResponse.json({
      configured: true,
      tablesExist: false,
      error: error.message,
    });
  } catch (err: any) {
    return NextResponse.json({ configured: false, error: err.message }, { status: 500 });
  }
}
