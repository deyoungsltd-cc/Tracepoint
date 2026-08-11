// ============================================================
// TRACEPOINT — localStorage persistence for investigations
// Used when Supabase is not configured.
// ============================================================

import type { Investigation } from '@/lib/types';

const STORAGE_KEY = 'tracepoint_investigations';
const MAX_STORED = 100;

export function saveToLocal(investigation: Investigation): void {
  try {
    const existing = loadFromLocal();
    const idx = existing.findIndex((i) => i.id === investigation.id);
    if (idx >= 0) {
      existing[idx] = investigation;
    } else {
      existing.unshift(investigation);
    }
    const trimmed = existing.slice(0, MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('[localStorage] Save failed:', e);
  }
}

export function loadFromLocal(): Investigation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Investigation[];
  } catch {
    return [];
  }
}

export function deleteFromLocal(id: string): void {
  try {
    const existing = loadFromLocal();
    const filtered = existing.filter((i) => i.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[localStorage] Delete failed:', e);
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
