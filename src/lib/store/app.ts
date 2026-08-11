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

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { isSupabaseConfigured, supabase } = await import('@/lib/supabase/client');
      if (!isSupabaseConfigured()) {
        set({ isLoading: false });
        throw new Error('Supabase is not configured. Please set your environment variables.');
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        const { getProfile } = await import('@/lib/supabase/data');
        const profile = await getProfile();
        set({
          user: {
            id: data.user.id,
            email: data.user.email || '',
            displayName: profile?.display_name || data.user.user_metadata?.full_name || null,
            role: (profile?.role || 'standard') as import('@/lib/types').UserRole,
            mfaEnabled: false,
            emailVerified: !!data.user.email_confirmed_at,
            isDemo: false,
            createdAt: data.user.created_at,
          },
          isAuthenticated: true,
          isLoading: false,
        });
      }
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (email: string, password: string, name: string) => {
    set({ isLoading: true });
    try {
      const { isSupabaseConfigured, supabase } = await import('@/lib/supabase/client');
      if (!isSupabaseConfigured()) {
        set({ isLoading: false });
        throw new Error('Supabase is not configured. Please set your environment variables.');
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name } },
      });
      if (error) throw error;
      if (data.user) {
        const { getProfile } = await import('@/lib/supabase/data');
        const profile = await getProfile();
        set({
          user: {
            id: data.user.id,
            email: data.user.email || '',
            displayName: profile?.display_name || name,
            role: (profile?.role || 'standard') as import('@/lib/types').UserRole,
            mfaEnabled: false,
            emailVerified: !!data.user.email_confirmed_at,
            isDemo: false,
            createdAt: data.user.created_at,
          },
          isAuthenticated: true,
          isLoading: false,
        });
      }
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    set({ user: null, isAuthenticated: false });
  },
}));

// ============================================================
// NAVIGATION STORE
// ============================================================

export const useNavStore = create<NavStore>((set) => ({
  currentView: 'login',
  selectedInvestigationId: null,
  sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
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
      if (isSupabaseConfigured()) { saveInvestigation(investigation).catch(() => {}); }
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
      set({ currentInvestigation: inv });
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
    twilioAccountSid: '',
    twilioAuthToken: '',
    cloudinaryCloudName: '',
    cloudinaryApiKey: '',
    cloudinaryApiSecret: '',
    mapboxToken: '',
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
    { name: 'AbstractAPI Phone', category: 'intelligence', isEnabled: true, health: 'unknown', lastChecked: null, latencyMs: null },
    { name: 'NumVerify', category: 'intelligence', isEnabled: true, health: 'unknown', lastChecked: null, latencyMs: null },
    { name: 'Serper Web Search', category: 'intelligence', isEnabled: true, health: 'unknown', lastChecked: null, latencyMs: null },
    { name: 'Cloudinary AI', category: 'intelligence', isEnabled: true, health: 'unknown', lastChecked: null, latencyMs: null },
    { name: 'Social Scraper', category: 'intelligence', isEnabled: true, health: 'unknown', lastChecked: null, latencyMs: null },
    { name: 'Messaging OSINT', category: 'intelligence', isEnabled: true, health: 'unknown', lastChecked: null, latencyMs: null },
  ],
  securityEvents: [],
  auditEvents: [],
  deviceAuthorizations: [],
  featureFlags: [
    { key: 'batch_investigations', isEnabled: true, config: { maxSize: 10 } },
    { key: 'ai_assistant', isEnabled: true, config: null },
    { key: '3d_globe', isEnabled: true, config: { autoRotate: true } },
    { key: 'pdf_reports', isEnabled: true, config: null },
    { key: 'device_fingerprint', isEnabled: true, config: null },
  ],
  loadAdminData: () => {
    fetch('/api/health')
      .then(r => r.json())
      .then((data: { providers: Array<{ name: string; isConfigured: boolean; isHealthy: boolean; latencyMs: number | null }> }) => {
        if (!data.providers) return;
        set((state) => ({
          providers: state.providers.map(p => {
            const pn = p.name.toLowerCase();
            const match = data.providers.find((h: any) => {
              const n = h.name.toLowerCase();
              return pn.includes(n) || n.includes(pn);
            });
            if (!match) return p;
            return {
              ...p,
              isEnabled: match.isConfigured,
              health: !match.isConfigured ? 'unconfigured' as const : match.isHealthy ? 'healthy' as const : 'degraded' as const,
              lastChecked: new Date().toISOString(),
              latencyMs: match.latencyMs,
            };
          }),
        }));
      })
      .catch(() => {});
  },
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
    'florida': { lat: 27.6648, lng: -81.5158 },
  };

  const lower = location.toLowerCase();
  for (const [city, coords] of Object.entries(cities)) {
    if (lower.includes(city)) return coords;
  }
  return null;
}

