// ============================================================
// TRACEPOINT — Database Setup API Route
// Checks if the schema is applied, returns SQL if not.
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET() {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({
      configured: false,
      error: 'Supabase credentials not set in .env.local',
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);

    if (!error) {
      return NextResponse.json({ configured: true, tablesExist: true });
    }

    if (error.message?.includes('does not exist') || error.code === '42P01') {
      return NextResponse.json({
        configured: true,
        tablesExist: false,
        error: 'Database tables not found',
        projectRef: supabaseUrl.split('//')[1].split('.')[0],
        instructions: [
          '1. Go to your Supabase Dashboard → SQL Editor',
          '2. Paste the contents of supabase-schema.sql',
          '3. Click Run',
          '4. Then go to Authentication → Providers → Google and enable it',
        ],
      });
    }

    if (error.message?.includes('API key') || error.code === 'PGRST301') {
      return NextResponse.json({
        configured: true,
        tablesExist: false,
        error: `Invalid API key: ${error.message}`,
        fix: 'Update NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local with the key from Supabase Dashboard > Settings > API',
      });
    }

    return NextResponse.json({ configured: true, tablesExist: false, error: error.message });
  } catch (err: any) {
    return NextResponse.json({ configured: false, error: err.message }, { status: 500 });
  }
}
