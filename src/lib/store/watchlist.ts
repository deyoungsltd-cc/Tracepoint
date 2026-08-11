// ============================================================
// TRACEPOINT — Watchlist / Monitoring Zustand Store
// Persists entries to localStorage for cross-session retention.
// ============================================================

import { create } from 'zustand';

// --- Types ---

export interface WatchlistEntry {
  id: string;
  label: string;              // user-given name like "John's Phone"
  phone?: string;
  phoneNormalized?: string;
  email?: string;
  frequency: 'hourly' | 'daily' | 'weekly';
  isActive: boolean;
  lastCheckedAt: string | null;
  lastConfidence: number | null;
  lastIdentityCount: number | null;
  confidenceDelta: number | null;   // change since last check
  createdAt: string;
  alertOnNewIdentity: boolean;
  alertOnConfidenceChange: number;   // alert if confidence changes by this much
}

export interface WatchlistStore {
  entries: WatchlistEntry[];
  addEntry: (entry: Omit<WatchlistEntry, 'id' | 'createdAt' | 'lastCheckedAt' | 'lastConfidence' | 'lastIdentityCount' | 'confidenceDelta'>) => void;
  removeEntry: (id: string) => void;
  toggleEntry: (id: string) => void;
  updateEntry: (id: string, updates: Partial<WatchlistEntry>) => void;
  clearAll: () => void;
}

// --- localStorage helpers ---

const STORAGE_KEY = 'tracepoint-watchlist';

function loadEntries(): WatchlistEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WatchlistEntry[];
  } catch {
    return [];
  }
}

function saveEntries(entries: WatchlistEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('[watchlist] Save failed:', e);
  }
}

// --- Store ---

export const useWatchlistStore = create<WatchlistStore>((set, get) => ({
  entries: loadEntries(),

  addEntry: (entry) => {
    const newEntry: WatchlistEntry = {
      ...entry,
      id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      lastCheckedAt: null,
      lastConfidence: null,
      lastIdentityCount: null,
      confidenceDelta: null,
      createdAt: new Date().toISOString(),
    };
    set((state) => {
      const updated = [newEntry, ...state.entries];
      saveEntries(updated);
      return { entries: updated };
    });
  },

  removeEntry: (id) => {
    set((state) => {
      const updated = state.entries.filter((e) => e.id !== id);
      saveEntries(updated);
      return { entries: updated };
    });
  },

  toggleEntry: (id) => {
    set((state) => {
      const updated = state.entries.map((e) =>
        e.id === id ? { ...e, isActive: !e.isActive } : e
      );
      saveEntries(updated);
      return { entries: updated };
    });
  },

  updateEntry: (id, updates) => {
    set((state) => {
      const updated = state.entries.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      );
      saveEntries(updated);
      return { entries: updated };
    });
  },

  clearAll: () => {
    set({ entries: [] });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  },
}));
