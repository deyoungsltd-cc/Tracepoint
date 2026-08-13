// ============================================================
// TRACEPOINT — API Configuration Status
// Returns which API keys are configured (booleans only, no secrets).
// ============================================================

import { NextResponse } from 'next/server';

export async function GET() {
  const config = {
    numverify: !!process.env.NUMVERIFY_API_KEY,
    abstractApi: !!process.env.ABSTRACT_API_KEY,
    serper: !!(process.env.SERPER_API_KEY || process.env.NEXT_PUBLIC_SERPER_API_KEY),
    openai: !!process.env.OPENAI_API_KEY,
    supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    cloudinary: !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
  };

  const criticalKeys = ['numverify', 'serper', 'openai'] as const;
  const missingCritical = criticalKeys.filter(k => !config[k]);
  const isDemoMode = missingCritical.length > 0;

  return NextResponse.json({
    configured: config,
    missingCritical,
    ready: true, // Always ready — demo mode handles missing keys
    isDemoMode,
    message: isDemoMode
      ? `Demo mode: ${missingCritical.join(', ')} key(s) not set. Using simulated data. Set keys in .env.local for real investigations.`
      : 'All critical API keys are configured.',
  });
}
