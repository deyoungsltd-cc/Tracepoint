'use client';

import { useState, useMemo } from 'react';
import { useInvestigationStore, useNavStore } from '@/lib/store/app';
import { ConfidenceMeter } from '@/components/tracepoint/shared/ConfidenceMeter';
import { Clock, Search, Trash2, Eye, AlertTriangle, RotateCcw, Calendar, Filter, Download, X } from 'lucide-react';
import { downloadReport } from '@/lib/generateReport';
import type { Investigation } from '@/lib/types';

type DateFilter = 'all' | 'today' | 'week' | 'month';

type StatusFilter = 'all' | 'completed' | 'running' | 'failed';

function matchesDateFilter(inv: Investigation, filter: DateFilter): boolean {
  if (filter === 'all') return true;
  const now = new Date();
  const created = new Date(inv.createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffDays = diffMs / 86400000;
  if (filter === 'today') return diffDays < 1;
  if (filter === 'week') return diffDays < 7;
  if (filter === 'month') return diffDays < 30;
  return true;
}

export default function HistoryView() {
  const { investigations, selectInvestigation, deleteInvestigation, startInvestigation } = useInvestigationStore();
  const { navigate } = useNavStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let result = investigations;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((inv) =>
        (inv.inputName || '').toLowerCase().includes(q) ||
        (inv.inputPhone || '').includes(q) ||
        (inv.inputEmail || '').toLowerCase().includes(q) ||
        (inv.inputBusiness || '').toLowerCase().includes(q) ||
        (inv.inputCountry || '').toLowerCase().includes(q)
      );
    }
    if (dateFilter !== 'all') {
      result = result.filter((inv) => matchesDateFilter(inv, dateFilter));
    }
    if (statusFilter !== 'all') {
      result = result.filter((inv) => inv.status === statusFilter);
    }
    return result;
  }, [investigations, searchQuery, dateFilter, statusFilter]);

  const handleView = (id: string) => {
    selectInvestigation(id);
    navigate('investigation-detail', id);
  };

  const handleReinvestigate = (inv: Investigation) => {
    startInvestigation({
      phone: inv.inputPhone || undefined,
      phoneNormalized: inv.inputPhoneNormalized || undefined,
      email: inv.inputEmail || undefined,
      country: inv.inputCountry || undefined,
      depth: inv.depth,
    });
    navigate('investigation');
  };

  const handleDelete = (id: string) => {
    deleteInvestigation(id);
  };

  const handleExportAll = () => {
    if (filtered.length === 0) return;
    const csvRows = ['Target,Phone,Email,Country,Status,Confidence,Identities,Evidence,Sources,Date'];
    for (const inv of filtered) {
      csvRows.push([
        inv.inputName || inv.inputPhone || inv.inputEmail || '',
        inv.inputPhone || '',
        inv.inputEmail || '',
        inv.inputCountry || '',
        inv.status,
        String(inv.confidence || 0),
        String(inv.identityCount),
        String(inv.evidenceCount),
        String(inv.sourceCount),
        new Date(inv.createdAt).toISOString(),
      ].map(v => `"${v.replace(/"/g, '“')}"]`).join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracepoint-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearAll = () => {
    if (confirm('Delete all investigations? This cannot be undone.')) {
      for (const inv of investigations) {
        deleteInvestigation(inv.id);
      }
    }
  };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Investigation History</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {investigations.length} investigation{investigations.length !== 1 ? 's' : ''} on record
              {searchQuery && ` · ${filtered.length} match${filtered.length !== 1 ? 'es' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search investigations..."
                className="pl-8 pr-3 py-1.5 bg-accent border border-border rounded text-xs text-foreground placeholder:text-muted-foreground/40 w-48 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1.5 rounded border transition-colors ${showFilters ? 'border-[#c8a24e]/40 bg-[#c8a24e]/8 text-[#c8a24e]' : 'border-border text-muted-foreground hover:text-foreground'}`}
              title="Filters"
            >
              <Filter className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleExportAll}
              disabled={filtered.length === 0}
              className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        {showFilters && (
          <div className="surface p-3 mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-muted-foreground" />
              <span className="mono-label text-[9px]">Period</span>
            </div>
            {([['all', 'All'], ['today', 'Today'], ['week', 'Week'], ['month', 'Month']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setDateFilter(val)}
                className={`px-2.5 py-1 rounded text-[10px] border transition-colors ${
                  dateFilter === val
                    ? 'border-[#c8a24e]/40 bg-[#c8a24e]/8 text-[#c8a24e]'
                    : 'border-border text-muted-foreground hover:border-[#c8a24e]/20'
                }`}
              >
                {label}
              </button>
            ))}
            <div className="w-px h-4 bg-border" />
            <span className="mono-label text-[9px]">Status</span>
            {([['all', 'All'], ['completed', 'Completed'], ['running', 'Running'], ['failed', 'Failed']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setStatusFilter(val)}
                className={`px-2.5 py-1 rounded text-[10px] border transition-colors ${
                  statusFilter === val
                    ? 'border-[#c8a24e]/40 bg-[#c8a24e]/8 text-[#c8a24e]'
                    : 'border-border text-muted-foreground hover:border-[#c8a24e]/20'
                }`}
              >
                {label}
              </button>
            ))}
            {investigations.length > 0 && (
              <button
                onClick={handleClearAll}
                className="ml-auto text-[10px] text-[#b83a3a] hover:text-[#d45050] transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <div className="surface p-12 text-center data-grid-bg">
            <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery || dateFilter !== 'all' || statusFilter !== 'all' ? 'No investigations match your filters' : 'No investigations yet'}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {searchQuery || dateFilter !== 'all' || statusFilter !== 'all' ? 'Try adjusting your search or filters' : 'Start your first investigation to see results here'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((inv) => (
              <div
                key={inv.id}
                className="surface p-4 hover:bg-accent/60 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {inv.inputName || inv.inputPhone || inv.inputEmail || 'Unknown Target'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {inv.inputPhone && (
                        <span className="source-badge">Tel: {inv.inputPhoneNormalized || inv.inputPhone}</span>
                      )}
                      {inv.inputEmail && (
                        <span className="source-badge">Email: {inv.inputEmail}</span>
                      )}
                      {inv.inputBusiness && (
                        <span className="source-badge">Biz: {inv.inputBusiness}</span>
                      )}
                      {inv.inputCountry && (
                        <span className="source-badge">{inv.inputCountry}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span>{inv.identityCount} identities</span>
                      <span>{inv.evidenceCount} evidence items</span>
                      <span>{inv.sourceCount} sources</span>
                      {inv.hasConflicts && (
                        <span className="text-[#b83a3a] flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" /> Conflicts
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24">
                      <ConfidenceMeter score={inv.confidence || 0} size="sm" showLabel={false} animated />
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleView(inv.id)}
                        className="p-1.5 rounded hover:bg-[#c8a24e]/10 text-muted-foreground hover:text-[#c8a24e] transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleReinvestigate(inv)}
                        className="p-1.5 rounded hover:bg-[#4a9e5a]/10 text-muted-foreground hover:text-[#4a9e5a] transition-colors"
                        title="Re-investigate"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => downloadReport(inv, null)}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Download Report"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(inv.id)}
                        className="p-1.5 rounded hover:bg-[#b83a3a]/10 text-muted-foreground hover:text-[#b83a3a] transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <span className="source-badge">{inv.depth}</span>
                    <span className={`source-badge ${
                      inv.status === 'completed' ? 'text-[#4a9e5a] border-[#4a9e5a]/20' :
                      inv.status === 'running' ? 'text-[#c8a24e] border-[#c8a24e]/20' :
                      inv.status === 'failed' ? 'text-[#b83a3a] border-[#b83a3a]/20' : ''
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                  <span className="mono-label text-[9px]">
                    {new Date(inv.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
