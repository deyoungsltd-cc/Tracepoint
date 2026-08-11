import { create } from 'zustand';
import type {
  AppView,
  ViewMode,
  Investigation,
  InvestigationProgress,
  User,
  AppSettings,
  ProviderStatus,
  SecurityEvent,
  AuditEvent,
  GlobeMarker,
  GlobeArc,
  DeviceAuthorization,
  FeatureFlag,
  AIAssessment,
} from '@/lib/types';
import { runRealInvestigation } from '@/lib/api/pipeline';
import { saveInvestigation } from '@/lib/supabase/data';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { saveToLocal, loadFromLocal, deleteFromLocal } from '@/lib/localStorage';

// --- Auth Store ---
interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  setDemoMode: () => void;
}

// --- Navigation Store ---
interface NavStore {
  currentView: AppView;
  selectedInvestigationId: string | null;
  sidebarOpen: boolean;
  viewMode: ViewMode;
  navigate: (view: AppView, investigationId?: string) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

// --- Investigation Store ---
interface InvestigationStore {
  investigations: Investigation[];
  currentInvestigation: Investigation | null;
  progress: InvestigationProgress | null;
  isRunning: boolean;
  aiAssessment: AIAssessment | null;
  startInvestigation: (query: Record<string, string>) => Promise<boolean>;
  startBatchInvestigation: (file: File) => Promise<void>;
  selectInvestigation: (id: string) => void;
  deleteInvestigation: (id: string) => void;
  clearCurrent: () => void;
  loadDemoInvestigation: () => void;
  loadPersistedInvestigations: () => void;
}

// --- Settings Store ---
interface SettingsStore {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  loadSettings: () => void;
}

// --- Admin Store ---
interface AdminStore {
  providers: ProviderStatus[];
  securityEvents: SecurityEvent[];
  auditEvents: AuditEvent[];
  deviceAuthorizations: DeviceAuthorization[];
  featureFlags: FeatureFlag[];
  loadAdminData: () => void;
}

// --- Globe Store ---
interface GlobeStore {
  markers: GlobeMarker[];
  arcs: GlobeArc[];
  focusedLocation: { lat: number; lng: number } | null;
  setMarkers: (markers: GlobeMarker[]) => void;
  addMarker: (marker: GlobeMarker) => void;
  clearMarkers: () => void;
  setArcs: (arcs: GlobeArc[]) => void;
  focusLocation: (lat: number, lng: number) => void;
  clearFocus: () => void;
  addInvestigationMarkers: (investigation: Investigation) => void;
}

// ============================================================
// AUTH STORE
// ============================================================

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (_email: string, _password: string) => {
    set({ isLoading: true });
    await new Promise((r) => setTimeout(r, 800));
    set({
      user: {
        id: 'demo-user-001',
        email: _email || 'analyst@tracepoint.io',
        displayName: 'Senior Analyst',
        role: 'admin',
        mfaEnabled: false,
        emailVerified: true,
        isDemo: true,
        createdAt: new Date().toISOString(),
      },
      isAuthenticated: true,
      isLoading: false,
    });
  },

  register: async (_email: string, _password: string, name: string) => {
    set({ isLoading: true });
    await new Promise((r) => setTimeout(r, 1000));
    set({
      user: {
        id: 'new-user-001',
        email: _email,
        displayName: name,
        role: 'standard',
        mfaEnabled: false,
        emailVerified: false,
        isDemo: false,
        createdAt: new Date().toISOString(),
      },
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: () => {
    set({ user: null, isAuthenticated: false });
  },

  setDemoMode: () => {
    set({
      user: {
        id: 'demo-user-001',
        email: 'demo@tracepoint.io',
        displayName: 'Demo Analyst',
        role: 'admin',
        mfaEnabled: false,
        emailVerified: true,
        isDemo: true,
        createdAt: new Date().toISOString(),
      },
      isAuthenticated: true,
    });
  },
}));

// ============================================================
// NAVIGATION STORE
// ============================================================

export const useNavStore = create<NavStore>((set) => ({
  currentView: 'login',
  selectedInvestigationId: null,
  sidebarOpen: true,
  viewMode: 'globe',

  navigate: (view, investigationId) => {
    set({ currentView: view, selectedInvestigationId: investigationId || null });
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));

// ============================================================
// INVESTIGATION STORE
// ============================================================

export const useInvestigationStore = create<InvestigationStore>((set, get) => ({
  investigations: [],
  currentInvestigation: null,
  progress: null,
  isRunning: false,
  aiAssessment: null,

  startInvestigation: async (query: Record<string, string>): Promise<boolean> => {
    set({ isRunning: true, progress: { stage: 'initializing', progress: 0, message: 'Initializing investigation...', timestamp: new Date().toISOString() } });
    try {
      const { investigation, aiAssessment } = await runRealInvestigation(
        {
          phone: query.phone || undefined,
          phoneNormalized: query.phoneNormalized || undefined,
          email: query.email || undefined,
          country: query.country || undefined,
          depth: (query.depth as 'quick' | 'standard' | 'deep') || 'standard',
        },
        { onProgress: (stage, message, progress) => { set({ progress: { stage, progress, message, timestamp: new Date().toISOString() } }); } },
      );
      // Persist to localStorage always, to Supabase if configured
      saveToLocal(investigation);
      if (isSupabaseConfigured() && !investigation.isDemoData) { saveInvestigation(investigation).catch(() => {}); }
      // Add markers to globe
      useGlobeStore.getState().addInvestigationMarkers(investigation);
      set((state) => ({ investigations: [investigation, ...state.investigations], currentInvestigation: investigation, isRunning: false, progress: { stage: 'completed', progress: 100, message: 'Investigation complete.', timestamp: new Date().toISOString() }, aiAssessment }));
      return true;
    } catch (err) {
      console.error('Investigation error:', err);
      set({ isRunning: false, progress: { stage: 'failed', progress: 0, message: 'Investigation failed. Try again.', timestamp: new Date().toISOString() } });
      return false;
    }
  },

  startBatchInvestigation: async (_file: File) => {
    set({ isRunning: true, progress: { stage: 'parsing', progress: 5, message: 'Parsing batch file...', timestamp: new Date().toISOString() } });
    await new Promise((r) => setTimeout(r, 2000));
    set({ progress: { stage: 'queued', progress: 10, message: '3 investigations queued for processing.', timestamp: new Date().toISOString() } });
    await new Promise((r) => setTimeout(r, 3000));
    set({ isRunning: false });
  },

  selectInvestigation: (id) => {
    const inv = get().investigations.find((i) => i.id === id);
    if (inv) {
      set({
        currentInvestigation: inv,
        aiAssessment: generateDemoAIAssessment(inv),
      });
    }
  },

  deleteInvestigation: (id) => {
    deleteFromLocal(id);
    set((state) => ({
      investigations: state.investigations.filter(i => i.id !== id),
      currentInvestigation: state.currentInvestigation?.id === id ? null : state.currentInvestigation,
    }));
  },

  clearCurrent: () => set({ currentInvestigation: null, progress: null, aiAssessment: null }),

  loadDemoInvestigation: () => {
    const now = new Date().toISOString();
    const demoInvestigation: Investigation = {
      id: `demo-${Date.now()}`,
      status: 'completed',
      depth: 'deep',
      isBatch: false,
      batchId: null,
      inputPhone: '+1 (555) 234-5678',
      inputPhoneNormalized: '+15552345678',
      inputEmail: 'j.doe@example.com',
      inputName: 'Jonathan Doe',
      inputBusiness: 'Doe Consulting Group',
      inputRegion: 'North America',
      inputCountry: 'US',
      inputState: 'California',
      inputCity: 'San Francisco',
      summary: 'Deep investigation completed. Two identity candidates identified. Primary candidate verified across 3 independent public sources with 94% confidence.',
      identityCount: 2,
      evidenceCount: 12,
      sourceCount: 7,
      confidence: 94,
      hasConflicts: false,
      locationStatus: 'last_known',
      isDemoData: true,
      startedAt: new Date(Date.now() - 120000).toISOString(),
      completedAt: now,
      createdAt: new Date(Date.now() - 125000).toISOString(),
      updatedAt: now,
      candidates: [],
      evidence: [],
      locations: [
        {
          id: 'loc-1',
          deviceId: 'iphone-15-pro',
          provider: 'apple_find_my',
          status: 'last_known',
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 65,
          address: 'Financial District, San Francisco, CA',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          freshness: 'recent',
          deviceStatus: 'offline',
          batteryLevel: 42,
          networkType: null,
        },
      ],
      timeline: [],
    };
    demoInvestigation.candidates = generateDemoCandidates(demoInvestigation.id);
    demoInvestigation.evidence = generateDemoEvidence(demoInvestigation.id);
    demoInvestigation.timeline = generateDemoTimeline(demoInvestigation.id);
    saveToLocal(demoInvestigation);
    useGlobeStore.getState().addInvestigationMarkers(demoInvestigation);
    set((state) => ({
      investigations: [demoInvestigation, ...state.investigations],
      currentInvestigation: demoInvestigation,
      aiAssessment: generateDemoAIAssessment(demoInvestigation),
    }));
  },

  loadPersistedInvestigations: () => {
    const local = loadFromLocal();
    if (local.length > 0) {
      set((state) => {
        const existing = new Set(state.investigations.map(i => i.id));
        const newInvs = local.filter(i => !existing.has(i.id));
        return { investigations: [...newInvs, ...state.investigations] };
      });
    }
  },
}));

// ============================================================
// SETTINGS STORE
// ============================================================

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: {
    aiProvider: 'openai' as const,
    aiApiKey: '',
    aiModel: 'gpt-4o',
    serperApiKey: '',
    numverifyApiKey: '',
    mapboxToken: '',
    demoMode: false,
    batchMaxSize: 10,
    historicalLocationCount: 5,
    locationFreshnessThresholds: {
      live: 5,
      recent: 60,
      today: 1440,
      old: 10080,
    },
  },
  updateSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
  loadSettings: () => {},
}));

// ============================================================
// ADMIN STORE
// ============================================================

export const useAdminStore = create<AdminStore>((set) => ({
  providers: [
    { name: 'OpenAI (AI)', category: 'ai', isEnabled: true, health: 'unknown', lastChecked: null, latencyMs: null },
    { name: 'Apple Find My', category: 'location', isEnabled: false, health: 'unknown', lastChecked: null, latencyMs: null },
    { name: 'Google Find My Device', category: 'location', isEnabled: false, health: 'unknown', lastChecked: null, latencyMs: null },
    { name: 'Samsung SmartThings', category: 'location', isEnabled: false, health: 'unknown', lastChecked: null, latencyMs: null },
    { name: 'Custom/BYO Provider', category: 'location', isEnabled: false, health: 'unknown', lastChecked: null, latencyMs: null },
    { name: 'NumVerify', category: 'intelligence', isEnabled: true, health: 'healthy', lastChecked: new Date().toISOString(), latencyMs: 120 },
    { name: 'Web Search (Serper)', category: 'intelligence', isEnabled: true, health: 'healthy', lastChecked: new Date().toISOString(), latencyMs: 320 },
    { name: 'Business Directory', category: 'intelligence', isEnabled: true, health: 'healthy', lastChecked: new Date().toISOString(), latencyMs: 180 },
  ],
  securityEvents: [
    { id: 'se-1', eventType: 'failed_login', severity: 'low', details: 'Failed login attempt from 192.168.1.45', ip: '192.168.1.45', resolved: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 'se-2', eventType: 'rate_limit', severity: 'medium', details: 'Rate limit exceeded for investigation API', ip: null, resolved: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
  ],
  auditEvents: [
    { id: 'ae-1', action: 'investigation.started', resource: 'inv-001', details: 'Deep investigation started for +15552345678', userId: 'demo-user-001', createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: 'ae-2', action: 'settings.updated', resource: 'settings', details: 'AI provider changed to OpenAI', userId: 'demo-user-001', createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: 'ae-3', action: 'investigation.completed', resource: 'inv-001', details: 'Investigation completed with 2 candidates', userId: 'demo-user-001', createdAt: new Date(Date.now() - 6000000).toISOString() },
  ],
  deviceAuthorizations: [],
  featureFlags: [
    { key: 'demo_mode', isEnabled: true, config: { label: 'DEMO DATA — NOT REAL' } },
    { key: 'batch_investigations', isEnabled: true, config: { maxSize: 10 } },
    { key: 'ai_assistant', isEnabled: true, config: null },
    { key: '3d_globe', isEnabled: true, config: { autoRotate: true } },
    { key: 'pdf_reports', isEnabled: true, config: null },
    { key: 'device_fingerprint', isEnabled: true, config: null },
  ],
  loadAdminData: () => {},
}));

// ============================================================
// GLOBE STORE
// ============================================================

export const useGlobeStore = create<GlobeStore>((set, get) => ({
  markers: [],
  arcs: [],
  focusedLocation: null,
  setMarkers: (markers) => set({ markers }),
  addMarker: (marker) => set((s) => ({ markers: [...s.markers, marker] })),
  clearMarkers: () => set({ markers: [], arcs: [] }),
  setArcs: (arcs) => set({ arcs }),
  focusLocation: (lat, lng) => set({ focusedLocation: { lat, lng } }),
  clearFocus: () => set({ focusedLocation: null }),

  addInvestigationMarkers: (investigation: Investigation) => {
    const newMarkers: GlobeMarker[] = [];
    const newArcs: GlobeArc[] = [];

    // Add candidate location markers
    for (const candidate of investigation.candidates) {
      if (candidate.location) {
        // Try to extract a rough lat/lng from location name
        const latlng = roughGeocode(candidate.location);
        if (latlng) {
          newMarkers.push({
            id: `cand-${candidate.id}`,
            lat: latlng.lat,
            lng: latlng.lng,
            label: candidate.name || candidate.location,
            type: 'identity',
            confidence: candidate.confidence,
            investigationId: investigation.id,
          });
        }
      }
    }

    // Add device location markers
    for (const loc of investigation.locations) {
      if (loc.latitude && loc.longitude) {
        newMarkers.push({
          id: `loc-${loc.id}`,
          lat: loc.latitude,
          lng: loc.longitude,
          label: loc.address || loc.provider,
          type: 'device',
          confidence: undefined,
          investigationId: investigation.id,
        });
      }
    }

    // Create arcs between markers
    if (newMarkers.length >= 2) {
      for (let i = 0; i < newMarkers.length - 1; i++) {
        newArcs.push({
          id: `arc-${investigation.id}-${i}`,
          startLat: newMarkers[i].lat,
          startLng: newMarkers[i].lng,
          endLat: newMarkers[i + 1].lat,
          endLng: newMarkers[i + 1].lng,
          color: '#c8a24e',
          animated: true,
        });
      }
    }

    if (newMarkers.length > 0) {
      set((s) => ({
        markers: [...newMarkers, ...s.markers],
        arcs: [...newArcs, ...s.arcs],
        focusedLocation: newMarkers[0] ? { lat: newMarkers[0].lat, lng: newMarkers[0].lng } : s.focusedLocation,
      }));
    }
  },
}));

// Rough geocoding from location strings — uses known city coordinates
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
    'new york': { lat: 43.2994, lng: -74.2179 },
    'florida': { lat: 27.6648, lng: -81.5158 },
  };

  const lower = location.toLowerCase();
  for (const [city, coords] of Object.entries(cities)) {
    if (lower.includes(city)) return coords;
  }
  return null;
}

// ============================================================
// DEMO DATA GENERATORS
// ============================================================

function generateDemoCandidates(investigationId: string) {
  return [
    {
      id: `cand-1-${investigationId}`,
      rank: 1,
      name: 'Jonathan Doe',
      phone: '+1 (555) 234-5678',
      email: 'j.doe@example.com',
      business: 'Doe Consulting Group',
      website: 'https://doeconsulting.example.com',
      location: 'San Francisco, CA',
      photoUrl: null,
      confidence: 94,
      verifiedStatus: 'verified' as const,
      matchFields: ['phone', 'email', 'business', 'location'],
      evidence: [],
    },
    {
      id: `cand-2-${investigationId}`,
      rank: 2,
      name: 'J. Doe',
      phone: '+1 (555) 234-5678',
      email: null,
      business: 'JD Enterprises',
      website: null,
      location: 'Los Angeles, CA',
      photoUrl: null,
      confidence: 41,
      verifiedStatus: 'possible' as const,
      matchFields: ['phone'],
      evidence: [],
    },
  ];
}

function generateDemoEvidence(investigationId: string) {
  return [
    {
      id: `ev-1-${investigationId}`,
      claim: 'Phone number +1 (555) 234-5678 is associated with Doe Consulting Group',
      sourceUrl: 'https://doeconsulting.example.com/contact',
      sourceName: 'Doe Consulting Group — Official Website',
      sourceType: 'official_website' as const,
      discoveredAt: new Date().toISOString(),
      publishedAt: '2026-01-15T00:00:00Z',
      excerpt: 'Contact us at +1 (555) 234-5678 or email j.doe@example.com',
      reliabilityScore: 95,
      relevanceScore: 98,
      freshnessScore: 85,
      verificationStatus: 'verified' as const,
      candidateId: `cand-1-${investigationId}`,
    },
    {
      id: `ev-2-${investigationId}`,
      claim: 'Jonathan Doe is listed as CEO of Doe Consulting Group',
      sourceUrl: 'https://businessdir.example.com/doe-consulting',
      sourceName: 'Pacific Business Directory',
      sourceType: 'business_directory' as const,
      discoveredAt: new Date().toISOString(),
      publishedAt: '2026-03-20T00:00:00Z',
      excerpt: 'Doe Consulting Group, CEO: Jonathan Doe, San Francisco, CA',
      reliabilityScore: 88,
      relevanceScore: 95,
      freshnessScore: 78,
      verificationStatus: 'verified' as const,
      candidateId: `cand-1-${investigationId}`,
    },
    {
      id: `ev-3-${investigationId}`,
      claim: 'Professional profile for Jonathan Doe matches phone and business',
      sourceUrl: 'https://linkedin.example.com/in/jondoe',
      sourceName: 'Professional Network Profile',
      sourceType: 'professional_profile' as const,
      discoveredAt: new Date().toISOString(),
      publishedAt: '2025-11-10T00:00:00Z',
      excerpt: 'Jonathan Doe — CEO at Doe Consulting Group — San Francisco Bay Area',
      reliabilityScore: 82,
      relevanceScore: 92,
      freshnessScore: 72,
      verificationStatus: 'corroborated' as const,
      candidateId: `cand-1-${investigationId}`,
    },
    {
      id: `ev-4-${investigationId}`,
      claim: 'Phone number +1 (555) 234-5678 also appears in a listing for JD Enterprises',
      sourceUrl: 'https://ladir.example.com/jd-enterprises',
      sourceName: 'LA Business Registry',
      sourceType: 'business_directory' as const,
      discoveredAt: new Date().toISOString(),
      publishedAt: '2026-06-01T00:00:00Z',
      excerpt: 'JD Enterprises, Contact: +1 (555) 234-5678, Los Angeles, CA',
      reliabilityScore: 75,
      relevanceScore: 70,
      freshnessScore: 65,
      verificationStatus: 'possible' as const,
      candidateId: `cand-2-${investigationId}`,
    },
    {
      id: `ev-5-${investigationId}`,
      claim: 'Doe Consulting Group registered at 100 Market Street, San Francisco, CA',
      sourceUrl: 'https://sos.ca.gov/business-search/doe-consulting',
      sourceName: 'California Secretary of State',
      sourceType: 'government_record' as const,
      discoveredAt: new Date().toISOString(),
      publishedAt: '2024-08-15T00:00:00Z',
      excerpt: 'Entity: Doe Consulting Group LLC, Agent: Jonathan Doe, Address: 100 Market St, SF, CA 94105',
      reliabilityScore: 98,
      relevanceScore: 88,
      freshnessScore: 55,
      verificationStatus: 'verified' as const,
      candidateId: `cand-1-${investigationId}`,
    },
  ];
}

function generateDemoTimeline(investigationId: string) {
  const base = Date.now() - 120000;
  return [
    { id: `tl-1-${investigationId}`, eventType: 'started', description: 'Investigation started', metadata: null, timestamp: new Date(base).toISOString() },
    { id: `tl-2-${investigationId}`, eventType: 'normalized', description: 'Phone normalized to E.164: +15552345678', metadata: null, timestamp: new Date(base + 5000).toISOString() },
    { id: `tl-3-${investigationId}`, eventType: 'discovery', description: '7 public sources discovered', metadata: { count: 7 }, timestamp: new Date(base + 15000).toISOString() },
    { id: `tl-4-${investigationId}`, eventType: 'candidates', description: '2 identity candidates created', metadata: { count: 2 }, timestamp: new Date(base + 45000).toISOString() },
    { id: `tl-5-${investigationId}`, eventType: 'corroboration', description: '3 sources corroborated candidate A (Jonathan Doe)', metadata: null, timestamp: new Date(base + 60000).toISOString() },
    { id: `tl-6-${investigationId}`, eventType: 'location', description: 'Location provider queried — last-known location retrieved', metadata: { provider: 'apple_find_my' }, timestamp: new Date(base + 80000).toISOString() },
    { id: `tl-7-${investigationId}`, eventType: 'completed', description: 'Investigation completed — 94% confidence for primary candidate', metadata: null, timestamp: new Date(base + 100000).toISOString() },
  ];
}

function generateDemoAIAssessment(inv: Investigation): AIAssessment {
  const primaryCandidate = inv.candidates[0];
  const evidenceCount = inv.evidence.filter((e) => e.candidateId === primaryCandidate?.id).length;
  const conflicting = inv.evidence.filter((e) => e.verificationStatus === 'conflicting');

  return {
    summary: `I found ${evidenceCount} public sources connecting the provided identifiers to ${primaryCandidate?.name || 'the primary candidate'}. ${evidenceCount >= 2 ? 'Multiple sources agree on the business association and professional identity.' : 'Limited corroborating sources available.'}`,
    conclusion: inv.confidence && inv.confidence >= 80
      ? `IDENTITY VERIFIED — ${inv.confidence}% confidence. ${evidenceCount} independent public sources corroborate the primary identity.`
      : inv.confidence && inv.confidence >= 50
        ? `IDENTITY PARTIALLY VERIFIED — ${inv.confidence}% confidence. Additional sources recommended.`
        : 'INSUFFICIENT EVIDENCE — NO IDENTITY ASSIGNED',
    confidence: {
      score: inv.confidence || 0,
      level: (inv.confidence && inv.confidence >= 80 ? 'HIGH' : inv.confidence && inv.confidence >= 50 ? 'MODERATE' : 'LOW') as AIAssessment['confidence']['level'],
      supportingEvidence: inv.evidence.filter((e) => e.verificationStatus === 'verified').map((e) => e.sourceName),
      conflictingEvidence: conflicting.map((e) => e.sourceName),
      explanation: `Confidence score derived from ${evidenceCount} evidence items across ${inv.sourceCount} independent sources. ${inv.hasConflicts ? 'Conflicting evidence was detected and factored into the score reduction.' : 'No conflicting evidence detected.'}`,
      lastVerified: new Date().toISOString(),
    },
    recommendations: inv.confidence && inv.confidence < 80
      ? ['Cross-reference with official government registry', 'Verify business registration directly', 'Check professional license databases']
      : ['Investigation findings are strong. Consider generating a formal report.'],
    missingEvidence: inv.confidence && inv.confidence < 90
      ? ['Official government ID verification', 'Financial regulatory records', 'Professional license confirmation']
      : [],
  };
}