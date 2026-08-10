// ============================================================
// TRACEPOINT — Global Identity & Authorized Device Intelligence Platform
// TypeScript Type Definitions
// ============================================================

// --- Enums & Constants ---

export type VerificationStatus =
  | 'verified'
  | 'strongly_corroborated'
  | 'possible'
  | 'unverified'
  | 'conflicting'
  | 'unavailable';

export type LocationStatus = 'live' | 'last_known' | 'historical' | 'unavailable';

export type LocationFreshness = 'live' | 'recent' | 'today' | 'old' | 'stale';

export type InvestigationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'archived';

export type InvestigationDepth = 'quick' | 'standard' | 'deep';

export type SourceCategory =
  | 'official_website'
  | 'business_directory'
  | 'social_profile'
  | 'news'
  | 'registry'
  | 'government_record'
  | 'professional_profile'
  | 'user_provided'
  | 'device_provider'
  | 'web_search';

export type UserRole = 'admin' | 'pro' | 'standard';

export type ViewMode = 'globe' | 'map2d' | 'list' | 'evidence';

export type AppView =
  | 'dashboard'
  | 'investigation'
  | 'investigation-detail'
  | 'history'
  | 'devices'
  | 'admin'
  | 'settings'
  | 'reports'
  | 'login'
  | 'register';

export type ErrorType =
  | 'NO_RESULTS'
  | 'INSUFFICIENT_EVIDENCE'
  | 'CONFLICTING_SOURCES'
  | 'PROVIDER_UNAVAILABLE'
  | 'LOCATION_UNAVAILABLE'
  | 'AUTHORIZATION_REQUIRED'
  | 'RATE_LIMITED'
  | 'SOURCE_BLOCKED'
  | 'INVALID_IDENTIFIER'
  | 'TEMPORARY_FAILURE';

export type ProviderHealth = 'healthy' | 'degraded' | 'down' | 'unknown';

// --- Core Interfaces ---

export interface SearchQuery {
  phone?: string;
  phoneNormalized?: string;
  email?: string;
  name?: string;
  business?: string;
  country?: string;
  state?: string;
  city?: string;
  region?: string;
  depth: InvestigationDepth;
}

export interface EvidenceItem {
  id: string;
  claim: string;
  sourceUrl: string | null;
  sourceName: string;
  sourceType: SourceCategory;
  discoveredAt: string;
  publishedAt: string | null;
  excerpt: string | null;
  reliabilityScore: number;
  relevanceScore: number;
  freshnessScore: number;
  verificationStatus: VerificationStatus;
  candidateId?: string;
}

export interface IdentityCandidate {
  id: string;
  rank: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  business: string | null;
  website: string | null;
  location: string | null;
  photoUrl: string | null;
  confidence: number;
  verifiedStatus: VerificationStatus;
  matchFields: string[];
  evidence: EvidenceItem[];
}

export interface DeviceLocation {
  id: string;
  deviceId: string | null;
  provider: string;
  status: LocationStatus;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  address: string | null;
  timestamp: string | null;
  freshness: LocationFreshness;
  deviceStatus: string | null;
  batteryLevel: number | null;
  networkType: string | null;
}

export interface TimelineEvent {
  id: string;
  eventType: string;
  description: string;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

export interface Investigation {
  id: string;
  status: InvestigationStatus;
  depth: InvestigationDepth;
  isBatch: boolean;
  batchId: string | null;
  inputPhone: string | null;
  inputPhoneNormalized: string | null;
  inputEmail: string | null;
  inputName: string | null;
  inputBusiness: string | null;
  inputRegion: string | null;
  inputCountry: string | null;
  inputState: string | null;
  inputCity: string | null;
  summary: string | null;
  identityCount: number;
  evidenceCount: number;
  sourceCount: number;
  confidence: number | null;
  hasConflicts: boolean;
  locationStatus: LocationStatus;
  isDemoData: boolean;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  candidates: IdentityCandidate[];
  evidence: EvidenceItem[];
  locations: DeviceLocation[];
  timeline: TimelineEvent[];
}

export interface InvestigationProgress {
  stage: string;
  progress: number;
  message: string;
 timestamp: string;
}

export interface ConfidenceAssessment {
  score: number;
  level: 'HIGH' | 'MODERATE' | 'LOW' | 'INSUFFICIENT';
  supportingEvidence: string[];
  conflictingEvidence: string[];
  explanation: string;
  lastVerified: string;
}

export interface AIAssessment {
  summary: string;
  conclusion: string;
  confidence: ConfidenceAssessment;
  recommendations: string[];
  missingEvidence: string[];
}

export interface ProviderStatus {
  name: string;
  category: string;
  isEnabled: boolean;
  health: ProviderHealth;
  lastChecked: string | null;
  latencyMs: number | null;
}

export interface SecurityEvent {
  id: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string | null;
  ip: string | null;
  resolved: boolean;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  resource: string | null;
  details: string | null;
  userId: string | null;
  createdAt: string;
}

export interface DeviceAuthorization {
  id: string;
  provider: string;
  deviceId: string | null;
  deviceName: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
}

export interface FeatureFlag {
  key: string;
  isEnabled: boolean;
  config: Record<string, unknown> | null;
}

export interface GlobeMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  type: 'identity' | 'business' | 'device' | 'source';
  confidence?: number;
  investigationId?: string;
}

export interface GlobeArc {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color?: string;
  animated?: boolean;
}

// --- Auth ---

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  mfaEnabled: boolean;
  emailVerified: boolean;
  isDemo: boolean;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// --- Settings ---

export interface AppSettings {
  aiProvider: 'openai' | 'anthropic' | 'local' | 'custom';
  aiApiKey: string;
  aiModel: string;
  serperApiKey: string;
  numverifyApiKey: string;
  mapboxToken: string;
  demoMode: boolean;
 batchMaxSize: number;
 historicalLocationCount: number;
  locationFreshnessThresholds: {
    live: number;
    recent: number;
    today: number;
    old: number;
  };
}
