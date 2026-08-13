// ============================================================
// TRACEPOINT — Configuration Check API
// Returns which API keys are configured, and whether demo mode is active.
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
  const criticalKeys = ['numverify', 'serper', 'openai'];
  const missingCritical = criticalKeys.filter(k => !checks[k]);
  const isDemoMode = missingCritical.length > 0;

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
    isDemoMode,
    missingCritical,
    demoMessage: isDemoMode
      ? `Demo mode active — ${missingCritical.length} provider(s) using simulated data. Investigations will run with mock results. Set API keys in .env.local for real data.`
      : null,
  });
}
