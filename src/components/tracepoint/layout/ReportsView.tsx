'use client';

import { useInvestigationStore, useNavStore } from '@/lib/store/app';
import { Button } from '@/components/ui/button';
import { FileText, Eye, Download, AlertTriangle, Clock, Printer } from 'lucide-react';
import { generateInvestigationReport, downloadReport } from '@/lib/generateReport';
import { ConfidenceMeter } from '@/components/tracepoint/shared/ConfidenceMeter';

export default function ReportsView() {
  const { investigations, aiAssessment, selectInvestigation } = useInvestigationStore();
  const { navigate } = useNavStore();

  const completed = investigations.filter((i) => i.status === 'completed');

  const handleDownload = (inv: typeof completed[0]) => {
    // Get the AI assessment for this investigation
    const isCurrent = useInvestigationStore.getState().currentInvestigation?.id === inv.id;
    const ai = isCurrent ? aiAssessment : null;
    downloadReport(inv, ai);
  };

  const handlePrint = (inv: typeof completed[0]) => {
    const isCurrent = useInvestigationStore.getState().currentInvestigation?.id === inv.id;
    const ai = isCurrent ? aiAssessment : null;
    const html = generateInvestigationReport(inv, ai);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => { printWindow.print(); };
    }
  };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Investigation Reports</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              View, print, or export formal investigation reports
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="intel-badge">{completed.length} REPORTS</span>
          </div>
        </div>

        {completed.length === 0 ? (
          <div className="surface p-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No completed investigations</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Complete an investigation to generate a report</p>
          </div>
        ) : (
          <div className="space-y-3">
            {completed.map((inv) => (
              <div
                key={inv.id}
                className={`surface p-4 ${inv.isDemoData ? 'demo-mark relative' : ''}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-[#c8a24e] shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">
                        Report: {inv.inputName || inv.inputPhone || inv.inputEmail || inv.id.slice(0, 8)}
                      </span>
                      {inv.isDemoData && (
                        <span className="flex items-center gap-0.5 text-[9px] font-mono text-[#c8a24e] uppercase shrink-0">
                          <AlertTriangle className="w-2.5 h-2.5" /> Demo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground ml-6">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(inv.completedAt || inv.createdAt).toLocaleDateString()}
                      </span>
                      <span>{inv.evidenceCount} evidence</span>
                      <span>{inv.sourceCount} sources</span>
                    </div>
                    <div className="ml-6 mt-2 max-w-[200px]">
                      <ConfidenceMeter score={inv.confidence || 0} size="sm" showLabel={false} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { selectInvestigation(inv.id); navigate('investigation-detail', inv.id); }}
                      className="border-border text-muted-foreground hover:text-[#c8a24e] hover:border-[#c8a24e]/30 text-xs h-8"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrint(inv)}
                      className="border-border text-muted-foreground hover:text-[#c8a24e] hover:border-[#c8a24e]/30 text-xs h-8"
                    >
                      <Printer className="w-3 h-3 mr-1" />
                      Print
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(inv)}
                      className="border-[#c8a24e]/30 text-[#c8a24e] hover:bg-[#c8a24e]/10 text-xs h-8"
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