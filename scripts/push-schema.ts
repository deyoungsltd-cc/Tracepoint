/**
 * push-schema.ts — Checks if Supabase tables exist, and if not,
 * provides instructions to apply the schema.
 */

const SUPABASE_URL = 'https://bcgdwkhkstxneovbybmh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjZ2R3a2hrc3R4bmVvdmJ5Ym1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NTg3NzQsImV4cCI6MjA3MDMzNDc3NH0.BKgvHjT1PT2KkLKJRRHn1T3mxvdOOeHHjTx8kSCQbp4';

async function checkTables() {
  console.log('Checking Supabase connection...');

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (res.ok) {
      console.log('Tables already exist! Schema is applied.');
      return true;
    }

    const data = await res.json();
    if (data.message && (data.message.includes('does not exist') || data.code === '42P01')) {
      console.log('Tables do not exist yet.');
      console.log('');
      console.log('You need to apply the schema manually:');
      console.log('  1. Go to: https://supabase.com/dashboard/project/bcgdwkhkstxneovbybmh/sql');
      console.log('  2. Open the SQL Editor');
      console.log('  3. Paste the contents of supabase-schema.sql');
      console.log('  4. Click Run');
      console.log('');
      return false;
    }

    console.log('Unexpected response:', data);
    return false;
  } catch (err) {
    console.error('Connection failed:', err);
    return false;
  }
}

checkTables().then(exists => {
  process.exit(exists ? 0 : 1);
}).catch(() => process.exit(1));
