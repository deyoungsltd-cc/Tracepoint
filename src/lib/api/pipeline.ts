// ============================================================
// TRACEPOINT — Real Investigation Pipeline
// Replaces the fake demo pipeline with real API calls
// ============================================================

import type { Investigation, EvidenceItem, IdentityCandidate, DeviceLocation, TimelineEvent, AIAssessment } from '@/lib/types';
import { validatePhone } from '@/lib/api/numverify';
import { webSearch } from '@/lib/api/serper';
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

function evidenceFreshness(publishedAt: string | null | undefined): number {
  if (!publishedAt) return 50;
  const days = (Date.now() - new Date(publishedAt).getTime()) / 86400000;
  if (days <= 7) return 95;
  if (days <= 30) return 85;
  if (days <= 90) return 70;
  if (days <= 365) return 55;
  return 35;
}

function timestampNow(): string {
  return new Date().toISOString();
}

function uuid(): string {
  return crypto.randomUUID();
}

export interface PipelineConfig {
  phone?: string;
  phoneNormalized?: string;
  email?: string;
  country?: string;
  depth: 'quick' | 'standard' | 'deep';
  numverifyKey?: string;
  serperKey?: string;
  openAiKey?: string;
}

export interface PipelineCallbacks {
  onProgress: (stage: string, message: string, progress: number) => void;
}

// Stage 1: Validate phone via NumVerify
async function stagePhoneValidation(config: PipelineConfig): Promise<{
  phoneInfo: any;
  evidence: EvidenceItem[];
  timeline: TimelineEvent[];
  country: string;
}> {
  const evidence: EvidenceItem[] = [];
  const timeline: TimelineEvent[] = [];
  let phoneInfo: any = null;
  let country = config.country || '';

  if (config.phoneNormalized && config.numverifyKey) {
    try {
      phoneInfo = await validatePhone(config.phoneNormalized, config.numverifyKey);
      if (phoneInfo && phoneInfo.valid) {
        country = phoneInfo.country_code || country;
        timeline.push({
          id: uuid(),
          eventType: 'phone_validated',
          description: `Phone validated: ${phoneInfo.line_type || 'Unknown type'}, ${phoneInfo.carrier || 'Unknown carrier'}, ${phoneInfo.country_name || ''}`,
          metadata: { valid: true, country: phoneInfo.country_code, carrier: phoneInfo.carrier, lineType: phoneInfo.line_type },
          timestamp: timestampNow(),
        });
        evidence.push({
          id: uuid(),
          claim: `Phone number ${phoneInfo.international_format} is a valid ${phoneInfo.line_type || 'phone'} number registered in ${phoneInfo.country_name || 'unknown'}${phoneInfo.carrier ? ` via ${phoneInfo.carrier}` : ''}`,
          sourceName: 'NumVerify Phone Validation',
          sourceType: 'phone_validation',
          sourceUrl: null,
          discoveredAt: timestampNow(),
          publishedAt: null,
          excerpt: `Country: ${phoneInfo.country_name}, Location: ${phoneInfo.location || 'N/A'}, Carrier: ${phoneInfo.carrier || 'N/A'}, Line: ${phoneInfo.line_type || 'N/A'}`,
          reliabilityScore: 95,
          relevanceScore: 90,
          freshnessScore: 99,
          verificationStatus: 'verified',
        });
      } else {
        timeline.push({
          id: uuid(),
          eventType: 'phone_invalid',
          description: `Phone number could not be validated: ${phoneInfo?.error?.info || 'unknown reason'}`,
          metadata: { valid: false },
          timestamp: timestampNow(),
        });
      }
    } catch (e) {
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

// Stage 2: Web search via Serper.dev
async function stageWebSearch(config: PipelineConfig, country: string): Promise<{
  searchResults: Array<{ title: string; link: string; snippet: string }>;
  evidence: EvidenceItem[];
  timeline: TimelineEvent[];
}> {
  const evidence: EvidenceItem[] = [];
  const timeline: TimelineEvent[] = [];
  let searchResults: Array<{ title: string; link: string; snippet: string }> = [];

  if (!config.serperKey) {
    return { searchResults, evidence, timeline };
  }

  // Build search queries based on available identifiers
  const queries: string[] = [];
  if (config.phoneNormalized) {
    queries.push(`"${config.phoneNormalized}"`);
  }
  if (config.email) {
    queries.push(`"${config.email}"`);
  }
  if (config.phoneNormalized && country) {
    queries.push(`${config.phoneNormalized.replace(/[^0-9+]/g, '')} site:linkedin.com OR site:facebook.com OR site:twitter.com`);
  }

  // Depth determines number of queries
  const maxQueries = config.depth === 'quick' ? 1 : config.depth === 'standard' ? 2 : queries.length;

  for (let i = 0; i < Math.min(maxQueries, queries.length); i++) {
    try {
      const results = await webSearch(queries[i], config.serperKey, config.depth === 'deep' ? 10 : 5);
      searchResults.push(...results);
      timeline.push({
        id: uuid(),
        eventType: 'web_search',
        description: `Search "${queries[i].substring(0, 60)}..." returned ${results.length} results`,
        metadata: { query: queries[i], count: results.length },
        timestamp: timestampNow(),
      });
    } catch (e) {
      // Continue to next query
    }
  }

  // Convert search results to evidence
  for (const result of searchResults) {
    const relScore = clampScore(
      50 + (config.email && result.snippet.toLowerCase().includes(config.email.toLowerCase()) ? 30 : 0) +
      (config.phoneNormalized && result.snippet.toLowerCase().includes(config.phoneNormalized.replace(/[^0-9]/g, '')) ? 25 : 0)
    );

    evidence.push({
      id: uuid(),
      claim: result.title,
      sourceName: new URL(result.link).hostname.replace('www.', ''),
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
  phoneInfo: any,
  config: PipelineConfig
): { candidates: IdentityCandidate[]; updatedEvidence: EvidenceItem[] } {
  const candidates: IdentityCandidate[] = [];
  const candidateMap = new Map<string, IdentityCandidate>();

  // Group evidence by potential identity signals
  for (const ev of evidence) {
    if (ev.sourceType === 'phone_validation') continue;

    // Try to extract a name or identity from the evidence
    let identityKey = '';
    let name: string | null = null;

    // Check if the source URL or title suggests a person
    const url = ev.sourceUrl || '';
    const title = ev.claim || '';
    const snippet = ev.excerpt || '';

    // Simple heuristics for identity extraction
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

      const candidate: IdentityCandidate = {
        id: uuid(),
        rank: candidateMap.size + 1,
        name,
        phone: config.phoneNormalized,
        email: config.email || null,
        business: null,
        website: url.startsWith('http') ? url : null,
        location: phoneInfo?.location || null,
        photoUrl: null,
        confidence: matchFields.length > 0 ? 60 : 30,
        verifiedStatus: matchFields.length >= 2 ? 'possible' : 'unverified',
        matchFields,
        evidence: [],
      };
      candidateMap.set(identityKey, candidate);
    }

    // Link evidence to candidate
    const candidate = candidateMap.get(identityKey)!;
    ev.candidateId = candidate.id;
    candidate.evidence.push(ev);
  }

  // If no candidates from search, create one from phone validation
  if (candidateMap.size === 0 && phoneInfo && phoneInfo.valid) {
    const candidate: IdentityCandidate = {
      id: uuid(),
      rank: 1,
      name: config.email ? config.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null,
      phone: phoneInfo.international_format,
      email: config.email || null,
      business: null,
      website: null,
      location: phoneInfo.location || `${phoneInfo.country_name || ''}`,
      photoUrl: null,
      confidence: 25,
      verifiedStatus: 'unverified',
      matchFields: ['phone'],
      evidence: [],
    };
    candidates.push(candidate);
  } else {
    // Sort candidates by evidence count and confidence
    const sorted = Array.from(candidateMap.values()).sort((a, b) => {
      const aScore = a.confidence * 0.4 + a.evidence.length * 15;
      const bScore = b.confidence * 0.4 + b.evidence.length * 15;
      return bScore - aScore;
    });
    sorted.forEach((c, i) => { c.rank = i + 1; });
    candidates.push(...sorted);
  }

  return { candidates, updatedEvidence: evidence };
}

// Stage 4: AI analysis via OpenAI
async function stageAIAnalysis(
  investigation: Investigation,
 config: PipelineConfig
): Promise<{ aiAssessment: AIAssessment | null; timeline: TimelineEvent[] }> {
  const timeline: TimelineEvent[] = [];

  if (!config.openAiKey) {
    timeline.push({
      id: uuid(),
      eventType: 'ai_skipped',
      description: 'OpenAI API key not configured — skipping AI assessment',
      metadata: null,
      timestamp: timestampNow(),
    });
    return { aiAssessment: null, timeline };
  }

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
  } catch (e) {
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

  // Re-calculate confidence for candidates based on evidence strength
  for (const candidate of candidates) {
    const candidateEvidence = allEvidence.filter(e => e.candidateId === candidate.id);
    if (candidateEvidence.length > 0) {
      const avgReliability = candidateEvidence.reduce((sum, e) => sum + e.reliabilityScore, 0) / candidateEvidence.length;
      const avgRelevance = candidateEvidence.reduce((sum, e) => sum + e.relevanceScore, 0) / candidateEvidence.length;
      candidate.confidence = clampScore(avgReliability * 0.4 + avgRelevance * 0.4 + Math.min(candidateEvidence.length * 8, 20));
      candidate.verifiedStatus = candidate.confidence >= 80 ? 'verified' : candidate.confidence >= 50 ? 'possible' : 'unverified';
    }
  }

  // --- Stage 4: Confidence Calculation ---
  callbacks.onProgress('confidence', 'Calculating confidence scores...', 70);
  const overallConfidence = candidates.length > 0
    ? clampScore(candidates[0].confidence + (candidates[0].evidence?.length || allEvidence.filter(e => e.candidateId === candidates[0].id).length) * 3)
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
    inputCity: phoneResult.phoneInfo?.location || null,
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

  const { aiAssessment, timeline: aiTimeline } = await stageAIAnalysis(baseInvestigation, config);
  allTimeline.push(...aiTimeline);
  baseInvestigation.timeline = allTimeline;

  // --- Stage 6: Finalize ---
  callbacks.onProgress('completing', 'Generating report...', 95);

  if (aiAssessment) {
    baseInvestigation.confidence = aiAssessment.confidence.score;
    baseInvestigation.summary = aiAssessment.conclusion;
  }

  callbacks.onProgress('completed', 'Investigation complete.', 100);

  return { investigation: baseInvestigation, aiAssessment };
}
