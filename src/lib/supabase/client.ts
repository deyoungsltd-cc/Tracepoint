import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// When not configured, create a dummy client that won't be used.
// The isSupabaseConfigured() guard prevents any calls.
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

/**
 * Supabase Project Setup Instructions:
 * 
 * 1. Go to https://supabase.com and create a new project
 * 2. Copy the Project URL and anon (public) key from Settings > API
 * 3. Add them to your .env file:
 *    NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
 *    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
 * 
 * 4. Go to SQL Editor in Supabase dashboard and run the schema
 *    from /supabase-schema.sql
 * 
 * 5. For Google Auth:
 *    - Go to Authentication > Providers > Google
 *    - Enable it and add your Google OAuth Client ID/Secret
 *    - Get these from Google Cloud Console > Credentials
 * 
 * 6. Set your Site URL in Authentication > URL Configuration
 *    to your deployment URL (e.g., http://localhost:3000 for dev)
 */