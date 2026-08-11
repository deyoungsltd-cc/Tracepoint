'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, Play, CheckCircle2, XCircle, Clock, Loader2, FileSpreadsheet, StopCircle, AlertCircle } from 'lucide-react';
import { useInvestigationStore, useNavStore } from '@/lib/store/app';
import { ConfidenceMeter } from '@/components/tracepoint/shared/ConfidenceMeter';
import type { InvestigationDepth } from '@/lib/types';

interface BatchEntry {
  id: string;
  phone: string;
  email: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  investigationId?: string;
  confidence?: number;
  identities?: number;
  evidence?: number;
  error?: string;
}

function parseCSV(text: string): Array<{ phone: string; email: string }> {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];
  const results: Array<{ phone: string; email: string }> = [];
  for (const line of lines) {
    const parts = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    if (parts.length >= 1) {
      const phone = parts[0].replace(/[^0-9+]/g, '');
      const email = parts[1] || '';
      if (phone.length >= 7 || email.includes('@')) {
        results.push({ phone, email });
      }
    }
  }
  return results;
}

function parseTextList(text: string): Array<{ phone: string; email: string }> {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.includes('@')) return { phone: '', email: trimmed };
    return { phone: trimmed.replace(/[^0-9+]/g, ''), email: '' };
  }).filter(e => e.phone.length >= 7 || e.email.includes('@'));
}

export function BatchLookup() {
  const { startInvestigation, investigations } = useInvestigationStore();
  const { navigate } = useNavStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const [entries, setEntries] = useState<BatchEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<'paste' | 'file'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [depth, setDepth] = useState<InvestigationDepth>('standard');
  const [processedCount, setProcessedCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleParse = useCallback(() => {
    if (mode === 'file') return;
    const items = pasteText.includes(',') ? parseCSV(pasteText) : parseTextList(pasteText);
    setEntries(items.map((item, i) => ({
      id: `batch-${i}-${Date.now()}`,
      phone: item.phone,
      email: item.email,
      status: 'pending',
    })));
  }, [pasteText, mode]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setPasteText(text);
      setMode('paste');
      const items = text.includes(',') ? parseCSV(text) : parseTextList(text);
      setEntries(items.map((item, i) => ({
        id: `batch-${i}-${Date.now()}`,
        phone: item.phone,
        email: item.email,
        status: 'pending',
      })));
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setPasteText(text);
      setMode('paste');
      const items = text.includes(',') ? parseCSV(text) : parseTextList(text);
      setEntries(items.map((item, i) => ({
        id: `batch-${i}-${Date.now()}`,
        phone: item.phone,
        email: item.email,
        status: 'pending',
      })));
    };
    reader.readAsText(file);
  }, []);

  const processAll = async () => {
    setIsProcessing(true);
    setProcessedCount(0);
    cancelRef.current = false;

    for (let i = 0; i < entries.length; i++) {
      if (cancelRef.current) {
        setEntries(prev => prev.map((e, idx) => idx >= i && e.status === 'pending' ? { ...e, status: 'cancelled' } : e));
        break;
      }

      const entry = entries[i];
      if (entry.status === 'completed' || entry.status === 'cancelled') {
        setProcessedCount(i + 1);
        continue;
      }

      setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, status: 'running' } : e));

      try {
        const phoneDigits = entry.phone.replace(/[^0-9]/g, '');
        const normalized = entry.phone.startsWith('+') ? entry.phone : `+${phoneDigits}`;

        await startInvestigation({
          phone: entry.phone || undefined,
          phoneNormalized: normalized || undefined,
          email: entry.email || undefined,
          depth,
        });

        const latest = useInvestigationStore.getState().currentInvestigation;
        if (latest) {
          setEntries(prev => prev.map((e, idx) => idx === i ? {
            ...e,
            status: 'completed',
            investigationId: latest.id,
            confidence: latest.confidence || 0,
            identities: latest.identityCount,
            evidence: latest.evidenceCount,
          } : e));
        }
      } catch {
        setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, status: 'failed', error: 'Investigation failed' } : e));
      }

      setProcessedCount(i + 1);
    }

    setIsProcessing(false);
  };

  const cancelProcessing = () => {
    cancelRef.current = true;
  };

  const removeEntry = (idx: number) => {
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const clearAll = () => {
    if (isProcessing) return;
    setEntries([]);
    setPasteText('');
  };

  const completedEntries = entries.filter(e => e.status === 'completed');
  const failedEntries = entries.filter(e => e.status === 'failed');
  const avgConfidence = completedEntries.length > 0
    ? Math.round(completedEntries.reduce((s, e) => s + (e.confidence || 0), 0) / completedEntries.length)
    : 0;

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground">Batch Lookup</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Process multiple phone numbers or emails at once. Supports CSV or one-per-line format.
          </p>
        </div>

        {/* Drop Zone / Input */}
        <div
          className={`surface p-4 mb-4 space-y-4 transition-colors ${isDragging ? 'border-[#c8a24e] bg-[#c8a24e]/5' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="flex items-center justify-center py-8 border-2 border-dashed border-[#c8a24e]/40 rounded">
              <div className="text-center">
                <Upload className="w-6 h-6 text-[#c8a24e] mx-auto mb-2" />
                <p className="text-sm text-[#c8a24e]">Drop CSV or text file here</p>
              </div>
            </div>
          )}

          {!isDragging && (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('paste')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors ${
                    mode === 'paste'
                      ? 'border-[#c8a24e]/40 bg-[#c8a24e]/8 text-[#c8a24e]'
                      : 'border-border text-muted-foreground hover:border-[#c8a24e]/20'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Paste List
                </button>
                <label
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors cursor-pointer ${
                    mode === 'file'
                      ? 'border-[#c8a24e]/40 bg-[#c8a24e]/8 text-[#c8a24e]'
                      : 'border-border text-muted-foreground hover:border-[#c8a24e]/20'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" /> Upload CSV
                  <input type="file" accept=".csv,.txt" className="hidden" ref={fileRef} onChange={handleFileUpload} />
                </label>
              </div>

              {mode === 'paste' && (
                <div className="space-y-2">
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={`+15552345678, user@example.com\n+442071234567\n+2348012345678`}
                    className="w-full h-32 px-3 py-2 bg-accent border border-border rounded text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-y"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleParse}
                      disabled={!pasteText.trim()}
                      className="px-3 py-1.5 bg-[#c8a24e]/10 border border-[#c8a24e]/20 text-[#c8a24e] text-xs rounded hover:bg-[#c8a24e]/15 transition-colors disabled:opacity-30"
                    >
                      Parse Entries
                    </button>
                    {entries.length > 0 && (
                      <button onClick={clearAll} className="px-3 py-1.5 border border-border text-muted-foreground text-xs rounded hover:text-foreground hover:bg-accent transition-colors">
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Depth Selector */}
              <div className="flex items-center gap-3">
                <span className="mono-label">Depth</span>
                <div className="flex gap-1">
                  {(['quick', 'standard', 'deep'] as InvestigationDepth[]).map(d => (
                    <button
                      key={d}
                      onClick={() => setDepth(d)}
                      disabled={isProcessing}
                      className={`px-2.5 py-1 rounded text-[10px] border transition-colors disabled:opacity-50 ${
                        depth === d
                          ? 'border-[#c8a24e]/40 bg-[#c8a24e]/8 text-[#c8a24e]'
                          : 'border-border text-muted-foreground hover:border-[#c8a24e]/20'
                      }`}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Entries Table */}
        {entries.length > 0 && (
          <div className="space-y-4">
            {/* Summary Bar */}
            <div className="surface p-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xs text-foreground font-medium">{entries.length} entries</span>
                <span className="text-[10px] text-muted-foreground">
                  {completedEntries.length} done · {failedEntries.length} failed
                </span>
              </div>
              {completedEntries.length > 0 && (
                <ConfidenceMeter score={avgConfidence} size="sm" showLabel={false} />
              )}
              <div className="flex gap-2">
                {isProcessing ? (
                  <button
                    onClick={cancelProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#b83a3a]/10 border border-[#b83a3a]/20 text-[#b83a3a] text-xs rounded hover:bg-[#b83a3a]/15 transition-colors"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                ) : (
                  <button
                    onClick={processAll}
                    disabled={entries.every(e => e.status === 'completed' || e.status === 'cancelled')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c8a24e] hover:bg-[#c8a24e]/85 text-background font-medium text-xs rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Process All
                  </button>
                )}
              </div>
            </div>

            {/* Progress */}
            {isProcessing && (
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${(processedCount / entries.length) * 100}%` }}
                />
              </div>
            )}

            {/* Entry List */}
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {entries.map((entry, idx) => (
                <div key={entry.id} className="surface p-3 flex items-center gap-3">
                  <div className="shrink-0">
                    {entry.status === 'pending' && <Clock className="w-4 h-4 text-muted-foreground" />}
                    {entry.status === 'running' && <Loader2 className="w-4 h-4 text-[#c8a24e] animate-spin" />}
                    {entry.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-[#4a9e5a]" />}
                    {entry.status === 'failed' && <XCircle className="w-4 h-4 text-[#b83a3a]" />}
                    {entry.status === 'cancelled' && <AlertCircle className="w-4 h-4 text-muted-foreground" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-foreground font-mono truncate">
                      {entry.phone || entry.email}
                    </div>
                    {entry.status === 'completed' && (
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span>{entry.identities} identities</span>
                        <span>{entry.evidence} evidence</span>
                        <span className={entry.confidence && entry.confidence >= 80 ? 'text-[#4a9e5a]' : entry.confidence && entry.confidence >= 50 ? 'text-[#c8a24e]' : ''}>
                          {entry.confidence}% conf.
                        </span>
                      </div>
                    )}
                    {entry.status === 'failed' && entry.error && (
                      <div className="text-[10px] text-[#b83a3a] mt-1">{entry.error}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {entry.status === 'completed' && entry.investigationId && (
                      <button
                        onClick={() => {
                          useInvestigationStore.getState().selectInvestigation(entry.investigationId!);
                          navigate('investigation-detail', entry.investigationId);
                        }}
                        className="text-[9px] text-[#c8a24e] hover:text-foreground transition-colors"
                      >
                        View →
                      </button>
                    )}
                    {!isProcessing && (
                      <button
                        onClick={() => removeEntry(idx)}
                        className="p-1 rounded hover:bg-[#b83a3a]/10 text-muted-foreground hover:text-[#b83a3a] transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {entries.length === 0 && mode === 'paste' && !isDragging && (
          <div className="surface p-12 text-center data-grid-bg">
            <Upload className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Paste phone numbers or emails above</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              One per line, or CSV format: phone, email. You can also drag &amp; drop a file.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
