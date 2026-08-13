// ============================================================
// TRACEPOINT — Social Media Profile Scraper
// Scrapes social profiles found during web search using Serper.
// Server-side only — called from pipeline.
// ============================================================

interface ScrapedProfile {
  platform: string;
  url: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  profilePhoto: string | null;
  verified: boolean;
  followers: number | null;
  following: number | null;
  posts: number | null;
  joined: string | null;
  rawSnippet: string;
}

/**
 * Scrape a social profile page via Serper (Google cache/snippet extraction).
 * We don't do direct scraping (CORS, rate limits, legal issues).
 * Instead we use Serper's rich results which include structured data for known platforms.
 */
export async function scrapeSocialProfile(url: string): Promise<ScrapedProfile | null> {
  try {
    // Determine platform from URL
    const platform = detectPlatform(url);
    if (!platform) return null;

    // Use Serper to get structured data about this specific URL
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(`${origin}/api/serper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `site:${url}`, num: 1 }),
    });
    if (!res.ok) return null;
    
    const data = await res.json();
    const organic = (data.organic || [])[0];
    if (!organic) return null;

    // Extract knowledge graph if available (Google's structured data)
    const kg = data.knowledgeGraph || null;

    const profile: ScrapedProfile = {
      platform,
      url,
      name: kg?.name || organic.title?.replace(/ - .+$/, '') || null,
      bio: kg?.description || organic.snippet || null,
      location: kg?.subtitle || null,
      profilePhoto: kg?.image || null,
      verified: false,
      followers: null,
      following: null,
      posts: null,
      joined: null,
      rawSnippet: organic.snippet || '',
    };

    // Try to extract follower counts from snippet
    const followerMatch = (profile.rawSnippet).match(/(\d[\d,.]*)\s*(followers|subscribers|connections)/i);
    if (followerMatch) {
      profile.followers = parseInt(followerMatch[1].replace(/,/g, ''), 10);
    }

    // LinkedIn-specific: extract headline from snippet
    if (platform === 'linkedin') {
      const titleParts = organic.title?.split(' | ') || [];
      if (titleParts.length > 1) {
        profile.bio = titleParts.slice(1).join(' | ');
      }
    }

    return profile;
  } catch {
    return null;
  }
}

/**
 * Batch scrape multiple social URLs found during investigation.
 * Runs in parallel with concurrency limit.
 */
export async function scrapeSocialProfiles(
  urls: string[],
  concurrency = 3
): Promise<ScrapedProfile[]> {
  const results: ScrapedProfile[] = [];

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(url => scrapeSocialProfile(url))
    );
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }
  }

  return results;
}

/**
 * From a list of search results, extract social profile URLs.
 */
export function extractSocialUrls(
  results: Array<{ title: string; link: string; snippet: string }>
): string[] {
  const socialDomains = [
    'linkedin.com', 'twitter.com', 'x.com', 'facebook.com',
    'instagram.com', 'github.com', 'reddit.com', 'tiktok.com',
    'youtube.com', 'pinterest.com', 'threads.net',
  ];

  const seen = new Set<string>();
  const urls: string[] = [];

  for (const r of results) {
    try {
      const url = new URL(r.link);
      const isSocial = socialDomains.some(d => url.hostname === d || url.hostname.endsWith('.' + d));
      if (isSocial && !seen.has(r.link)) {
        seen.add(r.link);
        urls.push(r.link);
      }
    } catch {
      // skip invalid URLs
    }
  }

  return urls;
}

function detectPlatform(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    const map: Record<string, string> = {
      'linkedin.com': 'LinkedIn',
      'twitter.com': 'Twitter/X',
      'x.com': 'Twitter/X',
      'facebook.com': 'Facebook',
      'instagram.com': 'Instagram',
      'github.com': 'GitHub',
      'reddit.com': 'Reddit',
      'tiktok.com': 'TikTok',
      'youtube.com': 'YouTube',
      'pinterest.com': 'Pinterest',
      'threads.net': 'Threads',
    };
    for (const [domain, name] of Object.entries(map)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) return name;
    }
  } catch { /* ignore */ }
  return null;
}

export type { ScrapedProfile };
