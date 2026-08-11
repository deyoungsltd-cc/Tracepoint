// ============================================================
// TRACEPOINT — Real Investigation Pipeline (Enhanced)
// Uses server-side proxy routes for all API calls.
// API keys never leave the browser... wait, they never leave the server.
//
// Pipeline stages:
//   1. Phone Validation (NumVerify)
//   2. Twilio Enrichment
//   3. Web Search (Serper)
//   4. Social Profile Scraper (new)
//   5. Messaging OSINT (WhatsApp/Telegram/Signal) (new)
//   6. Identity Correlation
//   7. Confidence Calculation
//   8. AI Assessment (OpenAI GPT-4o)
//   9. Finalize & Sanity Cap
// ============================================================

import type { Investigation, EvidenceItem, IdentityCandidate, TimelineEvent, AIAssessment } from '@/lib/types';
import { analyzeIdentity } from '@/lib/api/openai';
import { lookupTwilio } from '@/lib/api/twilio';
import type { TwilioLookupResult } from '@/lib/api/twilio';
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
    const res = await fetch(`/api/numverify?phone=${encodeURIComponent(phone)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function proxySerperSearch(query: string): Promise<Array<{ title: string; link: string; snippet: string }>> {
  try {
    const res = await fetch('/api/serper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.organic || []).map((item: Record<string, unknown>) => ({
      title: String(item.title || ''),
      link: String(item.link || ''),
      snippet: String(item.snippet || ''),
    }));
  } catch { return []; }
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

// Stage 2: Twilio Enrichment (rich phone data via server proxy) — cached
async function stageTwilioEnrichment(
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

  const result: TwilioLookupResult | null = await withCache(
    cacheKey('twilio', config.phoneNormalized),
    () => lookupTwilio(config.phoneNormalized!),
    TTL.TWILIO_LOOKUP
  );

  // Graceful skip — Twilio not configured or request failed
  if (!result) {
    timeline.push({
      id: uuid(),
      eventType: 'twilio_skipped',
      description: 'Twilio enrichment skipped — service unavailable or not configured',
      metadata: null,
      timestamp: timestampNow(),
    });
    return { evidence, timeline, country, fallbackCandidateName, callerName };
  }

  // --- Caller Name ---
  if (result.caller_name?.caller_name) {
    const name = result.caller_name.caller_name;
    callerName = name;
    timeline.push({
      id: uuid(),
      eventType: 'twilio_caller_name',
      description: `Caller name retrieved: ${name}`,
      metadata: { firstName: result.caller_name.first_name, lastName: result.caller_name.last_name },
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
      excerpt: `Caller Name: ${name}${result.caller_name.first_name ? ` (First: ${result.caller_name.first_name}, Last: ${result.caller_name.last_name})` : ''}`,
      reliabilityScore: 85,
      relevanceScore: 80,
      freshnessScore: 99,
      verificationStatus: 'possible',
    });

    // If no web candidates were found, use the caller name for the fallback candidate
    if (!hasWebCandidates && !fallbackCandidateName) {
      fallbackCandidateName = name;
    }
  }

  // --- Carrier Info ---
  if (result.carrier) {
    const { name, type, mobile_country_code, mobile_network_code } = result.carrier;
    timeline.push({
      id: uuid(),
      eventType: 'twilio_carrier',
      description: `Carrier identified: ${name || 'Unknown'} (${type || 'Unknown type'})`,
      metadata: { name, type, mcc: mobile_country_code, mnc: mobile_network_code },
      timestamp: timestampNow(),
    });
    evidence.push({
      id: uuid(),
      claim: `Phone ${config.phoneNormalized} is carried by ${name || 'an unknown provider'} (${type || 'unknown type'}, MCC: ${mobile_country_code || 'N/A'}, MNC: ${mobile_network_code || 'N/A'})`,
      sourceName: 'Twilio Carrier Lookup',
      sourceType: 'phone_validation',
      sourceUrl: null,
      discoveredAt: timestampNow(),
      publishedAt: null,
      excerpt: `Carrier: ${name || 'N/A'}, Type: ${type || 'N/A'}, MCC: ${mobile_country_code || 'N/A'}, MNC: ${mobile_network_code || 'N/A'}`,
      reliabilityScore: 90,
      relevanceScore: 70,
      freshnessScore: 99,
      verificationStatus: 'verified',
    });
  }

  // --- Line Type Intelligence ---
  if (result.line_type_intelligence) {
    const { type, mobile_country_code, mobile_network_code, carrier_name } = result.line_type_intelligence;
    timeline.push({
      id: uuid(),
      eventType: 'twilio_line_type',
      description: `Line type: ${type || 'Unknown'}`,
      metadata: { type, mcc: mobile_country_code, mnc: mobile_network_code, carrierName: carrier_name },
      timestamp: timestampNow(),
    });
    evidence.push({
      id: uuid(),
      claim: `Line type intelligence for ${config.phoneNormalized}: ${type || 'unknown'}${carrier_name ? ` via ${carrier_name}` : ''}`,
      sourceName: 'Twilio Line Type Intelligence',
      sourceType: 'phone_validation',
      sourceUrl: null,
      discoveredAt: timestampNow(),
      publishedAt: null,
      excerpt: `Line Type: ${type || 'N/A'}, Carrier: ${carrier_name || 'N/A'}, MCC: ${mobile_country_code || 'N/A'}, MNC: ${mobile_network_code || 'N/A'}`,
      reliabilityScore: 90,
      relevanceScore: 75,
      freshnessScore: 99,
      verificationStatus: 'verified',
    });
  }

  // --- Call Forwarding Status ---
  if (result.call_forwarding) {
    const enabled = result.call_forwarding.enabled;
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

  // --- Update country from Twilio MCC if we don't have one ---
  const mcc = result.carrier?.mobile_country_code || result.line_type_intelligence?.mobile_country_code;
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

// Stage 6: Correlate candidates from search results
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
  const allEvidence: EvidenceItem[] = [];
  const allTimeline: TimelineEvent[] = [];
  let country = config.country || '';

  callbacks.onProgress('initializing', 'Initializing investigation...', 3);
  allTimeline.push({ id: uuid(), eventType: 'started', description: 'Investigation initiated', metadata: { phone: config.phone, email: config.email, depth: config.depth }, timestamp: now });

  // --- Stage 1: Phone Validation (cached) ---
  callbacks.onProgress('validation', 'Validating phone number...', 8);
  const phoneResult = await stagePhoneValidation(config);
  allEvidence.push(...phoneResult.evidence);
  allTimeline.push(...phoneResult.timeline);
  if (phoneResult.country) country = phoneResult.country;

  // --- Stage 2: Twilio Enrichment (cached) ---
  callbacks.onProgress('enrichment', 'Enriching phone data via Twilio...', 18);
  const twilioResult = await stageTwilioEnrichment(config, country, false, null);
  allEvidence.push(...twilioResult.evidence);
  allTimeline.push(...twilioResult.timeline);
  if (twilioResult.country) country = twilioResult.country;
  const twilioCallerName = twilioResult.callerName;

  // --- Stage 3: Web Search (cached) ---
  callbacks.onProgress('discovery', 'Searching public sources...', 30);
  const searchResult = await stageWebSearch(config, country);
  allEvidence.push(...searchResult.evidence);
  allTimeline.push(...searchResult.timeline);

  // --- Stage 4: Social Profile Scraper (NEW) ---
  callbacks.onProgress('social_scraping', 'Scanning social profiles...', 45);
  const socialResult = await stageSocialScraper(searchResult.searchResults, config);
  allEvidence.push(...socialResult.evidence);
  allTimeline.push(...socialResult.timeline);

  // --- Stage 5: Messaging OSINT (NEW, deep only) ---
  callbacks.onProgress('messaging_check', 'Checking messaging platforms...', 52);
  const messagingResult = await stageMessagingOSINT(config);
  allEvidence.push(...messagingResult.evidence);
  allTimeline.push(...messagingResult.timeline);

  // --- Stage 6: Identity Correlation ---
  callbacks.onProgress('correlating', 'Correlating identities...', 62);
  const { candidates, updatedEvidence } = stageCorrelation(allEvidence, phoneResult.phoneInfo, config);

  // Apply Twilio caller name to candidates that have no name yet
  if (twilioCallerName) {
    for (const c of candidates) {
      if (!c.name) c.name = twilioCallerName;
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

  // --- Stage 7: Confidence Calculation ---
  callbacks.onProgress('confidence', 'Calculating confidence scores...', 72);
  const phoneEvCount = allEvidence.filter(e => e.sourceType === 'phone_validation').length;
  const socialEvCount = allEvidence.filter(e => e.sourceType === 'social_profile').length;
  const messagingEvCount = allEvidence.filter(e => e.sourceType === 'messaging_osint').length;
  const overallConfidence = candidates.length > 0
    ? clampScore(
        candidates[0].confidence * 0.7 +
        Math.min((candidates[0].evidence?.length || 0) * 4, 20) +
        (phoneEvCount > 0 ? 8 : 0) +
        (socialEvCount > 0 ? 5 : 0) +
        (messagingEvCount > 0 ? 3 : 0)
      )
    : 0;

  // --- Stage 8: AI Assessment (cached) ---
  callbacks.onProgress('ai_analysis', 'Running AI analysis...', 85);
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
    summary: `Investigation completed for ${config.phone || config.email || 'unknown identifier'}. ${candidates.length} identity candidate${candidates.length !== 1 ? 's' : ''} found. ${socialResult.profiles.length} social profile${socialResult.profiles.length !== 1 ? 's' : ''} scanned. ${messagingResult.results.length} messaging platform${messagingResult.results.length !== 1 ? 's' : ''} checked.`,
    identityCount: candidates.length,
    evidenceCount: allEvidence.length,
    sourceCount: new Set(allEvidence.map(e => e.sourceName)).size,
    confidence: overallConfidence,
    hasConflicts: allEvidence.some(e => e.verificationStatus === 'conflicting'),
    locationStatus: 'unavailable',
    isDemoData: false,
    startedAt: now,
    completedAt: timestampNow(),
    createdAt: now,
    updatedAt: timestampNow(),
    candidates,
    evidence: updatedEvidence,
    locations: [],
    timeline: allTimeline,
  };

  const { aiAssessment, timeline: aiTimeline } = await stageAIAnalysis(baseInvestigation);
  allTimeline.push(...aiTimeline);
  baseInvestigation.timeline = allTimeline;

  // --- Stage 9: Finalize ---
  callbacks.onProgress('completing', 'Generating report...', 93);

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

  // --- Extract geolocation from NumVerify for globe pins ---
  if (phoneResult.phoneInfo && phoneResult.phoneInfo.valid) {
    const lat = parseFloat(phoneResult.phoneInfo.latitude as string);
    const lng = parseFloat(phoneResult.phoneInfo.longitude as string);
    if (!isNaN(lat) && !isNaN(lng)) {
      baseInvestigation.locations.push({
        id: `numverify-${id}`,
        deviceId: null,
        provider: 'NumVerify Geolocation',
        status: 'last_known',
        latitude: lat,
        longitude: lng,
        accuracy: null,
        address: String(phoneResult.phoneInfo.location || phoneResult.phoneInfo.country_name || ''),
        timestamp: timestampNow(),
        freshness: 'recent',
        deviceStatus: null,
        batteryLevel: null,
        networkType: null,
      });
      baseInvestigation.locationStatus = 'last_known';
    }
  }

  callbacks.onProgress('completed', 'Investigation complete.', 100);

  return { investigation: baseInvestigation, aiAssessment };
}
