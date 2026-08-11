// ============================================================
// TRACEPOINT — Client-side OpenAI Integration (via /api/ai proxy)
// All calls go through the server-side proxy to keep the API key
// out of the browser and avoid OpenAI's browser-request block.
// ============================================================

import type { Investigation, AIAssessment, IdentityCandidate, EvidenceItem } from '@/lib/types';

// --- Internal helpers ---

interface ProxyResponse {
  content?: string;
  error?: string;
}

/**
 * Call the server-side /api/ai proxy and return the text content,
 * or null on any failure. Never throws.
 */
async function callAI(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model?: string
): Promise<string | null> {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model }),
    });

    if (!res.ok) {
      console.error(`[OpenAI] Proxy returned ${res.status}`);
      return null;
    }

    const data: ProxyResponse = await res.json();

    if (data.error) {
      console.error('[OpenAI] Proxy error:', data.error);
      return null;
    }

    return data.content ?? null;
  } catch (err) {
    console.error('[OpenAI] Proxy request failed:', err);
    return null;
  }
}

/**
 * Safely parse a JSON string that may be wrapped in markdown code fences.
 */
function safeJsonParse<T>(text: string): T | null {
  try {
    // Strip markdown code fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// --- Public API ---

interface AnalyzeIdentityParams {
  phone?: string;
  email?: string;
  candidates: IdentityCandidate[];
  evidence: EvidenceItem[];
  country?: string;
}

interface AnalyzeIdentitySettings {
  model?: string;
}

interface RawAIConfidence {
  score: number;
  level: 'HIGH' | 'MODERATE' | 'LOW' | 'INSUFFICIENT';
  explanation: string;
  supportingEvidence: string[];
  conflictingEvidence: string[];
}

interface RawAIResult {
  summary: string;
  conclusion: string;
  confidence: RawAIConfidence;
  recommendations: string[];
  missingEvidence: string[];
}

/**
 * Analyze identity intelligence data using GPT-4o via the server proxy.
 * Returns a structured AIAssessment or null on failure.
 */
export async function analyzeIdentity(
  data: AnalyzeIdentityParams,
  settings: AnalyzeIdentitySettings = {}
): Promise<AIAssessment | null> {
  const model = settings.model || 'gpt-4o';

  // Build a concise evidence summary for the prompt
  const evidenceSummary = data.evidence
    .slice(0, 30) // cap to avoid token limits
    .map(
      (e, i) =>
        `${i + 1}. [${e.verificationStatus}] "${e.claim}" — ${e.sourceName} (reliability: ${e.reliabilityScore}, relevance: ${e.relevanceScore})`
    )
    .join('\n');

  const candidatesSummary = data.candidates
    .map(
      (c) =>
        `- Rank ${c.rank}: ${c.name || 'Unknown'} | Phone: ${c.phone || 'N/A'} | Email: ${c.email || 'N/A'} | Business: ${c.business || 'N/A'} | Confidence: ${c.confidence}% | Match fields: ${c.matchFields.join(', ')}`
    )
    .join('\n');

  const systemPrompt = `You are TRACEPOINT's senior identity intelligence analyst AI. Your role is to analyze identity investigation data — collected from public, open-source intelligence (OSINT) — and produce a structured, objective assessment.

STRICT RULES:
- Be factual, objective, and conservative. Do not overstate certainty.
- Base all conclusions ONLY on the evidence provided. Do not hallucinate.
- If evidence is insufficient, say so clearly.
- You MUST respond with ONLY a valid JSON object (no markdown, no explanation outside the JSON). The JSON schema is:
{
  "summary": "<2-4 sentence narrative summary of findings>",
  "conclusion": "<clear conclusion: IDENTITY VERIFIED / PARTIALLY VERIFIED / INSUFFICIENT EVIDENCE with reasoning>",
  "confidence": {
    "score": <0-100 integer>,
    "level": "<HIGH | MODERATE | LOW | INSUFFICIENT>",
    "explanation": "<detailed explanation of the confidence score>",
    "supportingEvidence": ["<list of evidence descriptions that support the identity>"],
    "conflictingEvidence": ["<list of evidence descriptions that conflict or raise doubts>"]
  },
  "recommendations": ["<actionable next steps for the investigator>"],
  "missingEvidence": ["<types of evidence that would strengthen the analysis>"]
}

CONFIDENCE LEVELS:
- HIGH (80-100): Multiple independent, high-reliability sources (web profiles, directories, news) corroborate the same identity. Phone validation ALONE does NOT qualify.
- MODERATE (50-79): Some supporting evidence from multiple source types, but gaps or minor conflicts exist.
- LOW (20-49): Only phone validation or a single low-reliability source. This is the DEFAULT for phone-only lookups with no web results.
- INSUFFICIENT (0-19): Not enough evidence to make any determination.

CRITICAL: If the only evidence is phone number validation (e.g. NumVerify), the confidence MUST be LOW (20-49 range). Phone validation only confirms the number is registered to a carrier — it does NOT verify any identity. An 82%+ score requires at least 2-3 independent corroborating sources such as social profiles, business directories, or public records that link a specific person to the phone number.`;

  const userPrompt = `Analyze the following identity investigation data:

## Input Identifiers
- Phone: ${data.phone || 'Not provided'}
- Email: ${data.email || 'Not provided'}
- Country: ${data.country || 'Not provided'}

## Identity Candidates (${data.candidates.length} found)
${candidatesSummary || 'No candidates identified.'}

## Evidence (${data.evidence.length} items)
${evidenceSummary || 'No evidence collected.'}

Provide your structured assessment as a JSON object.`;

  const raw = await callAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    model
  );

  if (!raw) return null;

  const parsed = safeJsonParse<RawAIResult>(raw);
  if (!parsed) {
    console.warn('[OpenAI] Failed to parse AI response as JSON');
    return null;
  }

  return {
    summary: parsed.summary || '',
    conclusion: parsed.conclusion || '',
    confidence: {
      score: typeof parsed.confidence?.score === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.confidence.score))) : 0,
      level: ['HIGH', 'MODERATE', 'LOW', 'INSUFFICIENT'].includes(parsed.confidence?.level)
        ? (parsed.confidence.level as AIAssessment['confidence']['level'])
        : 'INSUFFICIENT',
      explanation: parsed.confidence?.explanation || '',
      supportingEvidence: Array.isArray(parsed.confidence?.supportingEvidence)
        ? parsed.confidence.supportingEvidence
        : [],
      conflictingEvidence: Array.isArray(parsed.confidence?.conflictingEvidence)
        ? parsed.confidence.conflictingEvidence
        : [],
      lastVerified: new Date().toISOString(),
    },
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations
      : [],
    missingEvidence: Array.isArray(parsed.missingEvidence)
      ? parsed.missingEvidence
      : [],
  };
}

/**
 * Generate a narrative investigation report summary from a completed investigation.
 * Returns a string summary or null on failure.
 */
export async function generateInvestigationReport(
  investigation: Investigation
): Promise<string | null> {
  const candidatesText = investigation.candidates
    .map(
      (c) =>
        `  - ${c.name || 'Unknown'} (Rank ${c.rank}, Confidence: ${c.confidence}%, Status: ${c.verifiedStatus})`
    )
    .join('\n');

  const topEvidence = investigation.evidence
    .slice(0, 10)
    .map(
      (e) =>
        `  - [${e.verificationStatus}] ${e.claim} — ${e.sourceName}
    (Reliability: ${e.reliabilityScore}%, Relevance: ${e.relevanceScore}%)`
    )
    .join('\n');

  const systemPrompt = `You are TRACEPOINT's intelligence report writer. Given an investigation summary, produce a clear, professional, 2-4 paragraph narrative report suitable for an analyst's case file. Be factual and concise. Do not include the JSON or data structures — just the narrative.`;

  const userPrompt = `Write an investigation report narrative for the following completed investigation:

## Investigation: ${investigation.id}
- Status: ${investigation.status}
- Depth: ${investigation.depth}
- Input: Phone=${investigation.inputPhone || 'N/A'}, Email=${investigation.inputEmail || 'N/A'}, Name=${investigation.inputName || 'N/A'}, Business=${investigation.inputBusiness || 'N/A'}
- Country: ${investigation.inputCountry || 'N/A'}
- Candidates: ${investigation.identityCount}
- Evidence Items: ${investigation.evidenceCount}
- Sources: ${investigation.sourceCount}
- Overall Confidence: ${investigation.confidence ?? 'N/A'}%
- Conflicts Detected: ${investigation.hasConflicts ? 'Yes' : 'No'}

## Top Candidates
${candidatesText || '  None identified.'}

## Key Evidence
${topEvidence || '  No evidence available.'}

## Existing Summary
${investigation.summary || 'No summary available.'}

Produce the report narrative now.`;

  const result = await callAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  return result;
}
