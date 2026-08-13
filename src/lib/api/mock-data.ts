// ============================================================
// TRACEPOINT — Mock Data Generator
// Generates realistic simulated data when API keys are not configured.
// All responses are tagged with X-Mock: true header.
// Data is deterministically generated from the input phone/email
// so the same query always produces the same mock results.
// ============================================================

// Simple hash for deterministic generation
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function pickN<T>(arr: T[], seed: number, count: number): T[] {
  const result: T[] = [];
  const used = new Set<number>();
  for (let i = 0; i < Math.min(count, arr.length); i++) {
    let idx = (seed + i * 7) % arr.length;
    while (used.has(idx)) idx = (idx + 1) % arr.length;
    used.add(idx);
    result.push(arr[idx]);
  }
  return result;
}

// --- Mock Data Pools ---

const carriers = [
  'AT&T Mobility', 'Verizon Wireless', 'T-Mobile US', 'Sprint Corporation',
  'Comcast Mobile', 'US Cellular', 'Cingular Wireless', 'MetroPCS',
  'Cricket Wireless', 'Boost Mobile', 'Google Fi', 'Mint Mobile',
];

const locations = [
  'New York, New York', 'Los Angeles, California', 'Chicago, Illinois',
  'Houston, Texas', 'Phoenix, Arizona', 'San Francisco, California',
  'Seattle, Washington', 'Denver, Colorado', 'Miami, Florida',
  'Atlanta, Georgia', 'Boston, Massachusetts', 'Dallas, Texas',
];

const countries: Array<{ name: string; code: string; code2: string }> = [
  { name: 'United States', code: 'US', code2: '+1' },
  { name: 'United Kingdom', code: 'GB', code2: '+44' },
  { name: 'Nigeria', code: 'NG', code2: '+234' },
  { name: 'Germany', code: 'DE', code2: '+49' },
  { name: 'France', code: 'FR', code2: '+33' },
  { name: 'India', code: 'IN', code2: '+91' },
  { name: 'Brazil', code: 'BR', code2: '+55' },
  { name: 'Japan', code: 'JP', code2: '+81' },
  { name: 'Canada', code: 'CA', code2: '+1' },
  { name: 'Australia', code: 'AU', code2: '+61' },
];

const lineTypes = ['mobile', 'mobile', 'mobile', 'landline', 'voip'];

const firstNames = [
  'James', 'Michael', 'David', 'Robert', 'William', 'Richard', 'Joseph', 'Thomas',
  'Sarah', 'Emily', 'Jessica', 'Amanda', 'Jennifer', 'Elizabeth', 'Ashley', 'Stephanie',
  'Daniel', 'Christopher', 'Matthew', 'Anthony', 'Mark', 'Steven', 'Andrew', 'Paul',
  'Maria', 'Chen', 'Raj', 'Yuki', 'Hans', 'Olga', 'Ahmed', 'Fatima',
];

const lastNames = [
  'Anderson', 'Martinez', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Wilson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Thompson', 'White', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker',
  'Chen', 'Singh', 'Tanaka', 'Mueller', 'Petrov', 'Nakamura', 'Okonkwo', 'Al-Rashid',
];

const cities = [
  'San Francisco, CA', 'New York, NY', 'London, UK', 'Lagos, Nigeria',
  'Berlin, Germany', 'Mumbai, India', 'Toronto, Canada', 'Sydney, Australia',
  'Dubai, UAE', 'Singapore', 'Tokyo, Japan', 'Paris, France',
];

const businesses = [
  'Apex Solutions LLC', 'Nexus Digital Group', 'Vertex Consulting', 'Pinnacle Technologies',
  'Meridian Holdings', 'Atlas Ventures', 'Horizon Innovations', 'Sterling Analytics',
  'Cobalt Partners', 'Ember Digital', 'Prime Strategies Inc.', 'Vanguard Enterprises',
];

const socialPlatforms = [
  'LinkedIn', 'Twitter', 'Facebook', 'Instagram', 'Telegram',
];

const searchSnippets = [
  'Professional profile found with extensive work history in technology and consulting.',
  'Public directory listing with contact information and business affiliation.',
  'Social media presence with regular activity and professional connections.',
  'Mentioned in a business context alongside company affiliations.',
  'Forum post discussing industry trends and professional expertise.',
  'Published article or blog post related to their field of work.',
  'Conference speaker profile with biography and area of expertise.',
  'Professional networking site listing with recommendations.',
  'Company website team page with role and responsibilities.',
  'Industry publication mentioning professional achievements.',
];

// --- Phone validation from digits ---

function detectCountry(phone: string): typeof countries[0] {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('44')) return countries[1]; // UK
  if (digits.startsWith('234')) return countries[2]; // Nigeria
  if (digits.startsWith('49')) return countries[3]; // Germany
  if (digits.startsWith('33')) return countries[4]; // France
  if (digits.startsWith('91')) return countries[5]; // India
  if (digits.startsWith('55')) return countries[6]; // Brazil
  if (digits.startsWith('81')) return countries[7]; // Japan
  if (digits.startsWith('61')) return countries[9]; // Australia
  return countries[0]; // US default
}

// ============================================================
// MOCK API RESPONSE GENERATORS
// ============================================================

export interface MockNumVerifyResult {
  valid: boolean;
  number: string;
  local_format: string;
  international_format: string;
  country_prefix: string;
  country_code: string;
  country_name: string;
  region_name: string;
  city_name: string;
  latitude: string;
  longitude: string;
  location: string;
  carrier: string;
  line_type: string;
}

export function generateMockNumVerify(phone: string): MockNumVerifyResult {
  const h = hashCode(phone);
  const country = detectCountry(phone);
  const digits = phone.replace(/\D/g, '');
  const location = pick(locations, h);
  const [city, state] = location.split(', ');
  const lat = (37.0 + (h % 1200) / 100).toFixed(4);
  const lng = (-95.0 + (h % 800) / 100).toFixed(4);

  return {
    valid: true,
    number: digits,
    local_format: digits.length > 10 ? digits.slice(-10) : digits,
    international_format: `${country.code2} ${digits.replace(/^\+?\d{1,3}/, '')}`,
    country_prefix: country.code2,
    country_code: country.code,
    country_name: country.name,
    region_name: state || country.name,
    city_name: city || 'Unknown',
    latitude: lat,
    longitude: lng,
    location: location,
    carrier: pick(carriers, h),
    line_type: pick(lineTypes, h),
  };
}

export interface MockAbstractPhoneResult {
  phone_number: string;
  valid: boolean;
  type: string;
  carrier: string;
  country: { code: string; name: string; prefix: string };
  location: string;
  connected: boolean;
  roaming: boolean;
  caller_name: string | null;
  risk_score: number;
  format?: { international: string; local: string; national: string; rfc3966: string; e164: string };
}

export function generateMockAbstractPhone(phone: string): MockAbstractPhoneResult {
  const h = hashCode(phone);
  const country = detectCountry(phone);
  const name = `${pick(firstNames, h)} ${pick(lastNames, h + 3)}`;
  const type = pick(lineTypes, h);
  const digits = phone.replace(/\D/g, '');

  return {
    phone_number: phone,
    valid: true,
    type,
    carrier: pick(carriers, h + 1),
    country: { code: country.code, name: country.name, prefix: country.code2 },
    location: pick(locations, h + 2),
    connected: h % 10 > 2,
    roaming: h % 10 > 7,
    caller_name: h % 3 !== 0 ? name : null,
    risk_score: pick([12, 25, 35, 48, 15, 22, 8, 42], h),
    format: {
      international: `${country.code2} ${digits.replace(/^\+?\d{1,3}/, '')}`,
      local: digits.length > 10 ? digits.slice(-10) : digits,
      national: digits.length > 10 ? digits.slice(-10) : digits,
      rfc3966: `tel:+${digits}`,
      e164: `+${digits}`,
    },
  };
}

export interface MockSerperResult {
  organic: Array<{
    title: string;
    link: string;
    snippet: string;
    position: number;
  }>;
}

export function generateMockSerperResults(query: string): MockSerperResult {
  const h = hashCode(query);
  const count = 4 + (h % 5); // 4-8 results
  const hasPhone = /\d{7,}/.test(query);
  const hasEmail = /@/.test(query);
  const firstName = pick(firstNames, h);
  const lastName = pick(lastNames, h + 1);
  const fullName = `${firstName} ${lastName}`;
  const city = pick(cities, h + 2);
  const business = pick(businesses, h + 3);

  const templates: Array<{ title: string; link: string; snippet: string }> = [
    {
      title: `${fullName} - Professional Profile`,
      link: `https://www.linkedin.com/in/${firstName.toLowerCase()}${lastName.toLowerCase()}${h % 99}`,
      snippet: `View ${fullName}'s professional profile on LinkedIn. ${pick(searchSnippets, h)} Located in ${city}.`,
    },
    {
      title: `${fullName} | ${business}`,
      link: `https://twitter.com/${firstName.toLowerCase()}${lastName.toLowerCase()}${h % 99}`,
      snippet: `${fullName} - ${pick(['CEO', 'CTO', 'Director', 'Senior Consultant', 'Founder'], h)} at ${business}. ${pick(searchSnippets, h + 1)}`,
    },
    {
      title: `${business} - Team Leadership`,
      link: `https://${business.toLowerCase().replace(/[^a-z]/g, '')}.com/team`,
      snippet: `Meet our leadership team. ${fullName} serves as ${pick(['Head of Operations', 'VP of Technology', 'Managing Director'], h + 2)} at ${business} in ${city}.`,
    },
    {
      title: `${fullName} - Speaker Profile`,
      link: `https://sessionize.com/speaker/${firstName.toLowerCase()}${lastName.toLowerCase()}`,
      snippet: `${fullName} is a frequent speaker at industry events. Topics include ${pick(['digital transformation', 'cybersecurity', 'data analytics', 'cloud infrastructure'], h + 4)}.`,
    },
    {
      title: `Public Records: ${fullName}`,
      link: `https://www.spokeo.com/${firstName.toLowerCase()}-${lastName.toLowerCase()}/${(h % 99999) + 10000}`,
      snippet: `Public listing for ${fullName}. ${pick(searchSnippets, h + 5)} Phone and address records available.`,
    },
    {
      title: `${fullName} - GitHub`,
      link: `https://github.com/${firstName.toLowerCase()}${lastName.toLowerCase()}${h % 99}`,
      snippet: `${fullName} has ${10 + (h % 90)} repositories. Primary languages: TypeScript, Python. ${pick(searchSnippets, h + 6)}`,
    },
    {
      title: `${fullName} - ResearchGate Profile`,
      link: `https://www.researchgate.net/profile/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${h % 99}`,
      snippet: `Academic profile of ${fullName}. ${2 + (h % 20)} publications in ${pick(['computer science', 'data science', 'information systems'], h + 7)}.`,
    },
    {
      title: `Contact Information: ${lastName}, ${firstName} - Directory`,
      link: `https://www.whitepages.com/name/${firstName}-${lastName}/${city.replace(/,.*$/, '').replace(/\s/g, '-')}`,
      snippet: `Directory listing for ${fullName} in ${city}. ${pick(searchSnippets, h + 8)}`,
    },
  ];

  const selected = pickN(templates, h, count);

  // If the query contains a phone, add phone-specific results
  if (hasPhone) {
    selected.push({
      title: `Phone number found: ${query.replace(/[^0-9+]/g, '')}`,
      link: `https://www.truecaller.com/search/${query.replace(/[^0-9+]/g, '')}`,
      snippet: `Phone number ${query.replace(/[^0-9+]/g, '')} listed under ${fullName}. ${pick(searchSnippets, h + 9)}`,
    });
  }

  // If email is in query, add email-specific results
  if (hasEmail) {
    selected.push({
      title: `Email contact: ${query.match(/\S+@\S+/)?.[0] || query}`,
      link: `https://www.411.com/email/${query.match(/\S+@\S+/)?.[0] || ''}`,
      snippet: `Email address associated with ${fullName} in ${city}. ${pick(searchSnippets, h + 10)}`,
    });
  }

  return {
    organic: selected.slice(0, count).map((item, i) => ({
      ...item,
      position: i + 1,
    })),
  };
}

export interface MockAIResult {
  content: string;
}

export function generateMockAIAssessment(data: {
  phone: string;
  email: string;
  candidates: Array<{ name: string | null; confidence: number; evidence: unknown[] }>;
  evidence: Array<{ claim: string; sourceType: string; reliabilityScore: number }>;
  country: string;
}): string {
  const candidate = data.candidates[0];
  const name = candidate?.name || 'the target identifier';
  const evCount = data.evidence.length;
  const phoneEvCount = data.evidence.filter(e => e.sourceType === 'phone_validation').length;
  const socialEvCount = data.evidence.filter(e => e.sourceType === 'social_profile').length;
  const webEvCount = data.evidence.filter(e => e.sourceType === 'web_search').length;

  const confidenceScore = Math.min(55 + (evCount * 3) + (socialEvCount * 8) + (webEvCount * 2), 85);
  const confidenceLevel = confidenceScore >= 70 ? 'MODERATE' : 'LOW';

  const lines: string[] = [];

  lines.push(`## Investigation Summary`);
  lines.push('');
  lines.push(`Investigation of ${name} yielded ${evCount} pieces of evidence across ${phoneEvCount} phone validation, ${webEvCount} web search, and ${socialEvCount} social profile sources.`);
  lines.push('');

  if (phoneEvCount > 0) {
    lines.push(`### Phone Intelligence`);
    lines.push(`The phone number ${data.phone} was validated and determined to be an active number. Carrier and location data were successfully retrieved.`);
    lines.push('');
  }

  if (webEvCount > 0) {
    lines.push(`### Web Presence`);
    lines.push(`${name} has a measurable web footprint with ${webEvCount} results found across search engines. This includes professional profiles, directory listings, and public mentions.`);
    lines.push('');
  }

  if (socialEvCount > 0) {
    lines.push(`### Social Media Activity`);
    lines.push(`${socialEvCount} social platform profile(s) were identified. This suggests an active digital presence.`);
    lines.push('');
  }

  lines.push(`### Confidence Assessment`);
  lines.push(`**Level: ${confidenceLevel} (${confidenceScore}%)**`);
  lines.push('');
  lines.push(`The investigation established a ${confidenceLevel.toLowerCase()} confidence level. ${confidenceLevel === 'MODERATE'
    ? 'Multiple corroborating sources link the identity to the provided identifiers, though full verification requires additional documentation.'
    : 'While some data points were collected, the evidence is insufficient for high-confidence identity attribution. More sources would strengthen this assessment.'
  }`);
  lines.push('');

  lines.push(`### Key Findings`);
  lines.push(`- Phone number is valid and registered`);
  if (webEvCount > 0) lines.push(`- Web presence detected across multiple platforms`);
  if (socialEvCount > 0) lines.push(`- Social media profiles identified`);
  lines.push(`- No adverse public records identified in search results`);
  lines.push('');

  lines.push(`### Recommendations`);
  lines.push(`1. Cross-reference the identified name against government or financial databases for stronger verification`);
  lines.push(`2. If available, obtain additional contact identifiers (alternate phone numbers, physical address) for deeper investigation`);
  lines.push(`3. Consider a deep-scan investigation for more comprehensive OSINT analysis`);
  lines.push(`4. Review social media profiles for behavioral patterns and network connections`);

  return lines.join('\n');
}
