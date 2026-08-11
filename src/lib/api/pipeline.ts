// ============================================================
// TRACEPOINT — Real Investigation Pipeline
// Uses server-side proxy routes for all API calls.
// API keys never reach the browser.
// ============================================================

import type { Investigation, EvidenceItem, IdentityCandidate, TimelineEvent, AIAssessment } from '@/lib/types';
import { analyzeIdentity } from '@/lib/api/openai';

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
    social_profile: 45,
    web_search: 50,
    phone_validation: 95,
    public_record: 88,
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
    return (data.organic || []).map((item: Record<string, unknown>, i: number) => ({
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

// Stage 1: Validate phone via NumVerify (server proxy)
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
    const result = await proxyNumVerify(config.phoneNormalized);
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
        description: `Phone number could not be validated`,
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

// Stage 2: Web search via Serper.dev (server proxy)
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

  const maxQueries = config.depth === 'quick' ? 1 : config.depth === 'standard' ? 2 : queries.length;

  for (let i = 0; i < Math.min(maxQueries, queries.length); i++) {
    const results = await proxySerperSearch(queries[i]);
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

// Stage 3: Correlate candidates from search results
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

    const nameMatch = title.match(/^([A-Z][a-z]+ [A-Z][a-z]+)/);
    if (nameMatch) {
      name = nameMatch[1];
      identityKey = name.toLowerCase();
    } else if (ev.sourceName && !['google', 'bing', 'yahoo'].includes(ev.sourceName)) {
      identityKey = ev.sourceName;
    }

    if (!identityKey) continue;

    if (!candidateMap.has(identityKey)) {
      const matchFields: string[] = [];
      if (config.phoneNormalized && snippet.includes(config.phoneNormalized.replace(/[^0-9]/g, ''))) matchFields.push('phone');
      if (config.email && snippet.toLowerCase().includes(config.email.toLowerCase())) matchFields.push('email');

      candidateMap.set(identityKey, {
        id: uuid(),
        rank: candidateMap.size + 1,
        name,
        phone: config.phoneNormalized,
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

      // Link phone validation evidence to this candidate
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

// Stage 4: AI analysis via OpenAI (already proxied)
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

    const assessment = await analyzeIdentity(
      {
        phone: investigation.inputPhoneNormalized || '',
        email: investigation.inputEmail || '',
        candidates: investigation.candidates,
        evidence: investigation.evidence,
        country: investigation.inputCountry || '',
      },
      { model: 'gpt-4o' }
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

  callbacks.onProgress('initializing', 'Initializing investigation...', 5);
  allTimeline.push({ id: uuid(), eventType: 'started', description: 'Investigation initiated', metadata: { phone: config.phone, email: config.email, depth: config.depth }, timestamp: now });

  // --- Stage 1: Phone Validation ---
  callbacks.onProgress('validation', 'Validating phone number...', 15);
  const phoneResult = await stagePhoneValidation(config);
  allEvidence.push(...phoneResult.evidence);
  allTimeline.push(...phoneResult.timeline);
  if (phoneResult.country) country = phoneResult.country;

  // --- Stage 2: Web Search ---
  callbacks.onProgress('discovery', 'Searching public sources...', 30);
  const searchResult = await stageWebSearch(config, country);
  allEvidence.push(...searchResult.evidence);
  allTimeline.push(...searchResult.timeline);

  // --- Stage 3: Identity Correlation ---
  callbacks.onProgress('correlating', 'Correlating identities...', 55);
  const { candidates, updatedEvidence } = stageCorrelation(allEvidence, phoneResult.phoneInfo, config);

  for (const candidate of candidates) {
    const candidateEvidence = allEvidence.filter(e => e.candidateId === candidate.id);
    const baseFromFields = candidate.matchFields.length * 15;
    if (candidateEvidence.length > 0) {
      const avgReliability = candidateEvidence.reduce((sum, e) => sum + e.reliabilityScore, 0) / candidateEvidence.length;
      const avgRelevance = candidateEvidence.reduce((sum, e) => sum + e.relevanceScore, 0) / candidateEvidence.length;
      candidate.confidence = clampScore(avgReliability * 0.4 + avgRelevance * 0.4 + Math.min(candidateEvidence.length * 8, 20) + baseFromFields);
    } else {
      // Even without linked evidence, boost from match fields
      candidate.confidence = clampScore(30 + baseFromFields);
    }
    candidate.verifiedStatus = candidate.confidence >= 80 ? 'verified' : candidate.confidence >= 50 ? 'possible' : 'unverified';
  }

  // --- Stage 4: Confidence Calculation ---
  callbacks.onProgress('confidence', 'Calculating confidence scores...', 70);
  // Include phone_validation evidence in source count
  const phoneEvCount = allEvidence.filter(e => e.sourceType === 'phone_validation').length;
  const overallConfidence = candidates.length > 0
    ? clampScore(
        candidates[0].confidence * 0.7 +
        Math.min((candidates[0].evidence?.length || 0) * 4, 20) +
        (phoneEvCount > 0 ? 10 : 0)
      )
    : 0;

  // --- Stage 5: AI Assessment ---
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
    summary: `Investigation completed for ${config.phone || config.email || 'unknown identifier'}. ${candidates.length} identity candidate${candidates.length !== 1 ? 's' : ''} found.`,
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

  // --- Stage 6: Finalize ---
  callbacks.onProgress('completing', 'Generating report...', 95);

  if (aiAssessment) {
    // Sanity cap: AI sometimes over-estimates confidence with minimal evidence.
    // If the only evidence source is phone_validation, cap confidence at 45.
    const nonPhoneEvidence = allEvidence.filter(e => e.sourceType !== 'phone_validation');
    const webEvidence = nonPhoneEvidence.filter(e => e.sourceType === 'web_search' && e.relevanceScore >= 60);
    let aiScore = aiAssessment.confidence.score;
    if (nonPhoneEvidence.length === 0 && webEvidence.length === 0) {
      // Only phone validation — cap at LOW range
      aiScore = Math.min(aiScore, 45);
      aiAssessment.confidence.level = 'LOW';
      aiAssessment.confidence.explanation = 'Only phone number validation was available. No web sources or public records linked a specific identity to this number. ' + (aiAssessment.confidence.explanation || '');
    } else if (webEvidence.length < 2) {
      // 0-1 relevant web results — cap at MODERATE
      aiScore = Math.min(aiScore, 65);
      if (aiAssessment.confidence.level === 'HIGH') {
        aiAssessment.confidence.level = 'MODERATE';
      }
    }
    baseInvestigation.confidence = aiScore;
    baseInvestigation.summary = aiAssessment.conclusion;
  }

  // --- Stage 7: Extract geolocation from NumVerify for globe pins ---
  // NumVerify returns latitude/longitude for validated numbers
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
