'use client';

import { useInvestigationStore, useNavStore } from '@/lib/store/app';
import { Badge } from '@/components/ui/badge';
import { Clock, Search, Trash2, Eye, AlertTriangle } from 'lucide-react';

export default function HistoryView() {
  const { investigations, selectInvestigation } = useInvestigationStore();
  const { navigate } = useNavStore();

  const handleView = (id: string) => {
    selectInvestigation(id);
    navigate('investigation-detail', id);
  };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-tp-text">Investigation History</h2>
            <p className="text-xs text-tp-text-dim mt-0.5">
              {investigations.length} investigation{investigations.length !== 1 ? 's' : ''} on record
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tp-text-dim" />
              <input
                placeholder="Search investigations..."
                className="pl-8 pr-3 py-1.5 bg-tp-surface border border-tp-border rounded text-xs text-tp-text placeholder:text-tp-text-dim/50 w-48"
              />
            </div>
          </div>
        </div>

        {/* List */}
        {investigations.length === 0 ? (
          <div className="tp-panel rounded-lg p-12 text-center">
            <Clock className="w-10 h-10 text-tp-text-dim/30 mx-auto mb-3" />
            <p className="text-sm text-tp-text-dim">No investigations yet</p>
            <p className="text-xs text-tp-text-dim/60 mt-1">Start your first investigation to see results here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {investigations.map((inv) => (
              <div
                key={inv.id}
                className={`tp-panel rounded-lg p-4 hover:bg-tp-surface-hover transition-colors ${inv.isDemoData ? 'tp-demo-watermark' : ''}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-tp-text truncate">
                        {inv.inputName || inv.inputPhone || inv.inputEmail || 'Unknown Target'}
                      </span>
                      {inv.isDemoData && (
                        <span className="flex items-center gap-0.5 text-[9px] font-mono text-tp-amber uppercase">
                          <AlertTriangle className="w-2.5 h-2.5" /> Demo
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {inv.inputPhone && (
                        <span className="tp-source-tag">Tel: {inv.inputPhoneNormalized || inv.inputPhone}</span>
                      )}
                      {inv.inputEmail && (
                        <span className="tp-source-tag">Email: {inv.inputEmail}</span>
                      )}
                      {inv.inputBusiness && (
                        <span className="tp-source-tag">Biz: {inv.inputBusiness}</span>
                      )}
                      {inv.inputCountry && (
                        <span className="tp-source-tag">{inv.inputCountry}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-tp-text-dim">
                      <span>{inv.identityCount} identities</span>
                      <span>{inv.evidenceCount} evidence items</span>
                      <span>{inv.sourceCount} sources</span>
                      {inv.hasConflicts && (
                        <span className="text-tp-red flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" /> Conflicts
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Confidence */}
                    <div className="text-center">
                      <div className={`text-lg font-bold font-mono ${
                        inv.confidence && inv.confidence >= 80 ? 'text-tp-green' :
                        inv.confidence && inv.confidence >= 50 ? 'text-tp-amber' : 'text-tp-text-dim'
                      }`}>
                        {inv.confidence || 0}%
                      </div>
                      <div className="tp-hud text-[8px]">Confidence</div>
                    </div>
                    <div className="h-8 w-px bg-tp-border" />
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleView(inv.id)}
                        className="p-1.5 rounded hover:bg-tp-amber/10 text-tp-text-dim hover:text-tp-amber transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-tp-red/10 text-tp-text-dim hover:text-tp-red transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-tp-border/50">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] border-tp-border text-tp-text-dim uppercase">
                      {inv.depth}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase ${
                        inv.status === 'completed' ? 'border-tp-green/30 text-tp-green' :
                        inv.status === 'running' ? 'border-tp-amber/30 text-tp-amber' :
                        inv.status === 'failed' ? 'border-tp-red/30 text-tp-red' :
                        'border-tp-border text-tp-text-dim'
                      }`}
                    >
                      {inv.status}
                    </Badge>
                  </div>
                  <span className="tp-hud text-[9px]">
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