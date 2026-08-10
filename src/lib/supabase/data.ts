// ============================================================
// TRACEPOINT — Supabase Data Access Layer
// All DB operations with graceful offline/demo-mode fallback
// ============================================================

import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type {
  Investigation,
  IdentityCandidate,
  EvidenceItem,
  DeviceLocation,
  TimelineEvent,
} from '@/lib/types';

// ---- camelCase → snake_case helpers ---------------------------------------

function toSnakeInvestigation(inv: Investigation) {
  return {
    id: inv.id,
    status: inv.status,
    depth: inv.depth,
    is_batch: inv.isBatch,
    batch_id: inv.batchId,
    input_phone: inv.inputPhone,
    input_phone_normalized: inv.inputPhoneNormalized,
    input_email: inv.inputEmail,
    input_name: inv.inputName,
    input_business: inv.inputBusiness,
    input_region: inv.inputRegion,
    input_country: inv.inputCountry,
    input_state: inv.inputState,
    input_city: inv.inputCity,
    summary: inv.summary,
    identity_count: inv.identityCount,
    evidence_count: inv.evidenceCount,
    source_count: inv.sourceCount,
    confidence: inv.confidence,
    has_conflicts: inv.hasConflicts,
    location_status: inv.locationStatus,
    is_demo_data: inv.isDemoData,
    started_at: inv.startedAt,
    completed_at: inv.completedAt,
    created_at: inv.createdAt,
    updated_at: inv.updatedAt,
  };
}

function toCamelInvestigation(row: Record<string, unknown>): Investigation {
  return {
    id: row.id as string,
    status: row.status as Investigation['status'],
    depth: row.depth as Investigation['depth'],
    isBatch: (row.is_batch ?? false) as boolean,
    batchId: (row.batch_id ?? null) as string | null,
    inputPhone: (row.input_phone ?? null) as string | null,
    inputPhoneNormalized: (row.input_phone_normalized ?? null) as string | null,
    inputEmail: (row.input_email ?? null) as string | null,
    inputName: (row.input_name ?? null) as string | null,
    inputBusiness: (row.input_business ?? null) as string | null,
    inputRegion: (row.input_region ?? null) as string | null,
    inputCountry: (row.input_country ?? null) as string | null,
    inputState: (row.input_state ?? null) as string | null,
    inputCity: (row.input_city ?? null) as string | null,
    summary: (row.summary ?? null) as string | null,
    identityCount: (row.identity_count ?? 0) as number,
    evidenceCount: (row.evidence_count ?? 0) as number,
    sourceCount: (row.source_count ?? 0) as number,
    confidence: (row.confidence ?? null) as number | null,
    hasConflicts: (row.has_conflicts ?? false) as boolean,
    locationStatus: (row.location_status ?? 'unavailable') as Investigation['locationStatus'],
    isDemoData: (row.is_demo_data ?? false) as boolean,
    startedAt: (row.started_at ?? null) as string | null,
    completedAt: (row.completed_at ?? null) as string | null,
    createdAt: (row.created_at ?? new Date().toISOString()) as string,
    updatedAt: (row.updated_at ?? new Date().toISOString()) as string,
    candidates: [],
    evidence: [],
    locations: [],
    timeline: [],
  };
}

function toSnakeCandidate(c: IdentityCandidate, investigationId: string) {
  return {
    id: c.id,
    investigation_id: investigationId,
    rank: c.rank,
    name: c.name,
    phone: c.phone,
    email: c.email,
    business: c.business,
    website: c.website,
    location: c.location,
    photo_url: c.photoUrl,
    confidence: c.confidence,
    verified_status: c.verifiedStatus,
    match_fields: c.matchFields,
  };
}

function toCamelCandidate(row: Record<string, unknown>): IdentityCandidate {
  return {
    id: row.id as string,
    rank: (row.rank ?? 0) as number,
    name: (row.name ?? null) as string | null,
    phone: (row.phone ?? null) as string | null,
    email: (row.email ?? null) as string | null,
    business: (row.business ?? null) as string | null,
    website: (row.website ?? null) as string | null,
    location: (row.location ?? null) as string | null,
    photoUrl: (row.photo_url ?? null) as string | null,
    confidence: (row.confidence ?? 0) as number,
    verifiedStatus: (row.verified_status ?? 'unverified') as IdentityCandidate['verifiedStatus'],
    matchFields: (row.match_fields ?? []) as string[],
    evidence: [],
  };
}

function toSnakeEvidence(e: EvidenceItem, investigationId: string) {
  return {
    id: e.id,
    investigation_id: investigationId,
    candidate_id: e.candidateId ?? null,
    claim: e.claim,
    source_url: e.sourceUrl,
    source_name: e.sourceName,
    source_type: e.sourceType,
    discovered_at: e.discoveredAt,
    published_at: e.publishedAt,
    excerpt: e.excerpt,
    reliability_score: e.reliabilityScore,
    relevance_score: e.relevanceScore,
    freshness_score: e.freshnessScore,
    verification_status: e.verificationStatus,
  };
}

function toCamelEvidence(row: Record<string, unknown>): EvidenceItem {
  return {
    id: row.id as string,
    claim: (row.claim ?? '') as string,
    sourceUrl: (row.source_url ?? null) as string | null,
    sourceName: (row.source_name ?? '') as string,
    sourceType: (row.source_type ?? 'web_search') as EvidenceItem['sourceType'],
    discoveredAt: (row.discovered_at ?? new Date().toISOString()) as string,
    publishedAt: (row.published_at ?? null) as string | null,
    excerpt: (row.excerpt ?? null) as string | null,
    reliabilityScore: (row.reliability_score ?? 0) as number,
    relevanceScore: (row.relevance_score ?? 0) as number,
    freshnessScore: (row.freshness_score ?? 0) as number,
    verificationStatus: (row.verification_status ?? 'unverified') as EvidenceItem['verificationStatus'],
    candidateId: (row.candidate_id ?? undefined) as string | undefined,
  };
}

function toSnakeLocation(loc: DeviceLocation, investigationId: string) {
  return {
    id: loc.id,
    investigation_id: investigationId,
    device_id: loc.deviceId,
    provider: loc.provider,
    status: loc.status,
    latitude: loc.latitude,
    longitude: loc.longitude,
    accuracy: loc.accuracy,
    address: loc.address,
    timestamp: loc.timestamp,
    freshness: loc.freshness,
    device_status: loc.deviceStatus,
    battery_level: loc.batteryLevel,
    network_type: loc.networkType,
  };
}

function toCamelLocation(row: Record<string, unknown>): DeviceLocation {
  return {
    id: row.id as string,
    deviceId: (row.device_id ?? null) as string | null,
    provider: (row.provider ?? '') as string,
    status: (row.status ?? 'unavailable') as DeviceLocation['status'],
    latitude: (row.latitude ?? null) as number | null,
    longitude: (row.longitude ?? null) as number | null,
    accuracy: (row.accuracy ?? null) as number | null,
    address: (row.address ?? null) as string | null,
    timestamp: (row.timestamp ?? null) as string | null,
    freshness: (row.freshness ?? 'stale') as DeviceLocation['freshness'],
    deviceStatus: (row.device_status ?? null) as string | null,
    batteryLevel: (row.battery_level ?? null) as number | null,
    networkType: (row.network_type ?? null) as string | null,
  };
}

function toSnakeTimeline(event: TimelineEvent, investigationId: string) {
  return {
    id: event.id,
    investigation_id: investigationId,
    event_type: event.eventType,
    description: event.description,
    metadata: event.metadata,
    timestamp: event.timestamp,
  };
}

function toCamelTimeline(row: Record<string, unknown>): TimelineEvent {
  return {
    id: row.id as string,
    eventType: (row.event_type ?? '') as string,
    description: (row.description ?? '') as string,
    metadata: (row.metadata ?? null) as Record<string, unknown> | null,
    timestamp: (row.timestamp ?? new Date().toISOString()) as string,
  };
}

// ---- Helpers ---------------------------------------------------------------

async function currentUserId(): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// ---- Public API -----------------------------------------------------------

/**
 * Save a complete investigation (row + candidates + evidence + locations + timeline)
 * to Supabase. Returns the investigation ID on success.
 */
export async function saveInvestigation(
  inv: Investigation,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const userId = await currentUserId();

    // 1. Upsert the investigation row
    const row = { ...toSnakeInvestigation(inv), user_id: userId };
    const { error: invErr } = await supabase
      .from('investigations')
      .upsert(row, { onConflict: 'id' });

    if (invErr) {
      return { success: false, error: invErr.message };
    }

    // 2. Delete stale related rows then re-insert (simplest correct approach)
    const invId = inv.id;

    // Candidates
    await supabase.from('identity_candidates').delete().eq('investigation_id', invId);
    if (inv.candidates.length > 0) {
      const candidateRows = inv.candidates.map((c) => toSnakeCandidate(c, invId));
      const { error: cErr } = await supabase
        .from('identity_candidates')
        .insert(candidateRows);
      if (cErr) return { success: false, error: cErr.message };
    }

    // Evidence
    await supabase.from('evidence_items').delete().eq('investigation_id', invId);
    if (inv.evidence.length > 0) {
      const evidenceRows = inv.evidence.map((e) => toSnakeEvidence(e, invId));
      const { error: eErr } = await supabase
        .from('evidence_items')
        .insert(evidenceRows);
      if (eErr) return { success: false, error: eErr.message };
    }

    // Locations
    await supabase.from('device_locations').delete().eq('investigation_id', invId);
    if (inv.locations.length > 0) {
      const locationRows = inv.locations.map((l) => toSnakeLocation(l, invId));
      const { error: lErr } = await supabase
        .from('device_locations')
        .insert(locationRows);
      if (lErr) return { success: false, error: lErr.message };
    }

    // Timeline
    await supabase.from('timeline_events').delete().eq('investigation_id', invId);
    if (inv.timeline.length > 0) {
      const timelineRows = inv.timeline.map((t) => toSnakeTimeline(t, invId));
      const { error: tErr } = await supabase
        .from('timeline_events')
        .insert(timelineRows);
      if (tErr) return { success: false, error: tErr.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error saving investigation';
    return { success: false, error: message };
  }
}

/**
 * Load an investigation with all related data (candidates, evidence, locations, timeline).
 */
export async function loadInvestigation(id: string): Promise<Investigation | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    // Fetch main row
    const { data: invData, error: invErr } = await supabase
      .from('investigations')
      .select('*')
      .eq('id', id)
      .single();

    if (invErr || !invData) return null;

    const inv = toCamelInvestigation(invData);

    // Fetch related data in parallel
    const [candidatesRes, evidenceRes, locationsRes, timelineRes] = await Promise.all([
      supabase.from('identity_candidates').select('*').eq('investigation_id', id).order('rank'),
      supabase.from('evidence_items').select('*').eq('investigation_id', id).order('discovered_at'),
      supabase.from('device_locations').select('*').eq('investigation_id', id).order('timestamp', { nullsFirst: false }),
      supabase.from('timeline_events').select('*').eq('investigation_id', id).order('timestamp'),
    ]);

    // Map candidates
    const candidates: IdentityCandidate[] = (candidatesRes.data ?? []).map(toCamelCandidate);

    // Map evidence — also attach each item to its candidate
    const evidence: EvidenceItem[] = (evidenceRes.data ?? []).map(toCamelEvidence);
    for (const c of candidates) {
      c.evidence = evidence.filter((e) => e.candidateId === c.id);
    }

    inv.candidates = candidates;
    inv.evidence = evidence;
    inv.locations = (locationsRes.data ?? []).map(toCamelLocation);
    inv.timeline = (timelineRes.data ?? []).map(toCamelTimeline);

    return inv;
  } catch {
    return null;
  }
}

/**
 * List investigations for the currently-authenticated user.
 */
export async function listInvestigations(
  limit = 50,
  offset = 0,
): Promise<Investigation[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const userId = await currentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('investigations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) return [];

    return (data as Record<string, unknown>[]).map(toCamelInvestigation);
  } catch {
    return [];
  }
}

/**
 * Delete an investigation and all related data (candidates, evidence, locations, timeline).
 */
export async function deleteInvestigation(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    // Delete related rows first, then the investigation itself
    await Promise.all([
      supabase.from('identity_candidates').delete().eq('investigation_id', id),
      supabase.from('evidence_items').delete().eq('investigation_id', id),
      supabase.from('device_locations').delete().eq('investigation_id', id),
      supabase.from('timeline_events').delete().eq('investigation_id', id),
    ]);

    const { error } = await supabase
      .from('investigations')
      .delete()
      .eq('id', id);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Get the current user's profile (extends Supabase auth user with role, display_name).
 */
export async function getProfile(): Promise<{
  id: string;
  email: string;
  display_name: string | null;
  role: string;
} | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    // Look up the profiles table for role / display_name
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('display_name, role')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      // Return a basic profile from auth data if no row exists yet
      return {
        id: user.id,
        email: user.email ?? '',
        display_name: user.user_metadata?.full_name ?? null,
        role: 'standard',
      };
    }

    return {
      id: user.id,
      email: user.email ?? '',
      display_name: (profile as Record<string, unknown>).display_name as string | null ?? null,
      role: ((profile as Record<string, unknown>).role as string) ?? 'standard',
    };
  } catch {
    return null;
  }
}

/**
 * Update the current user's profile fields.
 */
export async function updateProfile(updates: {
  display_name?: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    const row: Record<string, unknown> = { id: user.id };
    if (updates.display_name !== undefined) {
      row.display_name = updates.display_name;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(row, { onConflict: 'id' });

    return !error;
  } catch {
    return false;
  }
}

/**
 * List all users (admin only — enforcement should happen via RLS, this is a convenience wrapper).
 */
export async function listAllUsers(): Promise<
  Array<{
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    created_at: string;
  }>
> {
  if (!isSupabaseConfigured()) return [];

  try {
    // Join profiles with auth.users isn't directly available via anon key,
    // so we select from profiles (which should have email stored or we read from auth metadata).
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, role, created_at, email')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return (data as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      email: (row.email as string) ?? '',
      display_name: (row.display_name as string) ?? null,
      role: (row.role as string) ?? 'standard',
      created_at: (row.created_at as string) ?? '',
    }));
  } catch {
    return [];
  }
}

/**
 * Insert an audit event for the current user.
 */
export async function insertAuditEvent(event: {
  action: string;
  resource?: string;
  details?: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const userId = await currentUserId();

    await supabase.from('audit_events').insert({
      action: event.action,
      resource: event.resource ?? null,
      details: event.details ?? null,
      user_id: userId,
    });
  } catch {
    // Audit logging is best-effort — never throw
  }
}
