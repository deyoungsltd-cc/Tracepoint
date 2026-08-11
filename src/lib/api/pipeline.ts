// ============================================================
// TRACEPOINT — Real Investigation Pipeline (Enhanced)
// Uses server-side proxy routes for all API calls.
// API keys never leave the server.
//
// Pipeline stages:
//   1. Phone Validation (NumVerify)
//   2. Phone Enrichment (AbstractAPI free / Twilio fallback)
//   3. Web Search (Serper)
//   4. Social Profile Scraper
//   5. Messaging OSINT (WhatsApp/Telegram/Signal)
//   6. Business Association (web search for business ties)
//   7. Public Presence (web search for public records / mentions)
//   8. Location Enrichment (geocode from evidence)
//   9. Identity Correlation
//  10. Confidence Calculation
//  11. AI Assessment (OpenAI GPT-4o)
//  12. Finalize & Sanity Cap
// ============================================================

import type { Investigation, EvidenceItem, IdentityCandidate, TimelineEvent, AIAssessment } from '@/lib/types';
import { analyzeIdentity } from '@/lib/api/openai';
import { lookupTwilio } from '@/lib/api/twilio';
import type { TwilioLookupResult } from '@/lib/api/twilio';
import { lookupAbstractPhone, type AbstractPhoneResult } from '@/lib/api/abstractphone';
import { extractSocialUrls, scrapeSocialProfiles, type ScrapedProfile } from '@/lib/api/social-scraper';
import { checkAllMessagingPlatforms, type MessagingCheckResult } from '@/lib/api/messaging-osint';
import { withCache, cacheKey, TTL } from '@/lib/api-cache';

// Score helper
function clampScore(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

function evidenceReliability(sourceType: string): number {
  const map: Record<string, number> = {
    government_record: 97,
    official_website: 93,
    business_directory: 80,
    professional_profile: 75,
    news: 85,
    social_profile: 55,
    web_search: 50,
    phone_validation: 95,
    public_record: 88,
    messaging_osint: 40,
  };
  return map[sourceType] || 50;
}

function timestampNow(): string {
  return new Date().toISOString();
}

function uuid(): string {
  return crypto.randomUUID();
}

// --- Server-side API proxies (keys never leave the server) ---

async function proxyNumVerify(phone: string): Promise<Record<string, unknown> | null> {
  try {
    const t0 = Date.now();
    const res = await fetch(`/api/numverify?phone=${encodeURIComponent(phone)}`);
    const ms = Date.now() - t0;
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[Pipeline:Stage1] NumVerify API error ${res.status} (${ms}ms): ${body}`);
      return null;
    }
    const data = await res.json();
    console.log(`[Pipeline:Stage1] NumVerify OK (${ms}ms), valid=${data.valid}`);
    return data;
  } catch (err) {
    console.error('[Pipeline:Stage1] NumVerify fetch failed:', err);
    return null;
  }
}

async function proxySerperSearch(query: string): Promise<Array<{ title: string; link: string; snippet: string }>> {
  try {
    const t0 = Date.now();
    const res = await fetch('/api/serper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const ms = Date.now() - t0;
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[Pipeline:Stage3] Serper API error ${res.status} (${ms}ms): ${body}`);
      return [];
    }
    const data = await res.json();
    const results = (data.organic || []).map((item: Record<string, unknown>) => ({
      title: String(item.title || ''),
      link: String(item.link || ''),
      snippet: String(item.snippet || ''),
    }));
    console.log(`[Pipeline:Stage3] Serper OK (${ms}ms), ${results.length} results for: ${query.substring(0, 60)}`);
    return results;
  } catch (err) {
    console.error('[Pipeline:Stage3] Serper fetch failed:', err);
    return [];
  }
}

export interface PipelineConfig {
  phone?: string;
  phoneNormalized?: string;
  email?: string;
  country?: string;
  depth: 'quick' | 'standard' | 'deep';
}

export interface PipelineCallbacks {
  onProgress: (stage: string, message: string, progress: number) => void;
}

// Stage 1: Validate phone via NumVerify (server proxy) — cached
async function stagePhoneValidation(config: PipelineConfig): Promise<{
  phoneInfo: Record<string, unknown> | null;
  evidence: EvidenceItem[];
  timeline: TimelineEvent[];
  country: string;
}> {
  const evidence: EvidenceItem[] = [];
  const timeline: TimelineEvent[] = [];
  let phoneInfo: Record<string, unknown> | null = null;
  let country = config.country || '';

  if (config.phoneNormalized) {
    const result = await withCache(
      cacheKey('numverify', config.phoneNormalized),
      () => proxyNumVerify(config.phoneNormalized!),
      TTL.PHONE_VALIDATION
    );

    if (result && result.valid) {
      phoneInfo = result;
      country = String(result.country_code || country);
      timeline.push({
        id: uuid(),
        eventType: 'phone_validated',
        description: `Phone validated: ${result.line_type || 'Unknown type'}, ${result.carrier || 'Unknown carrier'}, ${result.country_name || ''}`,
        metadata: { valid: true, country: result.country_code, carrier: result.carrier, lineType: result.line_type },
        timestamp: timestampNow(),
      });
      evidence.push({
        id: uuid(),
        claim: `Phone number ${result.international_format} is a valid ${result.line_type || 'phone'} number registered in ${result.country_name || 'unknown'}${result.carrier ? ` via ${result.carrier}` : ''}`,
        sourceName: 'NumVerify Phone Validation',
        sourceType: 'phone_validation',
        sourceUrl: null,
        discoveredAt: timestampNow(),
        publishedAt: null,
        excerpt: `Country: ${result.country_name}, Location: ${result.location || 'N/A'}, Carrier: ${result.carrier || 'N/A'}, Line: ${result.line_type || 'N/A'}`,
        reliabilityScore: 95,
        relevanceScore: 90,
        freshnessScore: 99,
        verificationStatus: 'verified',
      });
    } else if (result) {
      timeline.push({
        id: uuid(),
        eventType: 'phone_invalid',
        description: 'Phone number could not be validated',
        metadata: { valid: false },
        timestamp: timestampNow(),
      });
    } else {
      timeline.push({
        id: uuid(),
        eventType: 'phone_validation_failed',
        description: 'Phone validation service unavailable',
        metadata: null,
        timestamp: timestampNow(),
      });
    }
  }

  return { phoneInfo, evidence, timeline, country };
}

// Stage 2: Phone Enrichment (AbstractAPI free tier first, Twilio as fallback) — cached
// AbstractAPI: 100 free calls/month — carrier, line type, VOIP detection, connection status
// Twilio: paid — caller name (CNAM), call forwarding, MCC/MNC
async function stagePhoneEnrichment(
  config: PipelineConfig,
  currentCountry: string,
  hasWebCandidates: boolean,
  fallbackCandidateName: string | null,
): Promise<{
  evidence: EvidenceItem[];
  timeline: TimelineEvent[];
  country: string;
  fallbackCandidateName: string | null;
  callerName: string | null;
}> {
  const evidence: EvidenceItem[] = [];
  const timeline: TimelineEvent[] = [];
  let country = currentCountry;
  let callerName: string | null = null;

  if (!config.phoneNormalized) {
    return { evidence, timeline, country, fallbackCandidateName, callerName };
  }

  // --- Try AbstractAPI (FREE) first ---
  const abstractResult: AbstractPhoneResult | null = await withCache(
    cacheKey('abstractphone', config.phoneNormalized),
    () => lookupAbstractPhone(config.phoneNormalized!),
    30 * 60 * 1000
  );

  if (abstractResult && abstractResult.valid) {
    const provider = 'AbstractAPI';
    const phoneType = abstractResult.type || 'unknown';
    const carrier = abstractResult.carrier || 'Unknown';
    const location = abstractResult.location || '';
    const connected = abstractResult.connected;
    const isVoip = phoneType.toLowerCase() === 'voip';
    const isRoaming = abstractResult.roaming === true;

    timeline.push({
      id: uuid(),
      eventType: 'abstractphone_enrichment',
      description: `${provider} enrichment: ${carrier} (${phoneType})${location ? ` — ${location}` : ''}`,
      metadata: { provider, carrier, type: phoneType, connected, roaming: isRoaming },
      timestamp: timestampNow(),
    });

    // Carrier evidence
    evidence.push({
      id: uuid(),
      claim: `Phone ${config.phoneNormalized} is carried by ${carrier} (${phoneType})${location ? ` in ${location}` : ''}`,
      sourceName: `${provider} Phone Enrichment`,
      sourceType: 'phone_validation',
      sourceUrl: null,
      discoveredAt: timestampNow(),
      publishedAt: null,
      excerpt: `Carrier: ${carrier}, Type: ${phoneType}, Location: ${location || 'N/A'}, Connected: ${connected ? 'Yes' : 'No'}${isRoaming ? ', Roaming' : ''}${isVoip ? ', VOIP' : ''}`,
      reliabilityScore: 90,
      relevanceScore: 75,
      freshnessScore: 99,
      verificationStatus: 'verified',
    });

    // VOIP detection — important for fraud assessment
    if (isVoip) {
      evidence.push({
        id: uuid(),
        claim: `Phone ${config.phoneNormalized} is a VOIP number — potentially higher risk for identity verification`,
        sourceName: `${provider} VOIP Detection`,
        sourceType: 'phone_validation',
        sourceUrl: null,
        discoveredAt: timestampNow(),
        publishedAt: null,
        excerpt: `Line type: VOIP (virtual number). VOIP numbers are often used for temporary or anonymous communications.`,
        reliabilityScore: 85,
        relevanceScore: 70,
        freshnessScore: 99,
        verificationStatus: 'verified',
      });
    }

    // Connection status
    if (connected !== undefined && connected !== null) {
      evidence.push({
        id: uuid(),
        claim: `Phone ${config.phoneNormalized} is currently ${connected ? 'ACTIVE and connected' : 'DISCONNECTED or inactive'}`,
        sourceName: `${provider} Connection Check`,
        sourceType: 'phone_validation',
        sourceUrl: null,
        discoveredAt: timestampNow(),
        publishedAt: null,
        excerpt: `Status: ${connected ? 'Connected' : 'Disconnected'}`,
        reliabilityScore: 80,
        relevanceScore: 65,
        freshnessScore: 99,
        verificationStatus: connected ? 'verified' : 'possible',
      });
    }

    // Update country from AbstractAPI
    if (abstractResult.country?.code && !country) {
      country = abstractResult.country.code;
    }
    if (location && !country) {
      // Fallback: try to derive country from location string
      const countryNames: Record<string, string> = {
        'united states': 'US', 'united kingdom': 'GB', 'canada': 'CA', 'australia': 'AU',
        'germany': 'DE', 'france': 'FR', 'india': 'IN', 'japan': 'JP', 'brazil': 'BR',
        'nigeria': 'NG', 'south africa': 'ZA', 'mexico': 'MX', 'china': 'CN',
      };
      const mapped = countryNames[location.toLowerCase()];
      if (mapped) country = mapped;
    }

    // AbstractAPI doesn't provide caller name on all plans.
    // Phone Intelligence API may return caller_name and risk_score.
    if (abstractResult.caller_name) {
      callerName = abstractResult.caller_name;
      timeline.push({
        id: uuid(),
        eventType: 'abstractphone_caller_name',
        description: `Caller name: ${abstractResult.caller_name}`,
        metadata: { name: abstractResult.caller_name },
        timestamp: timestampNow(),
      });
      evidence.push({
        id: uuid(),
        claim: `Registered caller name for ${config.phoneNormalized} is "${abstractResult.caller_name}"`,
        sourceName: `${provider} Caller Name`,
        sourceType: 'phone_validation',
        sourceUrl: null,
        discoveredAt: timestampNow(),
        publishedAt: null,
        excerpt: `Caller Name: ${abstractResult.caller_name}`,
        reliabilityScore: 80,
        relevanceScore: 75,
        freshnessScore: 99,
        verificationStatus: 'possible',
      });
      if (!hasWebCandidates && !fallbackCandidateName) {
        fallbackCandidateName = abstractResult.caller_name;
      }
    }

    // Risk score (Phone Intelligence API feature)
    if (abstractResult.risk_score !== undefined && abstractResult.risk_score !== null) {
      const risk = abstractResult.risk_score;
      const riskLevel = risk >= 75 ? 'HIGH' : risk >= 40 ? 'MEDIUM' : 'LOW';
      timeline.push({
        id: uuid(),
        eventType: 'abstractphone_risk',
        description: `Fraud risk score: ${risk}/100 (${riskLevel})`,
        metadata: { score: risk, level: riskLevel },
        timestamp: timestampNow(),
      });
      evidence.push({
        id: uuid(),
        claim: `Phone ${config.phoneNormalized} has a fraud risk score of ${risk}/100 (${riskLevel} risk)`,
        sourceName: `${provider} Risk Analysis`,
        sourceType: 'phone_validation',
        sourceUrl: null,
        discoveredAt: timestampNow(),
        publishedAt: null,
        excerpt: `Risk Score: ${risk}/100. ${risk >= 75 ? 'This number exhibits characteristics commonly associated with fraudulent activity.' : risk >= 40 ? 'This number has some risk indicators.' : 'This number appears to be low risk.'}`,
        reliabilityScore: 80,
        relevanceScore: risk >= 75 ? 80 : risk >= 40 ? 65 : 50,
        freshnessScore: 99,
        verificationStatus: 'verified',
      });
    }

    // Twilio below can still add call forwarding if configured.
  } else {
    timeline.push({
      id: uuid(),
      eventType: 'abstractphone_skipped',
      description: 'AbstractAPI unavailable — check ABSTRACT_API_KEY in server environment',
      metadata: null,
      timestamp: timestampNow(),
    });
  }

  // --- Try Twilio as fallback/addition (if configured, adds caller name + call forwarding) ---
  const twilioResult: TwilioLookupResult | null = await withCache(
    cacheKey('twilio', config.phoneNormalized),
    () => lookupTwilio(config.phoneNormalized!),
    TTL.TWILIO_LOOKUP
  );

  if (twilioResult) {
    // Caller Name (CNAM) — only Twilio provides this
    if (twilioResult.caller_name?.caller_name) {
      const name = twilioResult.caller_name.caller_name;
      callerName = name;
      timeline.push({
        id: uuid(),
        eventType: 'twilio_caller_name',
        description: `Caller name retrieved: ${name}`,
        metadata: { firstName: twilioResult.caller_name.first_name, lastName: twilioResult.caller_name.last_name },
        timestamp: timestampNow(),
      });
      evidence.push({
        id: uuid(),
        claim: `Registered caller name for ${config.phoneNormalized} is "${name}"`,
        sourceName: 'Twilio Caller Name',
        sourceType: 'phone_validation',
        sourceUrl: null,
        discoveredAt: timestampNow(),
        publishedAt: null,
        excerpt: `Caller Name: ${name}${twilioResult.caller_name.first_name ? ` (First: ${twilioResult.caller_name.first_name}, Last: ${twilioResult.caller_name.last_name})` : ''}`,
        reliabilityScore: 85,
        relevanceScore: 80,
        freshnessScore: 99,
        verificationStatus: 'possible',
      });
      if (!hasWebCandidates && !fallbackCandidateName) {
        fallbackCandidateName = name;
      }
    }

    // Call Forwarding — only Twilio provides this
    if (twilioResult.call_forwarding) {
      const enabled = twilioResult.call_forwarding.enabled;
      timeline.push({
        id: uuid(),
        eventType: 'twilio_call_forwarding',
        description: `Call forwarding: ${enabled ? 'ENABLED' : 'disabled'}`,
        metadata: { enabled },
        timestamp: timestampNow(),
      });
      evidence.push({
        id: uuid(),
        claim: `Call forwarding for ${config.phoneNormalized} is ${enabled ? 'enabled — number may be redirected to another device' : 'disabled'}`,
        sourceName: 'Twilio Call Forwarding Check',
        sourceType: 'phone_validation',
        sourceUrl: null,
        discoveredAt: timestampNow(),
        publishedAt: null,
        excerpt: `Call Forwarding: ${enabled ? 'Enabled' : 'Disabled'}`,
        reliabilityScore: 95,
        relevanceScore: 65,
        freshnessScore: 99,
        verificationStatus: 'verified',
      });
    }

    // MCC-based country fallback from Twilio
    const mcc = twilioResult.carrier?.mobile_country_code || twilioResult.line_type_intelligence?.mobile_country_code;
    if (mcc && !country) {
      const mccCountryMap: Record<string, string> = {
        '310': 'US', '311': 'US', '312': 'US', '313': 'US', '314': 'US', '315': 'US', '316': 'US',
        '234': 'GB', '235': 'GB',
        '208': 'FR', '222': 'IT', '262': 'DE', '214': 'ES',
        '404': 'IN', '405': 'IN', '406': 'IN', '407': 'IN', '408': 'IN', '409': 'IN', '410': 'IN', '411': 'IN', '412': 'IN', '413': 'IN', '414': 'IN', '415': 'IN',
        '730': 'CL', '724': 'BR', '334': 'MX', '732': 'CO',
        '440': 'JP', '450': 'KR', '460': 'CN', '454': 'HK', '525': 'SG',
        '530': 'NZ', '505': 'AU', '302': 'CA',
      };
      const mapped = mccCountryMap[mcc];
      if (mapped) country = mapped;
    }
  }

  return { evidence, timeline, country, fallbackCandidateName, callerName };
}

// Stage 3: Web search via Serper.dev (server proxy) — cached
async function stageWebSearch(config: PipelineConfig, country: string): Promise<{
  searchResults: Array<{ title: string; link: string; snippet: string }>;
  evidence: EvidenceItem[];
  timeline: TimelineEvent[];
}> {
  const evidence: EvidenceItem[] = [];
  const timeline: TimelineEvent[] = [];
  let searchResults: Array<{ title: string; link: string; snippet: string }> = [];

  const queries: string[] = [];
  if (config.phoneNormalized) queries.push(`"${config.phoneNormalized}"`);
  if (config.email) queries.push(`"${config.email}"`);
  if (config.phoneNormalized && country) {
    queries.push(`${config.phoneNormalized.replace(/[^0-9+]/g, '')} site:linkedin.com OR site:facebook.com OR site:twitter.com`);
  }
  if (config.phoneNormalized) {
    queries.push(`${config.phoneNormalized.replace(/[^0-9+]/g, '')} site:wa.me OR site:t.me`);
  }

  const maxQueries = config.depth === 'quick' ? 1 : config.depth === 'standard' ? 3 : queries.length;

  for (let i = 0; i < Math.min(maxQueries, queries.length); i++) {
    const results = await withCache(
      cacheKey('serper', queries[i]),
      () => proxySerperSearch(queries[i]),
      TTL.WEB_SEARCH
    );
    searchResults.push(...results);
    timeline.push({
      id: uuid(),
      eventType: 'web_search',
      description: `Search "${queries[i].substring(0, 60)}..." returned ${results.length} results`,
      metadata: { query: queries[i], count: results.length },
      timestamp: timestampNow(),
    });
  }

  for (const result of searchResults) {
    const relScore = clampScore(
      50 + (config.email && result.snippet.toLowerCase().includes(config.email.toLowerCase()) ? 30 : 0) +
      (config.phoneNormalized && result.snippet.toLowerCase().includes(config.phoneNormalized.replace(/[^0-9]/g, '')) ? 25 : 0)
    );

    evidence.push({
      id: uuid(),
      claim: result.title,
      sourceName: (() => { try { return new URL(result.link).hostname.replace('www.', ''); } catch { return 'unknown'; } })(),
      sourceType: 'web_search',
      sourceUrl: result.link,
      discoveredAt: timestampNow(),
      publishedAt: null,
      excerpt: result.snippet,
      reliabilityScore: evidenceReliability('web_search'),
      relevanceScore: relScore,
      freshnessScore: 50,
      verificationStatus: relScore >= 70 ? 'possible' : 'unverified',
    });
  }

  return { searchResults, evidence, timeline };
}

// Stage 4 (NEW): Social Profile Scraper
async function stageSocialScraper(
  searchResults: Array<{ title: string; link: string; snippet: string }>,
  config: PipelineConfig,
): Promise<{ evidence: EvidenceItem[]; timeline: TimelineEvent[]; profiles: ScrapedProfile[] }> {
  const evidence: EvidenceItem[] = [];
  const timeline: TimelineEvent[] = [];
  const profiles: ScrapedProfile[] = [];

  // Only run for 'standard' or 'deep' investigations
  if (config.depth === 'quick') return { evidence, timeline, profiles };

  const socialUrls = extractSocialUrls(searchResults);
  if (socialUrls.length === 0) {
    return { evidence, timeline, profiles };
  }

  timeline.push({
    id: uuid(),
    eventType: 'social_scrape_start',
    description: `Scraping ${socialUrls.length} social profile(s)...`,
    metadata: { urls: socialUrls },
    timestamp: timestampNow(),
  });

  // Scrape social profiles (limited concurrency)
  const maxScrape = config.depth === 'deep' ? 5 : 3;
  const scraped = await scrapeSocialProfiles(socialUrls.slice(0, maxScrape));
  profiles.push(...scraped);

  for (const profile of scraped) {
    timeline.push({
      id: uuid(),
      eventType: 'social_profile_found',
      description: `${profile.platform} profile found: ${profile.name || 'Unknown'}`,
      metadata: { platform: profile.platform, name: profile.name, followers: profile.followers },
      timestamp: timestampNow(),
    });

    evidence.push({
      id: uuid(),
      claim: `${profile.platform} profile: ${profile.name || 'Unknown'}${profile.location ? ` — ${profile.location}` : ''}`,
      sourceName: `${profile.platform} Profile`,
      sourceType: 'social_profile',
      sourceUrl: profile.url,
      discoveredAt: timestampNow(),
      publishedAt: null,
      excerpt: profile.bio || profile.rawSnippet || 'No bio available',
      reliabilityScore: evidenceReliability('social_profile'),
      relevanceScore: profile.name ? 65 : 40,
      freshnessScore: 70,
      verificationStatus: 'possible',
    });

    // Add follower count as supporting evidence
    if (profile.followers && profile.followers > 0) {
      evidence.push({
        id: uuid(),
        claim: `${profile.platform} account has ${profile.followers.toLocaleString()} followers/subscribers`,
        sourceName: `${profile.platform} Metrics`,
        sourceType: 'social_profile',
        sourceUrl: profile.url,
        discoveredAt: timestampNow(),
        publishedAt: null,
        excerpt: `Followers: ${profile.followers.toLocaleString()}`,
        reliabilityScore: 50,
        relevanceScore: 45,
        freshnessScore: 70,
        verificationStatus: 'unverified',
      });
    }

    // Add username as evidence for Telegram
    if (profile.platform === 'Telegram' && profile.url) {
      const usernameMatch = profile.url.match(/t\.me\/([a-zA-Z0-9_]{5,})/);
      if (usernameMatch && usernameMatch[1] !== 'joinchat') {
        evidence.push({
          id: uuid(),
          claim: `Telegram username: @${usernameMatch[1]}`,
          sourceName: 'Telegram Username',
          sourceType: 'social_profile',
          sourceUrl: profile.url,
          discoveredAt: timestampNow(),
          publishedAt: null,
          excerpt: `Username: @${usernameMatch[1]}`,
          reliabilityScore: 60,
          relevanceScore: 55,
          freshnessScore: 80,
          verificationStatus: 'possible',
        });
      }
    }
  }

  return { evidence, timeline, profiles };
}

// Stage 5 (NEW): Messaging Platform OSINT
async function stageMessagingOSINT(config: PipelineConfig): Promise<{
  evidence: EvidenceItem[];
  timeline: TimelineEvent[];
  results: MessagingCheckResult[];
}> {
  const evidence: EvidenceItem[] = [];
  const timeline: TimelineEvent[] = [];

  // Only run for 'deep' investigations with a phone number
  if (config.depth !== 'deep' || !config.phoneNormalized) {
    return { evidence, timeline, results: [] };
  }

  timeline.push({
    id: uuid(),
    eventType: 'messaging_osint_start',
    description: 'Checking messaging platform registrations (WhatsApp, Telegram, Signal)...',
    metadata: null,
    timestamp: timestampNow(),
  });

  const results = await checkAllMessagingPlatforms(config.phoneNormalized);

  for (const check of results) {
    const isRegistered = check.isRegistered === true;
    const isUnknown = check.isRegistered === 'unknown';

    timeline.push({
      id: uuid(),
      eventType: `messaging_${check.platform.toLowerCase()}`,
      description: `${check.platform}: ${isRegistered ? 'Indicators found' : isUnknown ? 'No public indicators' : 'Not detected'}`,
      metadata: { platform: check.platform, registered: check.isRegistered, indicator: check.indicator },
      timestamp: timestampNow(),
    });

    if (isRegistered && check.evidence) {
      evidence.push({
        id: uuid(),
        claim: `${check.platform}: ${check.indicator}`,
        sourceName: `${check.platform} OSINT`,
        sourceType: 'messaging_osint',
        sourceUrl: null,
        discoveredAt: timestampNow(),
        publishedAt: null,
        excerpt: check.evidence.substring(0, 300),
        reliabilityScore: evidenceReliability('messaging_osint'),
        relevanceScore: isRegistered ? 60 : 30,
        freshnessScore: 75,
        verificationStatus: 'possible',
      });
    }

    // Add Telegram username as a high-value finding
    if (check.platform === 'Telegram' && check.username) {
      evidence.push({
        id: uuid(),
        claim: `Telegram username identified: @${check.username}`,
        sourceName: 'Telegram OSINT',
        sourceType: 'social_profile',
        sourceUrl: `https://t.me/${check.username}`,
        discoveredAt: timestampNow(),
        publishedAt: null,
        excerpt: `Username: @${check.username}`,
        reliabilityScore: 55,
        relevanceScore: 65,
        freshnessScore: 80,
        verificationStatus: 'possible',
      });
    }
  }

  return { evidence, timeline, results };
}

// Stage 6 (NEW): Business Association — search for business ties
async function stageBusinessAssociation(
  config: PipelineConfig,
  candidates: { name: string | null }[],
): Promise<{ evidence: EvidenceItem[]; timeline: TimelineEvent[] }> {
  const evidence: EvidenceItem[] = [];
  const timeline: TimelineEvent[] = [];

  // Build search queries from known identities
  const queries: string[] = [];
  if (config.phoneNormalized) {
    queries.push(`"${config.phoneNormalized.replace(/[^0-9+]/g, '')}" business OR company OR founder OR CEO OR director`);
  }
  for (const c of candidates) {
    if (c.name) {
      queries.push(`"${c.name}" LinkedIn OR business OR company OR "about"`);
    }
  }
  if (config.email) {
    queries.push(`"${config.email}" LinkedIn OR company OR business`);
  }

  if (queries.length === 0) return { evidence, timeline };

  const maxQueries = config.depth === 'quick' ? 1 : Math.min(queries.length, 3);

  for (let i = 0; i < maxQueries; i++) {
    console.log(`[Pipeline:Stage6] Business search: ${queries[i].substring(0, 60)}`);
    const results = await proxySerperSearch(queries[i]);
    for (const r of results) {
      // Filter for business-related results
      const isBusiness = /business|company|founder|ceo|director|inc|llc|ltd|corp|startup|enterprise|firm|agency|group|partner/i.test(r.title + ' ' + r.snippet);
      if (!isBusiness) continue;

      evidence.push({
        id: uuid(),
        claim: r.title,
        sourceName: (() => { try { return new URL(r.link).hostname.replace('www.', ''); } catch { return 'unknown'; } })(),
        sourceType: 'business_directory',
        sourceUrl: r.link,
        discoveredAt: timestampNow(),
        publishedAt: null,
        excerpt: r.snippet,
        reliabilityScore: evidenceReliability('business_directory'),
        relevanceScore: 70,
        freshnessScore: 60,
        verificationStatus: 'possible',
      });
    }
  }

  if (evidence.length > 0) {
    timeline.push({
      id: uuid(),
      eventType: 'business_association',
      description: `Found ${evidence.length} business association(s)`,
      metadata: { count: evidence.length },
      timestamp: timestampNow(),
    });
  } else {
    timeline.push({
      id: uuid(),
      eventType: 'business_association',
      description: 'No business associations found',
      metadata: null,
      timestamp: timestampNow(),
    });
  }

  return { evidence, timeline };
}

// Stage 7 (NEW): Public Presence — search for public records, news, mentions
async function stagePublicPresence(
  config: PipelineConfig,
  candidates: { name: string | null }[],
): Promise<{ evidence: EvidenceItem[]; timeline: TimelineEvent[] }> {
  const evidence: EvidenceItem[] = [];
  const timeline: TimelineEvent[] = [];

  const queries: string[] = [];
  if (config.phoneNormalized) {
    queries.push(`"${config.phoneNormalized.replace(/[^0-9+]/g, '')}" news OR arrest OR court OR record OR filing`);
  }
  for (const c of candidates) {
    if (c.name) {
      queries.push(`"${c.name}" news OR public record OR court OR mention`);
    }
  }

  if (queries.length === 0) return { evidence, timeline };

  const maxQueries = config.depth === 'quick' ? 1 : Math.min(queries.length, 2);

  for (let i = 0; i < maxQueries; i++) {
    console.log(`[Pipeline:Stage7] Public presence search: ${queries[i].substring(0, 60)}`);
    const results = await proxySerperSearch(queries[i]);
    for (const r of results) {
      const isPublicRecord = /news|court|record|filing|arrest|lawsuit|judgment|government|registry|public/i.test(r.title + ' ' + r.snippet);
      if (!isPublicRecord) continue;

      evidence.push({
        id: uuid(),
        claim: r.title,
        sourceName: (() => { try { return new URL(r.link).hostname.replace('www.', ''); } catch { return 'unknown'; } })(),
        sourceType: 'news',
        sourceUrl: r.link,
        discoveredAt: timestampNow(),
        publishedAt: null,
        excerpt: r.snippet,
        reliabilityScore: evidenceReliability('news'),
        relevanceScore: 65,
        freshnessScore: 55,
        verificationStatus: 'unverified',
      });
    }
  }

  if (evidence.length > 0) {
    timeline.push({
      id: uuid(),
      eventType: 'public_presence',
      description: `Found ${evidence.length} public record(s)/mention(s)`,
      metadata: { count: evidence.length },
      timestamp: timestampNow(),
    });
  }

  return { evidence, timeline };
}

// Stage 8 (NEW): Location Enrichment — extract and enrich location data
function stageLocationEnrichment(
  allEvidence: EvidenceItem[],
  phoneInfo: Record<string, unknown> | null,
  candidates: IdentityCandidate[],
): { locations: Investigation['locations']; evidence: EvidenceItem[]; timeline: TimelineEvent[] } {
  const locations: Investigation['locations'] = [];
  const evidence: EvidenceItem[] = [];
  const timeline: TimelineEvent[] = [];

  // 1. Extract location from NumVerify geolocation
  if (phoneInfo && phoneInfo.valid) {
    const lat = parseFloat(phoneInfo.latitude as string);
    const lng = parseFloat(phoneInfo.longitude as string);
    if (!isNaN(lat) && !isNaN(lng)) {
      locations.push({
        id: `numverify-${uuid()}`,
        deviceId: null,
        provider: 'NumVerify Geolocation',
        status: 'last_known',
        latitude: lat,
        longitude: lng,
        accuracy: null,
        address: String(phoneInfo.location || phoneInfo.country_name || ''),
        timestamp: timestampNow(),
        freshness: 'recent',
        deviceStatus: null,
        batteryLevel: null,
        networkType: null,
      });
    }
  }

  // 2. Extract locations from evidence snippets
  const locationPatterns = [
    /(?:located in|based in|from|lives in)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g,
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z]{2})/g,
  ];

  const seenLocations = new Set<string>();
  for (const ev of allEvidence) {
    const text = `${ev.claim || ''} ${ev.excerpt || ''}`;
    for (const pattern of locationPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const locStr = match[0];
        if (locStr.length > 3 && locStr.length < 50 && !seenLocations.has(locStr)) {
          seenLocations.add(locStr);
          // Try to geocode via roughGeocode
          const geocoded = roughGeocode(locStr);
          if (geocoded) {
            locations.push({
              id: `extracted-${uuid()}`,
              deviceId: null,
              provider: 'Evidence Extraction',
              status: 'inferred',
              latitude: geocoded.lat,
              longitude: geocoded.lng,
              accuracy: null,
              address: locStr,
              timestamp: timestampNow(),
              freshness: 'unknown',
              deviceStatus: null,
              batteryLevel: null,
              networkType: null,
            });
          }
        }
      }
    }
  }

  // 3. Add candidate locations
  for (const c of candidates) {
    if (c.location) {
      const geocoded = roughGeocode(c.location);
      if (geocoded) {
        locations.push({
          id: `candidate-${c.id}`,
          deviceId: null,
          provider: 'Candidate Profile',
          status: 'inferred',
          latitude: geocoded.lat,
          longitude: geocoded.lng,
          accuracy: null,
          address: c.location,
          timestamp: timestampNow(),
          freshness: 'unknown',
          deviceStatus: null,
          batteryLevel: null,
          networkType: null,
        });
      }
    }
  }

  if (locations.length > 0) {
    timeline.push({
      id: uuid(),
      eventType: 'location_enrichment',
      description: `Derived ${locations.length} location(s) from evidence`,
      metadata: { count: locations.length },
      timestamp: timestampNow(),
    });
    evidence.push({
      id: uuid(),
      claim: `${locations.length} location(s) identified: ${locations.map(l => l.address || 'unknown').join(', ')}`,
      sourceName: 'Location Enrichment',
      sourceType: 'web_search',
      sourceUrl: null,
      discoveredAt: timestampNow(),
      publishedAt: null,
      excerpt: locations.map(l => `${l.address} (${l.provider})`).join('; '),
      reliabilityScore: 60,
      relevanceScore: 65,
      freshnessScore: 70,
      verificationStatus: 'possible',
    });
  }

  return { locations, evidence, timeline };
}

// Helper: inline rough geocode (same logic as store but available in pipeline)
function roughGeocode(location: string): { lat: number; lng: number } | null {
  const cities: Record<string, { lat: number; lng: number }> = {
    'san francisco': { lat: 37.7749, lng: -122.4194 },
    'los angeles': { lat: 34.0522, lng: -118.2437 },
    'new york': { lat: 40.7128, lng: -74.006 },
    'london': { lat: 51.5074, lng: -0.1278 },
    'berlin': { lat: 52.52, lng: 13.405 },
    'paris': { lat: 48.8566, lng: 2.3522 },
    'tokyo': { lat: 35.6762, lng: 139.6503 },
    'sydney': { lat: -33.8688, lng: 151.2093 },
    'dubai': { lat: 25.2048, lng: 55.2708 },
    'lagos': { lat: 6.5244, lng: 3.3792 },
    'singapore': { lat: 1.3521, lng: 103.8198 },
    'mumbai': { lat: 19.076, lng: 72.8777 },
    'toronto': { lat: 43.6532, lng: -79.3832 },
    'chicago': { lat: 41.8781, lng: -87.6298 },
    'houston': { lat: 29.7604, lng: -95.3698 },
    'miami': { lat: 25.7617, lng: -80.1918 },
    'seattle': { lat: 47.6062, lng: -122.3321 },
    'austin': { lat: 30.2672, lng: -97.7431 },
    'denver': { lat: 39.7392, lng: -104.9903 },
    'atlanta': { lat: 33.749, lng: -84.388 },
    'boston': { lat: 42.3601, lng: -71.0589 },
    'dallas': { lat: 32.7767, lng: -96.797 },
    'phoenix': { lat: 33.4484, lng: -112.074 },
    'philadelphia': { lat: 39.9526, lng: -75.1652 },
    'washington': { lat: 38.9072, lng: -77.0369 },
    'nigeria': { lat: 9.082, lng: 8.6753 },
    'germany': { lat: 51.1657, lng: 10.4515 },
    'france': { lat: 46.6034, lng: 1.8883 },
    'japan': { lat: 36.2048, lng: 138.2529 },
    'india': { lat: 20.5937, lng: 78.9629 },
    'brazil': { lat: -14.235, lng: -51.9253 },
    'china': { lat: 35.8617, lng: 104.1954 },
    'australia': { lat: -25.2744, lng: 133.7751 },
    'canada': { lat: 56.1304, lng: -106.3468 },
    'united states': { lat: 37.0902, lng: -95.7129 },
    'uk': { lat: 55.3781, lng: -3.436 },
    'united kingdom': { lat: 55.3781, lng: -3.436 },
    'california': { lat: 36.7783, lng: -119.4179 },
    'texas': { lat: 31.9686, lng: -99.9018 },
    'florida': { lat: 27.6648, lng: -81.5158 },
  };
  const lower = location.toLowerCase();
  for (const [city, coords] of Object.entries(cities)) {
    if (lower.includes(city)) return coords;
  }
  return null;
}

// Stage 9: Correlate candidates from search results
function stageCorrelation(
  evidence: EvidenceItem[],
  phoneInfo: Record<string, unknown> | null,
  config: PipelineConfig
): { candidates: IdentityCandidate[]; updatedEvidence: EvidenceItem[] } {
  const candidateMap = new Map<string, IdentityCandidate>();

  for (const ev of evidence) {
    if (ev.sourceType === 'phone_validation') continue;

    let identityKey = '';
    let name: string | null = null;
    const title = ev.claim || '';
    const snippet = ev.excerpt || '';

    // Name extraction from different source types
    const nameMatch = title.match(/^([A-Z][a-z]+ [A-Z][a-z]+)/);
    if (nameMatch) {
      name = nameMatch[1];
      identityKey = name.toLowerCase();
    } else if (ev.sourceName && !['google', 'bing', 'yahoo'].includes(ev.sourceName.toLowerCase())) {
      identityKey = ev.sourceName;
    }

    if (!identityKey) continue;

    if (!candidateMap.has(identityKey)) {
      const matchFields: string[] = [];
      if (config.phoneNormalized && snippet.includes(config.phoneNormalized.replace(/[^0-9]/g, ''))) matchFields.push('phone');
      if (config.email && snippet.toLowerCase().includes(config.email.toLowerCase())) matchFields.push('email');

      // Check for Telegram username match
      const telegramMatch = snippet.match(/@([a-zA-Z0-9_]{5,})/);
      if (telegramMatch) matchFields.push('telegram_username');

      candidateMap.set(identityKey, {
        id: uuid(),
        rank: candidateMap.size + 1,
        name,
        phone: config.phoneNormalized || null,
        email: config.email || null,
        business: null,
        website: ev.sourceUrl && ev.sourceUrl.startsWith('http') ? ev.sourceUrl : null,
        location: phoneInfo && phoneInfo.location ? String(phoneInfo.location) : null,
        photoUrl: null,
        confidence: matchFields.length > 0 ? 60 : 30,
        verifiedStatus: matchFields.length >= 2 ? 'possible' : 'unverified',
        matchFields,
        evidence: [],
      });
    }

    const candidate = candidateMap.get(identityKey)!;
    ev.candidateId = candidate.id;
    candidate.evidence.push(ev);

    // Enrich candidate with social platform data
    if (ev.sourceType === 'social_profile' && ev.sourceName.includes('LinkedIn') && !candidate.business) {
      // LinkedIn often has company info in bio
      const bioLines = (ev.excerpt || '').split(/[|·,]/);
      for (const line of bioLines) {
        const trimmed = line.trim();
        if (trimmed.length > 3 && trimmed.length < 50 && !trimmed.includes('@') && !/\d{3}/.test(trimmed)) {
          candidate.business = trimmed;
          break;
        }
      }
    }
  }

  if (candidateMap.size === 0) {
    const phoneEvidence = evidence.filter(e => e.sourceType === 'phone_validation');
    const phoneValid = phoneInfo && phoneInfo.valid;

    if (phoneValid || config.email) {
      const candidate: IdentityCandidate = {
        id: uuid(),
        rank: 1,
        name: config.email ? config.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null,
        phone: phoneValid ? String(phoneInfo.international_format || '') : (config.phoneNormalized || null),
        email: config.email || null,
        business: null,
        website: null,
        location: phoneValid ? String(phoneInfo.location || phoneInfo.country_name || '') : null,
        photoUrl: null,
        confidence: phoneValid ? 55 : 35,
        verifiedStatus: phoneValid ? 'possible' : 'unverified',
        matchFields: [...(phoneValid ? ['phone'] : []), ...(config.email ? ['email'] : [])],
        evidence: [],
      };

      for (const ev of phoneEvidence) {
        ev.candidateId = candidate.id;
        candidate.evidence.push(ev);
      }

      return { candidates: [candidate], updatedEvidence: evidence };
    }

    return { candidates: [], updatedEvidence: evidence };
  }

  const sorted = Array.from(candidateMap.values()).sort((a, b) => {
    const aScore = a.confidence * 0.4 + a.evidence.length * 15;
    const bScore = b.confidence * 0.4 + b.evidence.length * 15;
    return bScore - aScore;
  });
  sorted.forEach((c, i) => { c.rank = i + 1; });

  return { candidates: sorted, updatedEvidence: evidence };
}

// Stage 7: AI analysis via OpenAI (already proxied) — cached
async function stageAIAnalysis(
  investigation: Investigation,
): Promise<{ aiAssessment: AIAssessment | null; timeline: TimelineEvent[] }> {
  const timeline: TimelineEvent[] = [];

  try {
    timeline.push({
      id: uuid(),
      eventType: 'ai_analyzing',
      description: 'AI analyst processing evidence and candidates...',
      metadata: null,
      timestamp: timestampNow(),
    });

    const assessment = await withCache(
      cacheKey('ai', investigation.id, investigation.evidence.length),
      () => analyzeIdentity(
        {
          phone: investigation.inputPhoneNormalized || '',
          email: investigation.inputEmail || '',
          candidates: investigation.candidates,
          evidence: investigation.evidence,
          country: investigation.inputCountry || '',
        },
        { model: 'gpt-4o' }
      ),
      TTL.AI_ANALYSIS
    );

    if (assessment) {
      timeline.push({
        id: uuid(),
        eventType: 'ai_completed',
        description: `AI assessment complete — ${assessment.confidence.level} confidence (${assessment.confidence.score}%)`,
        metadata: { level: assessment.confidence.level, score: assessment.confidence.score },
        timestamp: timestampNow(),
      });
    }

    return { aiAssessment: assessment, timeline };
  } catch {
    timeline.push({
      id: uuid(),
      eventType: 'ai_failed',
      description: 'AI analysis failed — continuing without AI assessment',
      metadata: null,
      timestamp: timestampNow(),
    });
    return { aiAssessment: null, timeline };
  }
}

// ============================================================
// MAIN PIPELINE
// ============================================================

export async function runRealInvestigation(
  config: PipelineConfig,
  callbacks: PipelineCallbacks
): Promise<{
  investigation: Investigation;
  aiAssessment: AIAssessment | null;
}> {
  const id = uuid();
  const now = timestampNow();
  const pipelineStart = Date.now();
  const allEvidence: EvidenceItem[] = [];
  const allTimeline: TimelineEvent[] = [];
  let country = config.country || '';
  console.log(`[Pipeline] === START investigation === phone=${config.phone}, email=${config.email}, depth=${config.depth}`);

  callbacks.onProgress('initializing', 'Initializing investigation...', 3);
  allTimeline.push({ id: uuid(), eventType: 'started', description: 'Investigation initiated', metadata: { phone: config.phone, email: config.email, depth: config.depth }, timestamp: now });

  // --- Stage 1: Phone Validation (cached) ---
  callbacks.onProgress('validation', 'Validating phone number...', 8);
  const phoneResult = await stagePhoneValidation(config);
  allEvidence.push(...phoneResult.evidence);
  allTimeline.push(...phoneResult.timeline);
  if (phoneResult.country) country = phoneResult.country;
  if (phoneResult.evidence.length === 0 && config.phoneNormalized) {
    allTimeline.push({ id: uuid(), eventType: 'warning', description: 'Phone validation returned no data — check NumVerify API key', metadata: null, timestamp: timestampNow() });
  }

  // --- Stage 2: Phone Enrichment (cached) ---
  callbacks.onProgress('enrichment', 'Enriching phone data...', 18);
  const enrichResult = await stagePhoneEnrichment(config, country, false, null);
  allEvidence.push(...enrichResult.evidence);
  allTimeline.push(...enrichResult.timeline);
  if (enrichResult.country) country = enrichResult.country;
  const callerName = enrichResult.callerName;
  if (enrichResult.evidence.length === 0 && config.phoneNormalized) {
    allTimeline.push({ id: uuid(), eventType: 'warning', description: 'Phone enrichment returned no data — check AbstractAPI key', metadata: null, timestamp: timestampNow() });
  }

  // --- Stage 3: Web Search (cached) ---
  callbacks.onProgress('discovery', 'Searching public sources...', 30);
  const searchResult = await stageWebSearch(config, country);
  allEvidence.push(...searchResult.evidence);
  allTimeline.push(...searchResult.timeline);
  if (searchResult.evidence.length === 0) {
    allTimeline.push({ id: uuid(), eventType: 'warning', description: 'Web search returned no results — check Serper API key', metadata: null, timestamp: timestampNow() });
  }

  // --- Stage 4: Social Profile Scraper (NEW) ---
  callbacks.onProgress('social_scraping', 'Scanning social profiles...', 45);
  const socialResult = await stageSocialScraper(searchResult.searchResults, config);
  allEvidence.push(...socialResult.evidence);
  allTimeline.push(...socialResult.timeline);

  // --- Stage 5: Messaging OSINT (deep only) ---
  callbacks.onProgress('messaging_check', 'Checking messaging platforms...', 52);
  const messagingResult = await stageMessagingOSINT(config);
  allEvidence.push(...messagingResult.evidence);
  allTimeline.push(...messagingResult.timeline);
  if (socialResult.evidence.length === 0 && config.depth !== 'quick') {
    allTimeline.push({ id: uuid(), eventType: 'info', description: 'No social profiles found in search results', metadata: null, timestamp: timestampNow() });
  }

  // --- Stage 6: Business Association (NEW) ---
  callbacks.onProgress('business_check', 'Searching business associations...', 60);
  // Need initial candidates for business search — do a quick correlation first
  const preCandidates = stageCorrelation(allEvidence, phoneResult.phoneInfo, config).candidates;
  const bizResult = await stageBusinessAssociation(config, preCandidates);
  allEvidence.push(...bizResult.evidence);
  allTimeline.push(...bizResult.timeline);

  // --- Stage 7: Public Presence (NEW) ---
  callbacks.onProgress('public_presence', 'Checking public records and mentions...', 68);
  const pubResult = await stagePublicPresence(config, preCandidates);
  allEvidence.push(...pubResult.evidence);
  allTimeline.push(...pubResult.timeline);

  // --- Stage 8: Location Enrichment (NEW) ---
  callbacks.onProgress('location_enrichment', 'Enriching location data...', 74);
  // Re-correlate with all evidence now (including business + public)
  const { candidates, updatedEvidence } = stageCorrelation(allEvidence, phoneResult.phoneInfo, config);
  const locResult = stageLocationEnrichment(allEvidence, phoneResult.phoneInfo, candidates);
  allEvidence.push(...locResult.evidence);
  allTimeline.push(...locResult.timeline);
  const enrichedLocations = locResult.locations;

  // Apply caller name from phone enrichment to candidates that have no name yet
  if (callerName) {
    for (const c of candidates) {
      if (!c.name) c.name = callerName;
    }
  }

  for (const candidate of candidates) {
    const candidateEvidence = allEvidence.filter(e => e.candidateId === candidate.id);
    const baseFromFields = candidate.matchFields.length * 15;
    if (candidateEvidence.length > 0) {
      const avgReliability = candidateEvidence.reduce((sum, e) => sum + e.reliabilityScore, 0) / candidateEvidence.length;
      const avgRelevance = candidateEvidence.reduce((sum, e) => sum + e.relevanceScore, 0) / candidateEvidence.length;
      candidate.confidence = clampScore(avgReliability * 0.4 + avgRelevance * 0.4 + Math.min(candidateEvidence.length * 8, 20) + baseFromFields);
    } else {
      candidate.confidence = clampScore(30 + baseFromFields);
    }
    candidate.verifiedStatus = candidate.confidence >= 80 ? 'verified' : candidate.confidence >= 50 ? 'possible' : 'unverified';
  }

  // --- Stage 10: Confidence Calculation ---
  callbacks.onProgress('confidence', 'Calculating confidence scores...', 80);
  const phoneEvCount = allEvidence.filter(e => e.sourceType === 'phone_validation').length;
  const socialEvCount = allEvidence.filter(e => e.sourceType === 'social_profile').length;
  const messagingEvCount = allEvidence.filter(e => e.sourceType === 'messaging_osint').length;
  const businessEvCount = allEvidence.filter(e => e.sourceType === 'business_directory').length;
  const publicEvCount = allEvidence.filter(e => e.sourceType === 'news').length;
  const overallConfidence = candidates.length > 0
    ? clampScore(
        candidates[0].confidence * 0.7 +
        Math.min((candidates[0].evidence?.length || 0) * 4, 20) +
        (phoneEvCount > 0 ? 8 : 0) +
        (socialEvCount > 0 ? 5 : 0) +
        (messagingEvCount > 0 ? 3 : 0) +
        (businessEvCount > 0 ? 4 : 0) +
        (publicEvCount > 0 ? 3 : 0)
      )
    : 0;

  // --- Stage 11: AI Assessment (cached) ---
  callbacks.onProgress('ai_analysis', 'Running AI analysis...', 88);
  const baseInvestigation: Investigation = {
    id,
    status: 'completed',
    depth: config.depth,
    isBatch: false,
    batchId: null,
    inputPhone: config.phone || null,
    inputPhoneNormalized: config.phoneNormalized || null,
    inputEmail: config.email || null,
    inputName: candidates[0]?.name || null,
    inputBusiness: null,
    inputRegion: null,
    inputCountry: country || null,
    inputState: null,
    inputCity: phoneResult.phoneInfo?.location ? String(phoneResult.phoneInfo.location) : null,
    summary: `Investigation completed for ${config.phone || config.email || 'unknown identifier'}. ${candidates.length} identity candidate${candidates.length !== 1 ? 's' : ''} found. ${socialResult.profiles.length} social profile${socialResult.profiles.length !== 1 ? 's' : ''} scanned. ${messagingResult.results.length} messaging platform${messagingResult.results.length !== 1 ? 's' : ''} checked. ${businessEvCount} business association${businessEvCount !== 1 ? 's' : ''} found. ${publicEvCount} public record${publicEvCount !== 1 ? 's' : ''} found. ${enrichedLocations.length} location${enrichedLocations.length !== 1 ? 's' : ''} derived.`,
    identityCount: candidates.length,
    evidenceCount: allEvidence.length,
    sourceCount: new Set(allEvidence.map(e => e.sourceName)).size,
    confidence: overallConfidence,
    hasConflicts: allEvidence.some(e => e.verificationStatus === 'conflicting'),
    locationStatus: enrichedLocations.length > 0 ? 'located' : 'unavailable',
    isDemoData: false,
    startedAt: now,
    completedAt: timestampNow(),
    createdAt: now,
    updatedAt: timestampNow(),
    candidates,
    evidence: updatedEvidence,
    locations: enrichedLocations,
    timeline: allTimeline,
  };

  const { aiAssessment, timeline: aiTimeline } = await stageAIAnalysis(baseInvestigation);
  allTimeline.push(...aiTimeline);
  baseInvestigation.timeline = allTimeline;

  // --- Stage 12: Finalize ---
  callbacks.onProgress('completing', 'Generating report...', 95);

  if (aiAssessment) {
    // Sanity cap: AI sometimes over-estimates confidence with minimal evidence.
    const nonPhoneEvidence = allEvidence.filter(e => e.sourceType !== 'phone_validation');
    const webEvidence = nonPhoneEvidence.filter(e => e.sourceType === 'web_search' && e.relevanceScore >= 60);
    let aiScore = aiAssessment.confidence.score;
    if (nonPhoneEvidence.length === 0 && webEvidence.length === 0) {
      aiScore = Math.min(aiScore, 45);
      aiAssessment.confidence.level = 'LOW';
      aiAssessment.confidence.explanation = 'Only phone number validation was available. No web sources or public records linked a specific identity to this number. ' + (aiAssessment.confidence.explanation || '');
    } else if (webEvidence.length < 2) {
      aiScore = Math.min(aiScore, 65);
      if (aiAssessment.confidence.level === 'HIGH') {
        aiAssessment.confidence.level = 'MODERATE';
      }
    }
    // Bonus: If social profiles found, allow slightly higher confidence
    if (socialEvCount >= 2 && aiScore >= 50) {
      aiScore = Math.min(aiScore + 5, 95);
    }
    baseInvestigation.confidence = aiScore;
    baseInvestigation.summary = aiAssessment.conclusion;
  }

  // --- Final summary ---
  const warnings = allTimeline.filter(t => t.eventType === 'warning');
  if (warnings.length > 0) {
    allTimeline.push({
      id: uuid(),
      eventType: 'completed_with_warnings',
      description: `Investigation completed with ${warnings.length} warning(s). Some API providers may not be configured. Check your environment variables.`,
      metadata: { warningCount: warnings.length },
      timestamp: timestampNow(),
    });
  }

  callbacks.onProgress('completed', 'Investigation complete.', 100);
  const elapsed = Date.now() - pipelineStart;
  console.log(`[Pipeline] === END investigation === ${elapsed}ms, ${allEvidence.length} evidence, ${candidates.length} candidates, confidence=${baseInvestigation.confidence}`);

  return { investigation: baseInvestigation, aiAssessment };
}
