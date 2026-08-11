'use client';

import { useState, useCallback, useEffect } from 'react';
import { useInvestigationStore, useNavStore, useSettingsStore } from '@/lib/store/app';
import { Crosshair, Upload, Zap, Target, Shield, Globe, ChevronDown } from 'lucide-react';
import type { InvestigationDepth } from '@/lib/types';
import { ConfidenceMeter } from '@/components/tracepoint/shared/ConfidenceMeter';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { saveInvestigation } from '@/lib/supabase/data';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 10 && !phone.startsWith('+')) return `+1${digits}`;
  return `+${digits}`;
}

function getCountryFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('1') && digits.length >= 11) return 'US';
  if (digits.startsWith('44')) return 'GB';
  if (digits.startsWith('234')) return 'NG';
  if (digits.startsWith('49')) return 'DE';
  if (digits.startsWith('33')) return 'FR';
  if (digits.startsWith('86')) return 'CN';
  if (digits.startsWith('91')) return 'IN';
  if (digits.startsWith('55')) return 'BR';
  if (digits.startsWith('81')) return 'JP';
  if (digits.startsWith('82')) return 'KR';
  if (digits.startsWith('39')) return 'IT';
  if (digits.startsWith('34')) return 'ES';
  if (digits.startsWith('7')) return 'RU';
  if (digits.startsWith('65')) return 'SG';
  if (digits.startsWith('61')) return 'AU';
  if (digits.startsWith('27')) return 'ZA';
  if (digits.startsWith('20')) return 'EG';
  if (digits.startsWith('971')) return 'AE';
  if (digits.startsWith('966')) return 'SA';
  if (digits.startsWith('91')) return 'IN';
  return '';
}

const countryNames: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', NG: 'Nigeria', DE: 'Germany',
  FR: 'France', CN: 'China', IN: 'India', BR: 'Brazil', JP: 'Japan',
  KR: 'South Korea', IT: 'Italy', ES: 'Spain', RU: 'Russia', SG: 'Singapore',
  AU: 'Australia', ZA: 'South Africa', EG: 'Egypt', AE: 'UAE', SA: 'Saudi Arabia',
};

const depths: Array<{ value: InvestigationDepth; label: string; desc: string; icon: React.ElementType }> = [
  { value: 'quick', label: 'Quick', desc: '~30s', icon: Zap },
  { value: 'standard', label: 'Standard', desc: '~2min', icon: Target },
  { value: 'deep', label: 'Deep', desc: '~5min', icon: Shield },
];

export default function InvestigationWorkspace() {
  const { startInvestigation, isRunning, progress, currentInvestigation, aiAssessment } = useInvestigationStore();
  const { navigate } = useNavStore();
  const { settings } = useSettingsStore();

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [depth, setDepth] = useState<InvestigationDepth>('standard');

  const normalizedPhone = phone ? normalizePhone(phone) : '';
  const detectedCountryCode = phone ? getCountryFromPhone(phone) : '';
  const detectedCountryName = detectedCountryCode ? (countryNames[detectedCountryCode] || detectedCountryCode) : '';

  const [hasPhone, hasEmail] = [!!phone.trim(), !!email.trim()];
  const canSubmit = hasPhone || hasEmail;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await startInvestigation({});
  };

  const handleSubmit = async () => {
    await startInvestigation({
      phone: phone || undefined,
      phoneNormalized: normalizedPhone || undefined,
      email: email || undefined,
      country: detectedCountryCode || undefined,
      depth,
    });
  };

  const isCompleted = currentInvestigation?.status === 'completed';

  // Auto-save to Supabase when investigation completes
  useEffect(() => {
    if (currentInvestigation?.status === 'completed' && isSupabaseConfigured()) {
      saveInvestigation(currentInvestigation);
    }
  }, [currentInvestigation?.status]);

  return (
    <div className="p-4 lg:p-6 h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-base font-semibold text-foreground">New Investigation</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Enter a phone number and/or email. Country is auto-detected.</p>
        </div>

        {/* Input Form */}
        {!isCompleted && !isRunning && (
          <div className="surface p-5 space-y-4">
            {/* Phone */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="mono-label">Phone Number</label>
                {normalizedPhone && (
                  <span className="mono-label text-[10px]">
                    {normalizedPhone}
                    {detectedCountryName && <span className="text-foreground ml-1.5">{detectedCountryName}</span>}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 234 5678"
                  className="w-full px-3 py-2 bg-accent border border-border rounded text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
                {detectedCountryCode && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">{detectedCountryCode}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="mono-label">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3 py-2 bg-accent border border-border rounded text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Depth */}
            <div className="space-y-1.5">
              <label className="mono-label">Investigation Depth</label>
              <div className="flex gap-2">
                {depths.map(({ value, label, desc, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setDepth(value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded border text-xs transition-colors ${
                      depth === value
                        ? 'border-[#c8a24e]/40 bg-[#c8a24e]/8 text-[#c8a24e]'
                        : 'border-border text-muted-foreground hover:border-[#c8a24e]/20 hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <div className="text-left">
                      <div>{label}</div>
                      <div className="text-[10px] opacity-60">{desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 py-2 bg-[#c8a24e] hover:bg-[#c8a24e]/85 text-background font-medium text-sm rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Crosshair className="w-3.5 h-3.5 inline mr-1.5" />
                Start Investigation
              </button>
              <label className="flex items-center gap-1.5 px-3 py-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Batch
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            {!isSupabaseConfigured() && (
              <p className="text-[10px] text-muted-foreground">
                Supabase not configured — investigations will be saved to local storage only.
                {!settings.aiApiKey && ' Add OpenAI API key in Settings for AI assessments.'}
              </p>
            )}
          </div>
        )}

        {/* Progress */}
        {isRunning && progress && (
          <div className="surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Running investigation...</span>
              <span className="mono-value text-sm">{progress.progress}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress.progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{progress.message}</p>
          </div>
        )}

        {/* Results */}
        {isCompleted && currentInvestigation && (
          <div className="space-y-4">
            {/* Config Error Banner */}
            {currentInvestigation.timeline.some(t => t.eventType === 'error' && t.metadata?.isConfigError) && (
              <div className="p-4 rounded bg-[#c8a24e]/6 border border-[#c8a24e]/20">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#c8a24e]/10 border border-[#c8a24e]/15 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[#c8a24e] text-xs font-bold">!</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#c8a24e]">API Keys Not Configured</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      Some API providers returned configuration errors. The investigation completed with limited data.
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                      To fix: Go to <strong>Netlify → Site Settings → Environment variables</strong> and add the missing keys. For local dev, add them to <code className="text-[10px] bg-accent px-1 rounded">.env.local</code>.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {currentInvestigation.timeline
                        .filter(t => t.eventType === 'error' && t.metadata?.isConfigError)
                        .flatMap(t => t.metadata?.warnings || [])
                        .map((w: any, i: number) => (
                          <span key={i} className="text-[9px] mono-label px-1.5 py-0.5 rounded bg-[#c8a24e]/8 text-[#c8a24e]/70">
                            {w.stage}: {w.message}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Confidence Score */}
            <div className="surface p-4 surface-highlight relative">
              <ConfidenceMeter score={currentInvestigation.confidence || 0} size="lg" showLabel={true} animated />
              {currentInvestigation.summary && (
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{currentInvestigation.summary}</p>
              )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Identities', value: currentInvestigation.identityCount },
                { label: 'Evidence', value: currentInvestigation.evidenceCount },
                { label: 'Sources', value: currentInvestigation.sourceCount },
              ].map((s) => (
                <div key={s.label} className="surface p-3">
                  <div className="mono-label text-[9px]">{s.label}</div>
                  <div className="text-lg font-semibold font-mono mt-0.5 text-foreground">{s.value}</div>
                </div>
              ))}
            </div>

            {/* AI Assessment */}
            {aiAssessment && (
              <div className="surface p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">AI Assessment</h3>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                    aiAssessment.confidence.level === 'HIGH' ? 'bg-[#4a9e5a]/10 text-[#4a9e5a]' :
                    aiAssessment.confidence.level === 'MODERATE' ? 'bg-[#c8a24e]/10 text-[#c8a24e]' : 'bg-accent text-muted-foreground'
                  }`}>
                    {aiAssessment.confidence.level} — {aiAssessment.confidence.score}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{aiAssessment.summary}</p>
                <p className="text-sm text-foreground leading-relaxed">{aiAssessment.conclusion}</p>
                {aiAssessment.recommendations.length > 0 && (
                  <div className="space-y-1">
                    <div className="mono-label text-[9px]">Recommendations</div>
                    {aiAssessment.recommendations.map((r, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{r}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => navigate('investigation-detail', currentInvestigation.id)}
                className="flex-1 py-2 bg-[#c8a24e]/10 border border-[#c8a24e]/20 text-[#c8a24e] text-sm rounded hover:bg-[#c8a24e]/15 transition-colors"
              >
                View Full Report
              </button>
              <button
                onClick={() => useInvestigationStore.getState().clearCurrent()}
                className="py-2 px-4 border border-border text-muted-foreground text-sm rounded hover:text-foreground hover:bg-accent transition-colors"
              >
                New
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}