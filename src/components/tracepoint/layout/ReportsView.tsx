'use client';

import { useInvestigationStore, useNavStore } from '@/lib/store/app';
import { Button } from '@/components/ui/button';
import { FileText, Eye, Download, AlertTriangle, Clock } from 'lucide-react';

export default function ReportsView() {
  const { investigations } = useInvestigationStore();
  const { navigate } = useNavStore();

  const completed = investigations.filter((i) => i.status === 'completed');

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-tp-text">Investigation Reports</h2>
            <p className="text-xs text-tp-text-dim mt-0.5">
              View and export formal investigation reports
            </p>
          </div>
        </div>

        {completed.length === 0 ? (
          <div className="tp-panel rounded-lg p-12 text-center">
            <FileText className="w-10 h-10 text-tp-text-dim/30 mx-auto mb-3" />
            <p className="text-sm text-tp-text-dim">No completed investigations</p>
            <p className="text-xs text-tp-text-dim/60 mt-1">Complete an investigation to generate a report</p>
          </div>
        ) : (
          <div className="space-y-3">
            {completed.map((inv) => (
              <div
                key={inv.id}
                className={`tp-panel rounded-lg p-4 ${inv.isDemoData ? 'tp-demo-watermark' : ''}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-tp-amber shrink-0" />
                      <span className="text-sm font-medium text-tp-text truncate">
                        Report: {inv.inputName || inv.inputPhone || inv.inputEmail || inv.id.slice(0, 8)}
                      </span>
                      {inv.isDemoData && (
                        <span className="flex items-center gap-0.5 text-[9px] font-mono text-tp-amber uppercase shrink-0">
                          <AlertTriangle className="w-2.5 h-2.5" /> Demo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-tp-text-dim ml-6">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(inv.completedAt || inv.createdAt).toLocaleDateString()}
                      </span>
                      <span>{inv.evidenceCount} evidence items</span>
                      <span>{inv.sourceCount} sources</span>
                      <span>Confidence: {inv.confidence || 0}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('investigation-detail', inv.id)}
                      className="border-tp-border text-tp-text-dim hover:text-tp-amber hover:border-tp-amber/30 text-xs h-8"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-tp-border text-tp-text-dim hover:text-tp-amber hover:border-tp-amber/30 text-xs h-8"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}