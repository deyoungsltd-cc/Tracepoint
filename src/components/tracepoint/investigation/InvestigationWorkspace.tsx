'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Phone,
  Mail,
  User,
  Building2,
  MapPin,
  Search,
  Upload,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Target,
  Database,
  ChevronRight,
  Shield,
  Zap,
  Eye,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useInvestigationStore } from '@/lib/store/app';
import type { InvestigationDepth } from '@/lib/types';

// --- Phone normalization ---
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
  return `+${digits}`;
}

// --- Country list ---
const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'JP', label: 'Japan' },
  { value: 'BR', label: 'Brazil' },
  { value: 'IN', label: 'India' },
  { value: 'MX', label: 'Mexico' },
];

// --- Depth options ---
const DEPTH_OPTIONS: { value: InvestigationDepth; label: string; desc: string; icon: typeof Zap }[] = [
  { value: 'quick', label: 'QUICK', desc: '30s scan', icon: Zap },
  { value: 'standard', label: 'STANDARD', desc: '2 min deep', icon: Target },
  { value: 'deep', label: 'DEEP', desc: '5 min full', icon: Shield },
];

// --- Confidence meter SVG ---
function ConfidenceMeter({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80
      ? '#22c55e'
      : score >= 50
        ? '#f59e0b'
        : '#ef4444';

  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      <svg className="tp-confidence-ring w-28 h-28" viewBox="0 0 100 100">
        {/* Track */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#2a3322"
          strokeWidth="6"
        />
        {/* Fill */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="tp-hud text-[0.6rem]">confidence</span>
      </div>
    </div>
  );
}

// --- Stat card ---
function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Target;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="tp-bracket-card tp-panel rounded-sm p-4 flex items-center gap-3">
      <div
        className="flex items-center justify-center w-9 h-9 rounded-sm"
        style={{ background: `${color}15` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="tp-hud text-[0.65rem]">{label}</p>
        <p className="tp-hud-value text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

// ==============================================================
// MAIN COMPONENT
// ==============================================================
export default function InvestigationWorkspace() {
  const {
    currentInvestigation,
    progress,
    isRunning,
    aiAssessment,
    startInvestigation,
    startBatchInvestigation,
    clearCurrent,
  } = useInvestigationStore();

  // Form state
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [country, setCountry] = useState('US');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [depth, setDepth] = useState<InvestigationDepth>('standard');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCompleted =
    currentInvestigation?.status === 'completed' && !isRunning;

  const handleSubmit = useCallback(async () => {
    const query: Record<string, string> = { depth };
    if (phone.trim()) query.phone = phone.trim();
    if (email.trim()) query.email = email.trim();
    if (name.trim()) query.name = name.trim();
    if (business.trim()) query.business = business.trim();
    if (country) query.country = country;
    if (state.trim()) query.state = state.trim();
    if (city.trim()) query.city = city.trim();
    await startInvestigation(query);
  }, [phone, email, name, business, country, state, city, depth, startInvestigation]);

  const handleBatchUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        startBatchInvestigation(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [startBatchInvestigation],
  );

  const handleClear = useCallback(() => {
    clearCurrent();
    setPhone('');
    setEmail('');
    setName('');
    setBusiness('');
    setCountry('US');
    setState('');
    setCity('');
    setDepth('standard');
  }, [clearCurrent]);

  // Derive location display
  const locationLabel =
    currentInvestigation?.locationStatus === 'live'
      ? 'LIVE'
      : currentInvestigation?.locationStatus === 'last_known'
        ? 'LAST KNOWN'
        : currentInvestigation?.locationStatus === 'historical'
          ? 'HISTORICAL'
          : 'UNAVAILABLE';

  const locationColor =
    currentInvestigation?.locationStatus === 'live'
      ? '#22c55e'
      : currentInvestigation?.locationStatus === 'last_known'
        ? '#f59e0b'
        : '#8a9a8a';

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-4xl mx-auto w-full">
      {/* ========== FORM SECTION ========== */}
      {!isCompleted && (
        <>
          {/* Header */}
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-[#f59e0b]" />
            <div>
              <h2 className="text-sm font-semibold text-[#e8e8e0] tracking-wide uppercase">
                New Investigation
              </h2>
              <p className="tp-hud text-[0.65rem] mt-0.5">
                Enter identifiers to begin OSINT analysis
              </p>
            </div>
          </div>

          <Separator className="bg-[#3a4a3a]" />

          {/* Form panel */}
          <div className="tp-panel rounded-sm p-5">
            {/* Identifier inputs - 2 col on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Phone */}
              <div className="space-y-1.5">
                <Label className="tp-hud flex items-center gap-1.5">
                  <Phone className="w-3 h-3" />
                  PHONE
                </Label>
                <Input
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-[#121614] border-[#3a4a3a] text-[#e8e8e0] font-mono placeholder:text-[#5a6a5a] focus:border-[#f59e0b] focus:ring-[#f59e0b]/20 h-9 text-sm"
                />
                {phone && (
                  <p className="tp-hud text-[0.6rem]">
                    E.164: <span className="tp-hud-value">{normalizePhone(phone)}</span>
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="tp-hud flex items-center gap-1.5">
                  <Mail className="w-3 h-3" />
                  EMAIL
                </Label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[#121614] border-[#3a4a3a] text-[#e8e8e0] font-mono placeholder:text-[#5a6a5a] focus:border-[#f59e0b] focus:ring-[#f59e0b]/20 h-9 text-sm"
                />
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label className="tp-hud flex items-center gap-1.5">
                  <User className="w-3 h-3" />
                  NAME
                </Label>
                <Input
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-[#121614] border-[#3a4a3a] text-[#e8e8e0] placeholder:text-[#5a6a5a] focus:border-[#f59e0b] focus:ring-[#f59e0b]/20 h-9 text-sm"
                />
              </div>

              {/* Business */}
              <div className="space-y-1.5">
                <Label className="tp-hud flex items-center gap-1.5">
                  <Building2 className="w-3 h-3" />
                  BUSINESS
                </Label>
                <Input
                  placeholder="Acme Corp"
                  value={business}
                  onChange={(e) => setBusiness(e.target.value)}
                  className="bg-[#121614] border-[#3a4a3a] text-[#e8e8e0] placeholder:text-[#5a6a5a] focus:border-[#f59e0b] focus:ring-[#f59e0b]/20 h-9 text-sm"
                />
              </div>
            </div>

            {/* Region section */}
            <div className="mt-5">
              <p className="tp-hud flex items-center gap-1.5 mb-3">
                <MapPin className="w-3 h-3" />
                REGION
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="bg-[#121614] border-[#3a4a3a] text-[#e8e8e0] h-9 text-sm font-mono">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a201c] border-[#3a4a3a]">
                    {COUNTRIES.map((c) => (
                      <SelectItem
                        key={c.value}
                        value={c.value}
                        className="text-[#e8e8e0] focus:bg-[#2a3322] focus:text-[#f59e0b]"
                      >
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="State / Province"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="bg-[#121614] border-[#3a4a3a] text-[#e8e8e0] placeholder:text-[#5a6a5a] focus:border-[#f59e0b] focus:ring-[#f59e0b]/20 h-9 text-sm"
                />

                <Input
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="bg-[#121614] border-[#3a4a3a] text-[#e8e8e0] placeholder:text-[#5a6a5a] focus:border-[#f59e0b] focus:ring-[#f59e0b]/20 h-9 text-sm"
                />
              </div>
            </div>

            {/* Depth selector */}
            <div className="mt-5">
              <p className="tp-hud mb-3">INVESTIGATION DEPTH</p>
              <div className="grid grid-cols-3 gap-3">
                {DEPTH_OPTIONS.map((opt) => {
                  const isActive = depth === opt.value;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDepth(opt.value)}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-sm border transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'bg-[#2a3322] border-[#f59e0b] text-[#f59e0b]'
                          : 'bg-[#121614] border-[#3a4a3a] text-[#8a9a8a] hover:border-[#5a6a5a] hover:text-[#e8e8e0]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="tp-hud text-[0.65rem]">{opt.label}</span>
                      <span className="text-[0.6rem] opacity-60">{opt.desc}</span>
                      {isActive && (
                        <div className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleSubmit}
                disabled={isRunning}
                className="flex-1 sm:flex-none h-10 px-8 bg-[#f59e0b] text-[#121614] font-bold tracking-wider uppercase text-sm hover:bg-[#d97706] rounded-sm transition-colors cursor-pointer"
              >
                <Search className="w-4 h-4" />
                {isRunning ? 'RUNNING...' : 'START INVESTIGATION'}
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleBatchUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isRunning}
                className="h-10 px-6 border-[#3a4a3a] text-[#8a9a8a] hover:border-[#5a6a5a] hover:text-[#e8e8e0] hover:bg-[#2a3322] rounded-sm uppercase text-xs tracking-wider transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Batch Upload
              </Button>
            </div>
          </div>

          {/* ========== PROGRESS SECTION ========== */}
          {isRunning && progress && (
            <div className="tp-panel rounded-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#f59e0b] tp-pulse" />
                  <span className="tp-hud text-xs">INVESTIGATION IN PROGRESS</span>
                </div>
                <span className="tp-hud-value text-xs font-mono">
                  {progress.progress}%
                </span>
              </div>

              {/* Custom progress bar */}
              <div className="tp-progress-track mb-3">
                <div
                  className="tp-progress-fill"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>

              <div className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3 text-[#f59e0b]" />
                <span className="text-sm text-[#e8e8e0]">{progress.message}</span>
              </div>

              <p className="tp-hud text-[0.6rem] mt-2 opacity-60">
                Stage: <span className="uppercase">{progress.stage}</span>
              </p>
            </div>
          )}
        </>
      )}

      {/* ========== RESULTS SECTION ========== */}
      {isCompleted && currentInvestigation && (
        <>
          {/* Demo watermark banner */}
          {currentInvestigation.isDemoData && (
            <div className="tp-demo-watermark tp-panel rounded-sm p-3 border-[#f59e0b]/30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#f59e0b] tp-pulse" />
                <span className="tp-hud text-xs text-[#f59e0b]">
                  DEMO DATA — THIS INVESTIGATION USES SIMULATED RESULTS
                </span>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />
              <div>
                <h2 className="text-sm font-semibold text-[#e8e8e0] tracking-wide uppercase">
                  Investigation Complete
                </h2>
                <p className="tp-hud text-[0.65rem] mt-0.5">
                  ID: {currentInvestigation.id} · Depth:{' '}
                  <span className="tp-hud-value">
                    {currentInvestigation.depth.toUpperCase()}
                  </span>
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={handleClear}
              className="text-[#8a9a8a] hover:text-[#e8e8e0] hover:bg-[#2a3322] text-xs uppercase tracking-wider h-8 cursor-pointer"
            >
              New Investigation
            </Button>
          </div>

          <Separator className="bg-[#3a4a3a]" />

          {/* Summary stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={User}
              label="Identities"
              value={currentInvestigation.identityCount}
              color="#f59e0b"
            />
            <StatCard
              icon={FileText}
              label="Evidence"
              value={currentInvestigation.evidenceCount}
              color="#22c55e"
            />
            <StatCard
              icon={Database}
              label="Sources"
              value={currentInvestigation.sourceCount}
              color="#3b82f6"
            />
            <StatCard
              icon={
                currentInvestigation.hasConflicts ? AlertTriangle : CheckCircle2
              }
              label="Conflicts"
              value={currentInvestigation.hasConflicts ? 'YES' : 'NONE'}
              color={currentInvestigation.hasConflicts ? '#ef4444' : '#22c55e'}
            />
          </div>

          {/* Confidence + AI Assessment row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Confidence panel */}
            <div className="tp-bracket-card tp-panel rounded-sm p-5">
              <p className="tp-hud text-xs mb-4">CONFIDENCE SCORE</p>
              <div className="flex items-center gap-5">
                <ConfidenceMeter
                  score={currentInvestigation.confidence ?? 0}
                />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor:
                          (currentInvestigation.confidence ?? 0) >= 80
                            ? '#22c55e'
                            : (currentInvestigation.confidence ?? 0) >= 50
                              ? '#f59e0b'
                              : '#ef4444',
                      }}
                    />
                    <span
                      className="tp-hud-value text-xs font-bold uppercase"
                      style={{
                        color:
                          (currentInvestigation.confidence ?? 0) >= 80
                            ? '#22c55e'
                            : (currentInvestigation.confidence ?? 0) >= 50
                              ? '#f59e0b'
                              : '#ef4444',
                      }}
                    >
                      {(currentInvestigation.confidence ?? 0) >= 80
                        ? 'HIGH'
                        : (currentInvestigation.confidence ?? 0) >= 50
                          ? 'MODERATE'
                          : 'LOW'}
                    </span>
                  </div>

                  {/* Location status */}
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin
                      className="w-3 h-3"
                      style={{ color: locationColor }}
                    />
                    <span
                      className="tp-hud text-[0.65rem]"
                      style={{ color: locationColor }}
                    >
                      LOCATION: {locationLabel}
                    </span>
                  </div>

                  {currentInvestigation.hasConflicts && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <AlertTriangle className="w-3 h-3 text-[#ef4444]" />
                      <span className="text-[0.65rem] text-[#ef4444] font-mono">
                        CONFLICTING EVIDENCE DETECTED
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* AI Assessment panel */}
            {aiAssessment && (
              <div className="tp-bracket-card tp-panel rounded-sm p-5">
                <p className="tp-hud text-xs mb-3">AI ASSESSMENT</p>

                <p className="text-sm text-[#e8e8e0] leading-relaxed mb-3">
                  {aiAssessment.summary}
                </p>

                <div
                  className={`text-xs font-mono p-2.5 rounded-sm mb-3 border ${
                    (currentInvestigation.confidence ?? 0) >= 80
                      ? 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e]'
                      : (currentInvestigation.confidence ?? 0) >= 50
                        ? 'bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]'
                        : 'bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]'
                  }`}
                >
                  {aiAssessment.conclusion}
                </div>

                {aiAssessment.recommendations.length > 0 && (
                  <div className="space-y-1">
                    <p className="tp-hud text-[0.6rem]">RECOMMENDATIONS</p>
                    {aiAssessment.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <ChevronRight className="w-3 h-3 text-[#f59e0b] mt-0.5 shrink-0" />
                        <span className="text-xs text-[#8a9a8a]">{rec}</span>
                      </div>
                    ))}
                  </div>
                )}

                {aiAssessment.missingEvidence.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="tp-hud text-[0.6rem]">MISSING EVIDENCE</p>
                    {aiAssessment.missingEvidence.map((me, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-[#8a9a8a] mt-1.5 shrink-0" />
                        <span className="text-xs text-[#5a6a5a]">{me}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Investigation metadata */}
          <div className="tp-panel rounded-sm p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="tp-hud text-[0.6rem]">INPUT IDENTIFIERS</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {currentInvestigation.inputPhone && (
                    <Badge
                      variant="outline"
                      className="tp-source-tag border-[#3a4a3a] text-[0.65rem]"
                    >
                      <Phone className="w-2.5 h-2.5 mr-1" />
                      {currentInvestigation.inputPhone}
                    </Badge>
                  )}
                  {currentInvestigation.inputEmail && (
                    <Badge
                      variant="outline"
                      className="tp-source-tag border-[#3a4a3a] text-[0.65rem]"
                    >
                      <Mail className="w-2.5 h-2.5 mr-1" />
                      {currentInvestigation.inputEmail}
                    </Badge>
                  )}
                  {currentInvestigation.inputName && (
                    <Badge
                      variant="outline"
                      className="tp-source-tag border-[#3a4a3a] text-[0.65rem]"
                    >
                      <User className="w-2.5 h-2.5 mr-1" />
                      {currentInvestigation.inputName}
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="tp-hud text-[0.6rem]">REGION</p>
                <p className="tp-hud-value text-xs mt-1">
                  {[currentInvestigation.inputCity, currentInvestigation.inputState, currentInvestigation.inputCountry]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </p>
              </div>
              <div>
                <p className="tp-hud text-[0.6rem]">DURATION</p>
                <p className="tp-hud-value text-xs mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {currentInvestigation.startedAt && currentInvestigation.completedAt
                    ? `${Math.round((new Date(currentInvestigation.completedAt).getTime() - new Date(currentInvestigation.startedAt).getTime()) / 1000)}s`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="tp-hud text-[0.6rem]">DEPTH</p>
                <p className="tp-hud-value text-xs mt-1 uppercase">
                  {currentInvestigation.depth}
                </p>
              </div>
            </div>
          </div>

          {/* View full report button */}
          <Button
            onClick={() => {
              // Navigate would be handled by the nav store in real integration
              // For now, the component signals navigation intent
              window.dispatchEvent(
                new CustomEvent('tp-navigate', {
                  detail: { view: 'investigation-detail', id: currentInvestigation.id },
                }),
              );
            }}
            className="w-full h-11 bg-[#f59e0b] text-[#121614] font-bold tracking-wider uppercase text-sm hover:bg-[#d97706] rounded-sm transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            View Full Report
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Button>
        </>
      )}
    </div>
  );
}
