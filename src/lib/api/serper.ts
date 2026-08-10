// ============================================================
// TRACEPOINT — Serper.dev Web Search API Integration
// ============================================================

export interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

/**
 * Perform a web search using the Serper.dev Google Search API.
 * Returns an empty array on any error.
 */
export async function webSearch(
  query: string,
  apiKey: string,
  num: number = 10
): Promise<SerperResult[]> {
  if (!query || !apiKey) return [];

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({ q: query, num }),
    });

    if (!response.ok) {
      console.error(
        `[Serper] API returned status ${response.status}: ${response.statusText}`
      );
      return [];
    }

    const data = await response.json();

    if (!data.organic || !Array.isArray(data.organic)) {
      console.warn('[Serper] No organic results in response');
      return [];
    }

    return data.organic.map(
      (item: Record<string, unknown>, index: number): SerperResult => ({
        title: String(item.title || ''),
        link: String(item.link || ''),
        snippet: String(item.snippet || ''),
        position: typeof item.position === 'number' ? item.position : index + 1,
      })
    );
  } catch (err) {
    console.error('[Serper] Request failed:', err);
    return [];
  }
}
