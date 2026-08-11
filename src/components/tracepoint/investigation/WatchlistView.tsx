'use client';

import { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Play,
  Pause,
  EyeOff,
  Bell,
  Clock,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Phone,
  Mail,
  X,
  Radar,
} from 'lucide-react';
import { useWatchlistStore } from '@/lib/store/watchlist';
import { useInvestigationStore, useNavStore } from '@/lib/store/app';

// --- Helpers ---

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function confidenceColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 75) return 'text-[#4a9e5a]';
  if (score >= 40) return 'text-[#c8a24e]';
  return 'text-[#b83a3a]';
}

// --- Component ---

export default function WatchlistView() {
  const { entries, addEntry, removeEntry, toggleEntry } = useWatchlistStore();
  const { startInvestigation, isRunning } = useInvestigationStore();
  const { navigate } = useNavStore();

  const [showForm, setShowForm] = useState(false);
  const [formLabel, setFormLabel] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formFrequency, setFormFrequency] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [formAlertIdentity, setFormAlertIdentity] = useState(true);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => {
      // Active first, then by creation date descending
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }),
    [entries]
  );

  const canAdd = formLabel.trim().length > 0 && (formPhone.trim().length > 0 || formEmail.trim().length > 0);

  const handleAdd = () => {
    if (!canAdd) return;

    // Normalize phone
    let phoneNormalized: string | undefined;
    if (formPhone.trim()) {
      const digits = formPhone.replace(/\D/g, '');
      if (digits.length <= 10 && !formPhone.startsWith('+')) {
        phoneNormalized = `+1${digits}`;
      } else {
        phoneNormalized = `+${digits}`;
      }
    }

    addEntry({
      label: formLabel.trim(),
      phone: formPhone.trim() || undefined,
      phoneNormalized,
      email: formEmail.trim() || undefined,
      frequency: formFrequency,
      isActive: true,
      alertOnNewIdentity: formAlertIdentity,
      alertOnConfidenceChange: 15,
    });

    // Reset form
    setFormLabel('');
    setFormPhone('');
    setFormEmail('');
    setFormFrequency('daily');
    setFormAlertIdentity(true);
    setShowForm(false);
  };

  const handleRunNow = async (entry: typeof entries[number]) => {
    await startInvestigation({
      phone: entry.phone || undefined,
      phoneNormalized: entry.phoneNormalized || undefined,
      email: entry.email || undefined,
    });
    navigate('investigation');
  };

  const handleDelete = (id: string) => {
    if (confirm('Remove this target from the watchlist?')) {
      removeEntry(id);
    }
  };

  return (
    <div className="p-4 lg:p-6 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Radar className="w-4 h-4 text-[#c8a24e]" />
              <h2 className="text-lg font-semibold text-foreground">Watchlist</h2>
              {entries.length > 0 && (
                <span className="intel-badge">{entries.length}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Monitor targets for changes. Investigations run automatically.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-colors ${
              showForm
                ? 'bg-accent border border-border text-muted-foreground hover:text-foreground'
                : 'bg-[#c8a24e] hover:bg-[#c8a24e]/85 text-background'
            }`}
          >
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? 'Cancel' : 'Add Target'}
          </button>
        </div>

        {/* Add Form */}
        {showForm && (
          <div className="surface p-5 mb-4 space-y-4 border-l-2 border-l-[#c8a24e]/40">
            <div className="flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-[#c8a24e]" />
              <span className="mono-label">New Watchlist Target</span>
            </div>

            {/* Label */}
            <div className="space-y-1.5">
              <label className="mono-label">Label</label>
              <input
                type="text"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="e.g. John's Phone"
                className="w-full px-3 py-2 bg-accent border border-border rounded text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Phone + Email row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="mono-label">Phone (optional)</label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+1 555 234 5678"
                    className="w-full pl-8 pr-3 py-2 bg-accent border border-border rounded text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="mono-label">Email (optional)</label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full pl-8 pr-3 py-2 bg-accent border border-border rounded text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            </div>

            {/* Frequency + Alert */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="mono-label">Check Frequency</label>
                <div className="flex gap-2">
                  {(['hourly', 'daily', 'weekly'] as const).map((freq) => (
                    <button
                      key={freq}
                      onClick={() => setFormFrequency(freq)}
                      className={`flex-1 py-1.5 rounded border text-xs capitalize transition-colors ${
                        formFrequency === freq
                          ? 'border-[#c8a24e]/40 bg-[#c8a24e]/8 text-[#c8a24e]'
                          : 'border-border text-muted-foreground hover:border-[#c8a24e]/20 hover:text-foreground'
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="mono-label">Alert on New Identity</label>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => setFormAlertIdentity(!formAlertIdentity)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      formAlertIdentity ? 'bg-[#4a9e5a]' : 'bg-accent border border-border'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                        formAlertIdentity
                          ? 'left-[18px] bg-background'
                          : 'left-0.5 bg-muted-foreground'
                      }`}
                    />
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {formAlertIdentity ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAdd}
                disabled={!canAdd}
                className="flex-1 py-2 bg-[#c8a24e] hover:bg-[#c8a24e]/85 text-background font-medium text-sm rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5 inline mr-1.5" />
                Add to Watchlist
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="py-2 px-4 border border-border text-muted-foreground text-sm rounded hover:text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Entries List */}
        {sortedEntries.length === 0 ? (
          <div className="surface p-12 text-center">
            <Radar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {showForm
                ? 'Fill out the form above to add your first target'
                : 'No targets on the watchlist'}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {showForm
                ? 'At least a label and one contact method are required'
                : 'Click "Add Target" to start monitoring a phone or email'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedEntries.map((entry) => (
              <div
                key={entry.id}
                className={`surface p-4 transition-colors ${
                  !entry.isActive ? 'opacity-60' : 'hover:bg-accent/60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-medium text-foreground truncate">
                        {entry.label}
                      </span>
                      {entry.isActive ? (
                        <span className="intel-badge flex items-center gap-1">
                          <Radar className="w-2.5 h-2.5" /> Active
                        </span>
                      ) : (
                        <span className="intel-badge text-[#5e665c] border-[#5e665c]/20 flex items-center gap-1">
                          <EyeOff className="w-2.5 h-2.5" /> Paused
                        </span>
                      )}
                      <span className="source-badge capitalize">{entry.frequency}</span>
                    </div>

                    {/* Contact info badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {entry.phone && (
                        <span className="source-badge">
                          Tel: {entry.phoneNormalized || entry.phone}
                        </span>
                      )}
                      {entry.email && (
                        <span className="source-badge">
                          Email: {entry.email}
                        </span>
                      )}
                      {entry.alertOnNewIdentity && (
                        <span className="source-badge text-[#c8a24e] border-[#c8a24e]/20 flex items-center gap-1">
                          <Bell className="w-2.5 h-2.5" /> Alerts On
                        </span>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {relativeTime(entry.lastCheckedAt)}
                      </span>
                      {entry.lastConfidence !== null && (
                        <span className={`font-mono font-semibold ${confidenceColor(entry.lastConfidence)}`}>
                          {entry.lastConfidence}%
                          {entry.confidenceDelta !== null && entry.confidenceDelta !== 0 && (
                            <span className="ml-1 flex items-center gap-0.5">
                              {entry.confidenceDelta > 0 ? (
                                <>
                                  <ArrowUp className="w-3 h-3 text-[#4a9e5a]" />
                                  <span className="text-[#4a9e5a]">+{entry.confidenceDelta}</span>
                                </>
                              ) : (
                                <>
                                  <ArrowDown className="w-3 h-3 text-[#b83a3a]" />
                                  <span className="text-[#b83a3a]">{entry.confidenceDelta}</span>
                                </>
                              )}
                            </span>
                          )}
                        </span>
                      )}
                      {entry.lastIdentityCount !== null && (
                        <span>{entry.lastIdentityCount} identities</span>
                      )}
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleEntry(entry.id)}
                      className={`p-1.5 rounded transition-colors ${
                        entry.isActive
                          ? 'hover:bg-[#c8a24e]/10 text-muted-foreground hover:text-[#c8a24e]'
                          : 'hover:bg-[#4a9e5a]/10 text-muted-foreground hover:text-[#4a9e5a]'
                      }`}
                      title={entry.isActive ? 'Pause monitoring' : 'Resume monitoring'}
                    >
                      {entry.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleRunNow(entry)}
                      disabled={isRunning || !entry.isActive}
                      className="p-1.5 rounded hover:bg-[#c8a24e]/10 text-muted-foreground hover:text-[#c8a24e] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Run investigation now"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1.5 rounded hover:bg-[#b83a3a]/10 text-muted-foreground hover:text-[#b83a3a] transition-colors"
                      title="Remove from watchlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    {entry.lastConfidence === null && entry.isActive && (
                      <span className="text-[10px] text-[#c8a24e] flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pending first check
                      </span>
                    )}
                    {entry.confidenceDelta !== null && Math.abs(entry.confidenceDelta) >= entry.alertOnConfidenceChange && (
                      <span className="text-[10px] text-[#b83a3a] flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Significant confidence change detected
                      </span>
                    )}
                  </div>
                  <span className="mono-label text-[9px]">
                    Added {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Clear all when entries exist */}
        {entries.length > 0 && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                if (confirm('Remove all targets from the watchlist? This cannot be undone.')) {
                  useWatchlistStore.getState().clearAll();
                }
              }}
              className="text-[10px] text-[#b83a3a] hover:text-[#d45050] transition-colors"
            >
              Clear All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
