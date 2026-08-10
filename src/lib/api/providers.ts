// ============================================================
// TRACEPOINT — Real API Integration Providers
// External intelligence gathering via NumVerify, Serper, OpenAI
// ============================================================

import type { EvidenceItem } from '@/lib/types';

// --- Local Types ---

export interface PhoneValidationResult {
  valid: boolean;
  country: string;
  country_code: string;
  carrier: string;
  line_type: string;
  location: string;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  date: string | null;
}

// --- NumVerify: Phone Validation & Carrier Lookup ---

export async function validatePhone(
  phone: string,
  apiKey: string,
): Promise<PhoneValidationResult | null> {
  if (!apiKey || !apiKey.trim()) return null;
  if (!phone || !phone.trim()) return null;

  try {
    const params = new URLSearchParams({
      access_key: apiKey,
      number: phone,
      format: '1',
    });

    const res = await fetch(
      `http://apilayer.net/api/validate?${params.toString()}`,
      { signal: AbortSignal.timeout(15_000) },
    );

    if (!res.ok) return null;

    const data = await res.json();

    return {
      valid: Boolean(data.valid),
      country: String(data.country_name ?? data.country ?? ''),
      country_code: String(data.country_code ?? ''),
      carrier: String(data.carrier ?? ''),
      line_type: String(data.line_type ?? ''),
      location: String(data.location ?? ''),
    };
  } catch {
    return null;
  }
}

// --- Serper.dev: Web Search for Public Source Discovery ---

export async function webSearch(
  query: string,
  apiKey: string,
  numResults: number = 10,
): Promise<SearchResult[]> {
  if (!apiKey || !apiKey.trim()) return [];
  if (!query || !query.trim()) return [];

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({ q: query, num: numResults }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const organic: unknown[] = Array.isArray(data.organic) ? data.organic : [];

    return organic.map((item: unknown) => {
      const r = item as Record<string, unknown>;
      return {
        title: String(r.title ?? ''),
        link: String(r.link ?? ''),
        snippet: String(r.snippet ?? ''),
        date: r.date != null ? String(r.date) : null,
      };
    });
  } catch {
    return [];
  }
}

// --- OpenAI: AI Assessment ---

const SYSTEM_PROMPT = `\
You are an evidence-first investigation assistant for the Tracepoint intelligence platform. Your role is to analyze provided investigation data and deliver a structured, rigorous assessment.

CRITICAL RULES:
1. NEVER fabricate, hallucinate, or invent sources, URLs, names, phone numbers, emails, or any data not present in the input.
2. Always explain your confidence level for every claim you make, referencing specific evidence from the input.
3. If the evidence is too thin to support any conclusion, respond with exactly: "INSUFFICIENT EVIDENCE" followed by a brief explanation of what is missing.
4. Categorize evidence reliability: official/verified sources are high reliability, public listings are moderate, web search results are low-moderate, and unverified claims are low.
5. Highlight any conflicts or contradictions between sources.
6. Suggest specific follow-up actions that could strengthen the investigation.
7. Be concise but thorough. Use structured formatting (headers, bullet points) for readability.`;

export async function getAIAssessment(
  investigationData: string,
  apiKey: string,
  model: string = 'gpt-4o',
): Promise<string | null> {
  if (!apiKey || !apiKey.trim()) return null;
  if (!investigationData || !investigationData.trim()) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: investigationData },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const content: unknown = data?.choices?.[0]?.message?.content;

    return typeof content === 'string' && content.length > 0 ? content : null;
  } catch {
    return null;
  }
}

// --- Orchestrator: Search Public Sources (Phone + Email) ---

export async function searchPublicSources(
  phone: string | null,
  email: string | null,
  apiKeys: { numverify?: string; serper?: string },
): Promise<EvidenceItem[]> {
  const items: EvidenceItem[] = [];
  const now = new Date().toISOString();

  // 1. Validate phone via NumVerify
  if (phone && apiKeys.numverify) {
    const phoneResult = await validatePhone(phone, apiKeys.numverify);
    if (phoneResult) {
      const parts: string[] = [];
      if (phoneResult.valid) {
        parts.push(`Phone number ${phone} is a valid ${phoneResult.line_type || 'unknown type'} number`);
        if (phoneResult.carrier) parts.push(`carried by ${phoneResult.carrier}`);
        if (phoneResult.country) parts.push(`in ${phoneResult.country} (${phoneResult.country_code})`);
        if (phoneResult.location) parts.push(`located in ${phoneResult.location}`);
      } else {
        parts.push(`Phone number ${phone} is invalid or not in service`);
      }

      items.push({
        id: crypto.randomUUID(),
        claim: parts.join(' '),
        sourceUrl: 'https://numverify.com',
        sourceName: 'NumVerify',
        sourceType: 'registry',
        discoveredAt: now,
        publishedAt: now,
        excerpt: JSON.stringify(phoneResult),
        reliabilityScore: 0.85,
        relevanceScore: 0.9,
        freshnessScore: 0.95,
        verificationStatus: phoneResult.valid ? 'verified' : 'unverified',
      });
    }
  }

  // 2. Build search query and run web search via Serper
  if (apiKeys.serper) {
    const queryParts: string[] = [];
    if (phone) queryParts.push(`"${phone}"`);
    if (email) queryParts.push(`"${email}"`);

    if (queryParts.length > 0) {
      const searchQuery = queryParts.join(' OR ');
      const results = await webSearch(searchQuery, apiKeys.serper, 10);

      for (const result of results) {
        items.push({
          id: crypto.randomUUID(),
          claim: result.title,
          sourceUrl: result.link || null,
          sourceName: extractDomain(result.link),
          sourceType: 'web_search',
          discoveredAt: now,
          publishedAt: result.date || null,
          excerpt: result.snippet || null,
          reliabilityScore: 0.3,
          relevanceScore: 0.5,
          freshnessScore: result.date ? computeFreshness(result.date) : 0.4,
          verificationStatus: 'unverified',
        });
      }
    }
  }

  return items;
}

// --- Helpers ---

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url || 'unknown';
  }
}

function computeFreshness(dateStr: string): number {
  try {
    const date = new Date(dateStr);
    const now = Date.now();
    const ageMs = now - date.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays <= 1) return 0.95;
    if (ageDays <= 7) return 0.85;
    if (ageDays <= 30) return 0.7;
    if (ageDays <= 90) return 0.5;
    if (ageDays <= 365) return 0.3;
    return 0.15;
  } catch {
    return 0.4;
  }
}
