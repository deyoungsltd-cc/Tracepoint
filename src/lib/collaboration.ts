// ============================================================
// TRACEPOINT — Real-Time Collaboration via Supabase Presence
// Shows who is viewing an investigation and broadcasts cursor/selection.
// ============================================================

import { createClient, type RealtimeChannel } from '@supabase/supabase-js';

export interface Collaborator {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  currentView: string;
  investigationId: string | null;
  lastActive: string;
}

export interface CollaborationEvent {
  type: 'investigation_opened' | 'investigation_updated' | 'evidence_added' | 'note_added' | 'candidate_selected';
  userId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

let presenceChannel: RealtimeChannel | null = null;
let broadcastChannel: RealtimeChannel | null = null;
let userId: string = '';

function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}

function getSupabaseKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
}

/**
 * Initialize collaboration for a user session.
 * Call this after authentication.
 */
export function initCollaboration(user: { id: string; displayName: string; avatarUrl?: string | null }): void {
  userId = user.id;
  
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  if (!url || !key) return;

  const client = createClient(url, key);

  // Presence channel — tracks who's online and what they're viewing
  presenceChannel = client.channel('tracepoint-presence', {
    config: { presence: { key: userId } },
  });

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      // Trigger re-render by dispatching custom event
      window.dispatchEvent(new CustomEvent('tp-presence-update'));
    })
    .subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel!.track({
          user_id: userId,
          display_name: user.displayName,
          avatar_url: user.avatarUrl || null,
          online_at: new Date().toISOString(),
        });
      }
    });

  // Broadcast channel — for real-time investigation events
  broadcastChannel = client.channel('tracepoint-events');
  broadcastChannel.subscribe();
}

/**
 * Track which investigation a user is viewing.
 */
export async function trackView(investigationId: string | null, viewName: string): Promise<void> {
  if (!presenceChannel) return;
  await presenceChannel.track({
    user_id: userId,
    current_view: viewName,
    investigation_id: investigationId,
    online_at: new Date().toISOString(),
  });
}

/**
 * Broadcast an event to all connected collaborators.
 */
export function broadcastEvent(event: Omit<CollaborationEvent, 'userId' | 'timestamp'>): void {
  if (!broadcastChannel) return;
  broadcastChannel.send({
    type: 'broadcast',
    event: 'investigation_event',
    payload: {
      ...event,
      userId,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Subscribe to collaboration events.
 */
export function onCollaborationEvent(callback: (event: CollaborationEvent) => void): () => void {
  if (!broadcastChannel) return () => {};
  
  const handler = (payload: { payload: CollaborationEvent }) => {
    // Don't echo our own events
    if (payload.payload.userId !== userId) {
      callback(payload.payload);
    }
  };

  broadcastChannel.on('broadcast', { event: 'investigation_event' }, handler);
  return () => {
    broadcastChannel?.off('broadcast', { event: 'investigation_event' }, handler);
  };
}

/**
 * Get current online collaborators.
 */
export function getOnlineCollaborators(): Collaborator[] {
  if (!presenceChannel) return [];
  
  const state = presenceChannel.presenceState<{[key: string]: {
    user_id: string;
    display_name: string;
    avatar_url: string | null;
    current_view: string;
    investigation_id: string | null;
    online_at: string;
  }}>();

  const collaborators: Collaborator[] = [];
  for (const key of Object.keys(state)) {
    const presence = state[key];
    if (presence && presence.length > 0) {
      const latest = presence[presence.length - 1];
      collaborators.push({
        id: latest.user_id,
        displayName: latest.display_name,
        avatarUrl: latest.avatar_url,
        currentView: latest.current_view || 'dashboard',
        investigationId: latest.investigation_id || null,
        lastActive: latest.online_at,
      });
    }
  }
  return collaborators;
}

/**
 * Clean up collaboration channels.
 */
export function disconnectCollaboration(): void {
  if (presenceChannel) {
    presenceChannel.unsubscribe();
    presenceChannel = null;
  }
  if (broadcastChannel) {
    broadcastChannel.unsubscribe();
    broadcastChannel = null;
  }
}
