// ============================================================
// TRACEPOINT — Configuration Check API
// Returns which API keys are configured (key presence only, no calls).
// Used by the UI to show clear "setup needed" messages.
// ============================================================

import { NextResponse } from 'next/server';

export async function GET() {
  const checks = {
    numverify: !!process.env.NUMVERIFY_API_KEY,
    abstractApi: !!process.env.ABSTRACT_API_KEY,
    serper: !!(process.env.SERPER_API_KEY || process.env.NEXT_PUBLIC_SERPER_API_KEY),
    openai: !!process.env.OPENAI_API_KEY,
    supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };

  const total = Object.values(checks).filter(Boolean).length;
  const allSet = total === Object.keys(checks).length;
  const hasAny = total > 0;

  return NextResponse.json({
    allConfigured: allSet,
    configuredCount: total,
    totalRequired: Object.keys(checks).length,
    checks,
    missing: Object.entries(checks)
      .filter(([, v]) => !v)
      .map(([k]) => k),
    hasAnyApiKeys: hasAny,
    hasInvestigationCapability: checks.numverify || checks.serper || checks.abstractApi,
  });
}
