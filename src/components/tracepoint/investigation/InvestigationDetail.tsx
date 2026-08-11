'use client';

import { useState, useMemo } from 'react';
import {
  Phone,
  Mail,
  User,
  Building2,
  MapPin,
  CheckCircle2,
  FileText,
  Database,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Clock,
  Eye,
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CircleDot,
  ImageIcon,
  Globe,
  History,
  Link2,
  ScrollText,
  Signal,
  Battery,
  Wifi,
  WifiOff,
  Camera,
  ExternalLink,
  Fingerprint,
  Crosshair,
  ListChecks,
  ClipboardList,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { useInvestigationStore, useNavStore } from '@/lib/store/app';
import type {
  VerificationStatus,
  LocationStatus,
  SourceCategory,
  IdentityCandidate,
  EvidenceItem,
  DeviceLocation,
  TimelineEvent,
} from '@/lib/types';

// ============================================================
// HELPERS
// ============================================================

function formatTimestamp(ts: string | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min}m ${remSec}s`;
}

function formatFullDate(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function confidenceColor(score: number): string {
  if (score >= 80) return '#f59e0b';
  if (score >= 50) return '#a3c944';
  return '#ef4444';
}

function confidenceLevel(score: number): string {
  if (score >= 80) return 'HIGH';
  if (score >= 50) return 'MODERATE';
  return 'LOW';
}

function reliabilityColor(score: number): string {
  if (score >= 90) return '#22c55e';
  if (score >= 70) return '#f59e0b';
  return '#ef4444';
}

function verificationDisplay(status: VerificationStatus): {
  label: string;
  color: string;
  bg: string;
  border: string;
  Icon: typeof ShieldCheck;
} {
  switch (status) {
    case 'verified':
      return {
        label: 'VERIFIED',
        color: '#22c55e',
        bg: 'rgba(34,197,94,0.1)',
        border: 'rgba(34,197,94,0.3)',
        Icon: ShieldCheck,
      };
    case 'strongly_corroborated':
      return {
        label: 'STRONGLY CORROBORATED',
        color: '#3b82f6',
        bg: 'rgba(59,130,246,0.1)',
        border: 'rgba(59,130,246,0.3)',
        Icon: Shield,
      };
    case 'possible':
      return {
        label: 'POSSIBLE',
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.1)',
        border: 'rgba(245,158,11,0.3)',
        Icon: ShieldAlert,
      };
    case 'unverified':
      return {
        label: 'UNVERIFIED',
        color: '#8a9a8a',
        bg: 'rgba(138,154,138,0.1)',
        border: 'rgba(138,154,138,0.3)',
        Icon: Shield,
      };
    case 'conflicting':
      return {
        label: 'CONFLICTING',
        color: '#ef4444',
        bg: 'rgba(239,68,68,0.1)',
        border: 'rgba(239,68,68,0.3)',
        Icon: ShieldX,
      };
    case 'unavailable':
    default:
      return {
        label: 'UNAVAILABLE',
        color: '#5a6a5a',
        bg: 'rgba(90,106,90,0.1)',
        border: 'rgba(90,106,90,0.3)',
        Icon: Shield,
      };
  }
}

function locationStatusDisplay(status: LocationStatus): {
  label: string;
  color: string;
  bg: string;
  border: string;
  pulse: boolean;
} {
  switch (status) {
    case 'live':
      return {
        label: 'LIVE',
        color: '#22c55e',
        bg: 'rgba(34,197,94,0.1)',
        border: 'rgba(34,197,94,0.3)',
        pulse: true,
      };
    case 'last_known':
      return {
        label: 'LAST KNOWN',
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.1)',
        border: 'rgba(245,158,11,0.3)',
        pulse: false,
      };
    case 'historical':
      return {
        label: 'HISTORICAL',
        color: '#8a9a8a',
        bg: 'rgba(138,154,138,0.1)',
        border: 'rgba(138,154,138,0.3)',
        pulse: false,
      };
    case 'unavailable':
    default:
      return {
        label: 'UNAVAILABLE',
        color: '#5a6a5a',
        bg: 'rgba(90,106,90,0.1)',
        border: 'rgba(90,106,90,0.3)',
        pulse: false,
      };
  }
}

function sourceTypeLabel(type: SourceCategory): string {
  const map: Record<SourceCategory, string> = {
    official_website: 'Official Website',
    business_directory: 'Business Directory',
    social_profile: 'Social Profile',
    news: 'News',
    registry: 'Registry',
    government_record: 'Government Record',
    professional_profile: 'Professional Profile',
    user_provided: 'User Provided',
    device_provider: 'Device Provider',
    web_search: 'Web Search',
  };
  return map[type] || type;
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof User;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="tp-panel rounded-sm p-4 flex items-center gap-3">
      <div
        className="w-9 h-9 rounded-sm flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="tp-hud text-[0.6rem]">{label}</p>
        <p className="tp-hud-value text-lg font-bold mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function ConfidenceRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = confidenceColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="tp-confidence-ring">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#2a3322"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="tp-hud-value text-lg font-bold"
          style={{ color }}
        >
          {score}%
        </span>
      </div>
    </div>
  );
}

function VerificationBadge({ status }: { status: VerificationStatus }) {
  const v = verificationDisplay(status);
  const Icon = v.Icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[0.6rem] font-mono uppercase tracking-wider border"
      style={{ color: v.color, backgroundColor: v.bg, borderColor: v.border }}
    >
      <Icon className="w-2.5 h-2.5" />
      {v.label}
    </span>
  );
}

function LocationStatusBadge({ status }: { status: LocationStatus }) {
  const ls = locationStatusDisplay(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[0.6rem] font-mono uppercase tracking-wider border ${
        ls.pulse ? 'tp-status-live' : ''
      }`}
      style={{
        color: ls.color,
        backgroundColor: ls.bg,
        borderColor: ls.border,
      }}
    >
      {ls.pulse && <span className="w-1.5 h-1.5 rounded-full tp-pulse" style={{ backgroundColor: ls.color }} />}
      <MapPin className="w-2.5 h-2.5" />
      {ls.label}
    </span>
  );
}

function BatteryIndicator({ level }: { level: number | null }) {
  if (level === null) return <span className="text-[#5a6a5a] text-xs">N/A</span>;
  const color = level > 60 ? '#22c55e' : level > 20 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-6 h-3 rounded-sm border border-[#3a4a3a] relative overflow-hidden">
        <div
          className="h-full rounded-sm"
          style={{ width: `${level}%`, backgroundColor: color, transition: 'width 0.3s' }}
        />
      </div>
      <span className="text-[0.65rem] font-mono" style={{ color }}>{level}%</span>
    </div>
  );
}

function ScoreCell({ score }: { score: number }) {
  const color = reliabilityColor(score);
  return (
    <span className="tp-hud-value text-xs font-bold font-mono" style={{ color }}>
      {score}
    </span>
  );
}

// ============================================================
// TAB CONTENTS
// ============================================================

function OverviewTab() {
  const { currentInvestigation, aiAssessment } = useInvestigationStore();
  const inv = currentInvestigation;
  if (!inv) return null;

  const locStatus = locationStatusDisplay(inv.locationStatus);
  const dur = formatDuration(inv.startedAt, inv.completedAt);

  return (
    <div className="space-y-5">
      {/* Executive summary */}
      <div className="tp-panel rounded-sm p-5">
        <p className="tp-hud text-xs mb-2">EXECUTIVE SUMMARY</p>
        <p className="text-sm text-[#e8e8e0] leading-relaxed">
          {inv.summary}
        </p>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={User} label="Identities" value={inv.identityCount} color="#f59e0b" />
        <StatCard icon={FileText} label="Evidence" value={inv.evidenceCount} color="#22c55e" />
        <StatCard icon={Database} label="Sources" value={inv.sourceCount} color="#3b82f6" />
        <StatCard
          icon={Crosshair}
          label="Confidence"
          value={`${inv.confidence ?? 0}%`}
          color={confidenceColor(inv.confidence ?? 0)}
        />
      </div>

      {/* Location status + Duration row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="tp-panel rounded-sm p-4 flex items-center justify-between">
          <div>
            <p className="tp-hud text-[0.6rem]">LOCATION STATUS</p>
            <div className="mt-1.5">
              <LocationStatusBadge status={inv.locationStatus} />
            </div>
          </div>
          {inv.hasConflicts && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-[#ef4444]" />
              <span className="text-[0.65rem] text-[#ef4444] font-mono">CONFLICTS</span>
            </div>
          )}
        </div>
        <div className="tp-panel rounded-sm p-4 flex items-center justify-between">
          <div>
            <p className="tp-hud text-[0.6rem]">DURATION</p>
            <p className="tp-hud-value text-sm font-mono mt-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {dur}
            </p>
          </div>
          <div>
            <p className="tp-hud text-[0.6rem]">DEPTH</p>
            <p className="tp-hud-value text-sm font-mono mt-1.5 uppercase">
              {inv.depth}
            </p>
          </div>
        </div>
      </div>

      {/* AI Assessment panel */}
      {aiAssessment && (
        <div className="tp-bracket-card tp-panel rounded-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Fingerprint className="w-4 h-4 text-[#f59e0b]" />
            <p className="tp-hud text-xs">AI ASSESSMENT</p>
          </div>

          {/* Summary + Confidence row */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 mb-4">
            <div>
              <p className="tp-hud text-[0.6rem] mb-1.5">SUMMARY</p>
              <p className="text-sm text-[#e8e8e0] leading-relaxed">
                {aiAssessment.summary}
              </p>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <ConfidenceRing score={aiAssessment.confidence.score} />
              <span
                className="tp-hud text-[0.6rem] font-bold"
                style={{ color: confidenceColor(aiAssessment.confidence.score) }}
                  >
                  {aiAssessment.confidence.level}
                </span>
              </div>
            </div>

            {/* Conclusion */}
            <div
              className="text-xs font-mono p-3 rounded-sm mb-4 border"
              style={{
                backgroundColor:
                  aiAssessment.confidence.score >= 80
                    ? 'rgba(34,197,94,0.08)'
                    : aiAssessment.confidence.score >= 50
                      ? 'rgba(245,158,11,0.08)'
                      : 'rgba(239,68,68,0.08)',
                borderColor:
                  aiAssessment.confidence.score >= 80
                    ? 'rgba(34,197,94,0.25)'
                    : aiAssessment.confidence.score >= 50
                      ? 'rgba(245,158,11,0.25)'
                      : 'rgba(239,68,68,0.25)',
                color:
                  aiAssessment.confidence.score >= 80
                    ? '#22c55e'
                    : aiAssessment.confidence.score >= 50
                      ? '#f59e0b'
                      : '#ef4444',
              }}
            >
              {aiAssessment.conclusion}
            </div>

            {/* Confidence breakdown */}
            <div className="mb-4">
              <p className="tp-hud text-[0.6rem] mb-2">CONFIDENCE BREAKDOWN</p>
              <p className="text-xs text-[#8a9a8a] leading-relaxed mb-2">
                {aiAssessment.confidence.explanation}
              </p>
              {aiAssessment.confidence.supportingEvidence.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {aiAssessment.confidence.supportingEvidence.map((s, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="tp-source-tag border-[#22c55e]/30 text-[#22c55e]"
                    >
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
              {aiAssessment.confidence.conflictingEvidence.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {aiAssessment.confidence.conflictingEvidence.map((s, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="tp-source-tag border-[#ef4444]/30 text-[#ef4444]"
                    >
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator className="bg-[#3a4a3a] mb-4" />

            {/* Recommendations */}
            {aiAssessment.recommendations.length > 0 && (
              <div className="mb-4">
                <p className="tp-hud text-[0.6rem] mb-2">RECOMMENDATIONS</p>
                <div className="space-y-1.5">
                  {aiAssessment.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ChevronRight className="w-3 h-3 text-[#f59e0b] mt-0.5 shrink-0" />
                      <span className="text-xs text-[#8a9a8a]">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing evidence */}
            {aiAssessment.missingEvidence.length > 0 && (
              <div>
                <p className="tp-hud text-[0.6rem] mb-2">MISSING EVIDENCE</p>
                <div className="space-y-1.5">
                  {aiAssessment.missingEvidence.map((me, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full bg-[#8a9a8a] mt-1.5 shrink-0" />
                      <span className="text-xs text-[#5a6a5a]">{me}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// IDENTITY TAB
// ============================================================

function IdentityCandidateCard({ candidate }: { candidate: IdentityCandidate }) {
  const [open, setOpen] = useState(false);
  const allEvidence = useInvestigationStore(
    (s) => s.currentInvestigation?.evidence || []
  );
  const relatedEvidence = useMemo(
    () => allEvidence.filter((e) => e.candidateId === candidate.id),
    [allEvidence, candidate.id]
  );

  const confColor = confidenceColor(candidate.confidence);
  const confLevel = confidenceLevel(candidate.confidence);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full tp-panel rounded-sm p-4 hover:border-[#5a6a5a] transition-colors cursor-pointer text-left">
          <div className="flex items-start justify-between gap-3">
            {/* Left: rank + identity info */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 bg-[#2a3322] border border-[#3a4a3a]">
                <span className="tp-hud-value text-sm font-bold">#{candidate.rank}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[#e8e8e0] truncate">
                    {candidate.name || 'Unknown'}
                  </span>
                  <VerificationBadge status={candidate.verifiedStatus} />
                </div>
                <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                  {candidate.phone && (
                    <span className="text-xs text-[#8a9a8a] flex items-center gap-1">
                      <Phone className="w-3 h-3" />{candidate.phone}
                    </span>
                  )}
                  {candidate.email && (
                    <span className="text-xs text-[#8a9a8a] flex items-center gap-1">
                      <Mail className="w-3 h-3" />{candidate.email}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 flex-wrap">
                  {candidate.business && (
                    <span className="text-xs text-[#8a9a8a] flex items-center gap-1">
                      <Building2 className="w-3 h-3" />{candidate.business}
                    </span>
                  )}
                  {candidate.website && (
                    <span className="text-xs text-[#8a9a8a] flex items-center gap-1 truncate max-w-[200px]">
                      <Globe className="w-3 h-3 shrink-0" />{candidate.website.replace(/^https?:\/\//, '')}
                    </span>
                  )}
                  {candidate.location && (
                    <span className="text-xs text-[#8a9a8a] flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{candidate.location}
                    </span>
                  )}
                </div>
                {/* Match fields as source-tags */}
                {candidate.matchFields.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {candidate.matchFields.map((f) => (
                      <Badge
                        key={f}
                        variant="outline"
                        className="tp-source-tag border-[#3a4a3a]"
                      >
                        {f}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: confidence + chevron */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <p className="tp-hud text-[0.55rem]">CONFIDENCE</p>
                <p className="text-sm font-bold font-mono" style={{ color: confColor }}>
                  {candidate.confidence}%
                </p>
                <p
                  className="tp-hud text-[0.55rem] font-bold"
                  style={{ color: confColor }}
                >
                  {confLevel}
                </p>
              </div>
              {open ? (
                <ChevronDown className="w-4 h-4 text-[#8a9a8a]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#8a9a8a]" />
              )}
            </div>
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 ml-4 border-l-2 border-[#3a4a3a] pl-4 py-2 space-y-2">
          <p className="tp-hud text-[0.6rem]">
            RELATED EVIDENCE ({relatedEvidence.length})
          </p>
          {relatedEvidence.length === 0 ? (
            <p className="text-xs text-[#5a6a5a] italic">No linked evidence items</p>
          ) : (
            relatedEvidence.map((ev) => (
              <div
                key={ev.id}
                className="tp-panel rounded-sm p-3"
              >
                <p className="text-xs text-[#e8e8e0] mb-1">{ev.claim}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="tp-source-tag border-[#3a4a3a]">
                    {sourceTypeLabel(ev.sourceType)}
                  </Badge>
                  <span className="text-[0.6rem] text-[#5a6a5a]">{ev.sourceName}</span>
                  <VerificationBadge status={ev.verificationStatus} />
                </div>
              </div>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function IdentityTab() {
  const candidates = useInvestigationStore(
    (s) => s.currentInvestigation?.candidates || []
  );

  return (
    <div className="space-y-3">
      {candidates.length === 0 ? (
        <EmptyState message="No identity candidates identified" />
      ) : (
        candidates.map((c) => (
          <IdentityCandidateCard key={c.id} candidate={c} />
        ))
      )}
    </div>
  );
}

// ============================================================
// EVIDENCE TAB
// ============================================================

function EvidenceRow({ item }: { item: EvidenceItem }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <tr className="hover:bg-[#2a3322]/40 transition-colors cursor-pointer border-b border-[#3a4a3a]/50">
          <td className="py-2.5 px-3 text-xs text-[#e8e8e0] max-w-[280px]">
            <div className="flex items-center gap-1.5">
              {open ? (
                <ChevronDown className="w-3 h-3 text-[#f59e0b] shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 text-[#8a9a8a] shrink-0" />
              )}
              <span className="truncate">{item.claim}</span>
            </div>
          </td>
          <td className="py-2.5 px-3">
            <Badge variant="outline" className="tp-source-tag border-[#3a4a3a]">
              {sourceTypeLabel(item.sourceType)}
            </Badge>
          </td>
          <td className="py-2.5 px-3 text-[0.65rem] text-[#8a9a8a] font-mono">
            {item.sourceName}
          </td>
          <td className="py-2.5 px-3 text-center">
            <ScoreCell score={item.reliabilityScore} />
          </td>
          <td className="py-2.5 px-3 text-center">
            <ScoreCell score={item.relevanceScore} />
          </td>
          <td className="py-2.5 px-3 text-center">
            <ScoreCell score={item.freshnessScore} />
          </td>
          <td className="py-2.5 px-3">
            <VerificationBadge status={item.verificationStatus} />
          </td>
        </tr>
      </CollapsibleTrigger>
      <tr>
        <td colSpan={7} className="p-0">
          <CollapsibleContent>
            <div className="bg-[#1a201c] border border-t-0 border-[#3a4a3a] rounded-b-sm p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="tp-hud text-[0.6rem] mb-1">SOURCE</p>
                  <p className="text-xs text-[#e8e8e0]">{item.sourceName}</p>
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#f59e0b] hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      {item.sourceUrl}
                    </a>
                  )}
                </div>
                <div>
                  <p className="tp-hud text-[0.6rem] mb-1">DISCOVERED</p>
                  <p className="text-xs text-[#8a9a8a] font-mono">
                    {formatFullDate(item.discoveredAt)}
                  </p>
                  {item.publishedAt && (
                    <p className="text-xs text-[#5a6a5a] mt-0.5">
                      Published: {formatFullDate(item.publishedAt)}
                    </p>
                  )}
                </div>
              </div>
              {item.excerpt && (
                <div className="mt-3">
                  <p className="tp-hud text-[0.6rem] mb-1">EXCERPT</p>
                  <p className="text-xs text-[#8a9a8a] italic leading-relaxed border-l-2 border-[#3a4a3a] pl-3">
                    &ldquo;{item.excerpt}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </td>
      </tr>
    </Collapsible>
  );
}

function EvidenceTab() {
  const evidence = useInvestigationStore(
    (s) => s.currentInvestigation?.evidence || []
  );

  return (
    <div>
      {evidence.length === 0 ? (
        <EmptyState message="No evidence items collected" />
      ) : (
        <div className="tp-panel rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#3a4a3a]">
                  <th className="py-2.5 px-3 tp-hud text-[0.6rem] font-normal">Claim</th>
                  <th className="py-2.5 px-3 tp-hud text-[0.6rem] font-normal">Type</th>
                  <th className="py-2.5 px-3 tp-hud text-[0.6rem] font-normal">Source</th>
                  <th className="py-2.5 px-3 tp-hud text-[0.6rem] font-normal text-center">Reliability</th>
                  <th className="py-2.5 px-3 tp-hud text-[0.6rem] font-normal text-center">Relevance</th>
                  <th className="py-2.5 px-3 tp-hud text-[0.6rem] font-normal text-center">Freshness</th>
                  <th className="py-2.5 px-3 tp-hud text-[0.6rem] font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((e) => (
                  <EvidenceRow key={e.id} item={e} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// LOCATION TAB
// ============================================================

function LocationCard({ location }: { location: DeviceLocation }) {
  return (
    <div className="tp-bracket-card tp-panel rounded-sm p-5">
      {/* Header: status + provider */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <LocationStatusBadge status={location.status} />
          <span className="tp-hud text-[0.6rem]">{location.provider.replace(/_/g, ' ').toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          {location.batteryLevel !== null && (
            <BatteryIndicator level={location.batteryLevel} />
          )}
          {location.networkType ? (
            <span className="flex items-center gap-1 text-xs text-[#8a9a8a]">
              <Signal className="w-3 h-3" />
              {location.networkType}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-[#5a6a5a]">
              <WifiOff className="w-3 h-3" />
              No network
            </span>
          )}
        </div>
      </div>

      {/* Last known label for last_known status */}
      {location.status === 'last_known' && (
        <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-sm bg-[#f59e0b]/5 border border-[#f59e0b]/20">
          <Clock className="w-3 h-3 text-[#f59e0b]" />
          <span className="text-[0.65rem] text-[#f59e0b] font-mono">
            LAST KNOWN POSITION — NOT CURRENTLY TRACKING
          </span>
        </div>
      )}

      {/* Address */}
      {location.address && (
        <div className="mb-3">
          <p className="tp-hud text-[0.6rem] mb-1">ADDRESS</p>
          <p className="text-sm text-[#e8e8e0] flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
            {location.address}
          </p>
        </div>
      )}

      {/* Coordinates + Accuracy + Device info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {location.latitude !== null && location.longitude !== null && (
          <div>
            <p className="tp-hud text-[0.6rem]">COORDINATES</p>
            <p className="tp-hud-value text-xs font-mono mt-1">
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </p>
          </div>
        )}
        {location.accuracy !== null && (
          <div>
            <p className="tp-hud text-[0.6rem]">ACCURACY</p>
            <p className="tp-hud-value text-xs font-mono mt-1">±{location.accuracy}m</p>
          </div>
        )}
        {location.timestamp && (
          <div>
            <p className="tp-hud text-[0.6rem]">TIMESTAMP</p>
            <p className="tp-hud-value text-xs font-mono mt-1">
              {formatTimestamp(location.timestamp)}
            </p>
          </div>
        )}
        <div>
          <p className="tp-hud text-[0.6rem]">DEVICE</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-xs text-[#e8e8e0] font-mono">
              {location.deviceId || 'Unknown'}
            </span>
            {location.deviceStatus && (
              <span
                className={`text-[0.6rem] font-mono px-1.5 py-0.5 rounded-sm border ${
                  location.deviceStatus === 'online'
                    ? 'text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e]/30'
                    : 'text-[#8a9a8a] bg-[#8a9a8a]/10 border-[#8a9a8a]/30'
                }`}
              >
                {location.deviceStatus.toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LocationTab() {
  const locations = useInvestigationStore(
    (s) => s.currentInvestigation?.locations || []
  );

  return (
    <div className="space-y-3">
      {locations.length === 0 ? (
        <EmptyState message="No location data available" />
      ) : (
        locations.map((loc) => (
          <LocationCard key={loc.id} location={loc} />
        ))
      )}
    </div>
  );
}

// ============================================================
// TIMELINE TAB
// ============================================================

function TimelineTab() {
  const timeline = useInvestigationStore(
    (s) => s.currentInvestigation?.timeline || []
  );

  if (timeline.length === 0) {
    return <EmptyState message="No timeline events recorded" />;
  }

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#3a4a3a]" />

      <div className="space-y-4">
        {timeline.map((event) => (
          <div key={event.id} className="relative flex gap-4">
            {/* Dot */}
            <div
              className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 ${
                event.eventType === 'completed'
                  ? 'bg-[#22c55e] border-[#22c55e]'
                  : event.eventType === 'started'
                    ? 'bg-[#f59e0b] border-[#f59e0b]'
                    : 'bg-[#1e2420] border-[#3a4a3a]'
              }`}
            />
            <div className="flex-1 tp-panel rounded-sm p-3">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="tp-hud text-[0.6rem] font-bold">
                  {event.eventType.toUpperCase()}
                </span>
                <span className="tp-hud text-[0.6rem]">
                  {formatFullDate(event.timestamp)}
                </span>
              </div>
              <p className="text-xs text-[#e8e8e0]">{event.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// STUB TABS (Photos, Businesses, Public Presence, Conflicts, Sources, Audit Log)
// ============================================================

function EmptyState({ message }: { message: string }) {
  return (
    <div className="tp-panel rounded-sm p-10 flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 rounded-full bg-[#2a3322] flex items-center justify-center">
        <Eye className="w-5 h-5 text-[#5a6a5a]" />
      </div>
      <p className="text-sm text-[#5a6a5a] text-center">{message}</p>
      <p className="tp-hud text-[0.55rem] text-[#3a4a3a]">
        No investigation selected
      </p>
    </div>
  );
}

function PhotosTab() {
  const candidates = useInvestigationStore(
    (s) => s.currentInvestigation?.candidates || []
  );
  const photos = candidates.filter((c) => c.photoUrl);

  return (
    <div>
      {photos.length === 0 ? (
        <EmptyState message="No photos discovered during investigation" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {photos.map((c) => (
            <div key={c.id} className="tp-panel rounded-sm p-4">
              <div className="aspect-square bg-[#2a3322] rounded-sm mb-3 flex items-center justify-center">
                <Camera className="w-8 h-8 text-[#3a4a3a]" />
              </div>
              <p className="text-sm text-[#e8e8e0]">{c.name}</p>
              <p className="text-xs text-[#8a9a8a]">{c.location}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BusinessesTab() {
  const candidates = useInvestigationStore(
    (s) => s.currentInvestigation?.candidates || []
  );
  const businesses = candidates.filter((c) => c.business);

  return (
    <div className="space-y-3">
      {businesses.length === 0 ? (
        <EmptyState message="No business associations discovered" />
      ) : (
        businesses.map((c) => (
          <div key={c.id} className="tp-panel rounded-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-sm bg-[#2a3322] flex items-center justify-center border border-[#3a4a3a]">
                <Building2 className="w-4 h-4 text-[#f59e0b]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#e8e8e0]">{c.business}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {c.website && (
                    <span className="text-xs text-[#8a9a8a] flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {c.website.replace(/^https?:\/\//, '')}
                    </span>
                  )}
                  {c.location && (
                    <span className="text-xs text-[#8a9a8a] flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{c.location}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-[#5a6a5a]">Associated with:</span>
              <span className="text-xs text-[#e8e8e0]">{c.name}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function PublicPresenceTab() {
  const evidence = useInvestigationStore(
    (s) => s.currentInvestigation?.evidence || []
  );
  const publicEvidence = evidence.filter(
    (e) =>
      e.sourceType === 'social_profile' ||
      e.sourceType === 'professional_profile' ||
      e.sourceType === 'official_website'
  );

  return (
    <div className="space-y-3">
      {publicEvidence.length === 0 ? (
        <EmptyState message="No public presence data discovered" />
      ) : (
        publicEvidence.map((ev) => (
          <div key={ev.id} className="tp-panel rounded-sm p-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Link2 className="w-3 h-3 text-[#f59e0b] shrink-0" />
                <p className="text-sm text-[#e8e8e0] truncate">{ev.sourceName}</p>
              </div>
              <p className="text-xs text-[#8a9a8a] leading-relaxed">{ev.claim}</p>
              {ev.sourceUrl && (
                <a
                  href={ev.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#f59e0b] hover:underline flex items-center gap-1 mt-1.5"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  Visit source
                </a>
              )}
            </div>
            <VerificationBadge status={ev.verificationStatus} />
          </div>
        ))
      )}
    </div>
  );
}

function ConflictsTab() {
  const evidence = useInvestigationStore(
    (s) => s.currentInvestigation?.evidence || []
  );
  const conflicts = evidence.filter((e) => e.verificationStatus === 'conflicting');
  const inv = useInvestigationStore((s) => s.currentInvestigation);

  return (
    <div className="space-y-4">
      {(!inv?.hasConflicts || conflicts.length === 0) ? (
        <div className="tp-panel rounded-sm p-10 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />
          </div>
          <p className="text-sm text-[#22c55e] text-center font-semibold">
            NO CONFLICTS DETECTED
          </p>
          <p className="text-xs text-[#8a9a8a] text-center">
            All evidence sources are in agreement. No contradictory information was found.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 p-3 rounded-sm bg-[#ef4444]/5 border border-[#ef4444]/20">
            <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
            <span className="text-xs text-[#ef4444] font-mono">
              {conflicts.length} CONFLICTING EVIDENCE ITEM{conflicts.length > 1 ? 'S' : ''} DETECTED
            </span>
          </div>
          {conflicts.map((ev) => (
            <div key={ev.id} className="tp-panel rounded-sm p-4 border-[#ef4444]/30">
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-[#ef4444] mt-0.5 shrink-0" />
                <p className="text-sm text-[#e8e8e0]">{ev.claim}</p>
              </div>
              <div className="flex items-center gap-2 ml-6">
                <Badge variant="outline" className="tp-source-tag border-[#ef4444]/30 text-[#ef4444]">
                  {sourceTypeLabel(ev.sourceType)}
                </Badge>
                <span className="text-xs text-[#8a9a8a]">{ev.sourceName}</span>
              </div>
              {ev.excerpt && (
                <p className="text-xs text-[#5a6a5a] italic mt-2 ml-6 border-l-2 border-[#ef4444]/30 pl-3">
                  &ldquo;{ev.excerpt}&rdquo;
                </p>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function SourcesTab() {
  const evidence = useInvestigationStore(
    (s) => s.currentInvestigation?.evidence || []
  );

  const sourceMap = useMemo(() => {
    const map = new Map<string, { name: string; type: SourceCategory; count: number; avgReliability: number; url: string | null }>();
    for (const ev of evidence) {
      const existing = map.get(ev.sourceName);
      if (existing) {
        existing.count += 1;
        existing.avgReliability = (existing.avgReliability + ev.reliabilityScore) / 2;
      } else {
        map.set(ev.sourceName, {
          name: ev.sourceName,
          type: ev.sourceType,
          count: 1,
          avgReliability: ev.reliabilityScore,
          url: ev.sourceUrl,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.avgReliability - a.avgReliability);
  }, [evidence]);

  return (
    <div className="space-y-2">
      {sourceMap.length === 0 ? (
        <EmptyState message="No sources referenced" />
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-[#f59e0b]" />
            <p className="tp-hud text-xs">{sourceMap.length} UNIQUE SOURCES</p>
          </div>
          {sourceMap.map((src, i) => (
            <div key={src.name} className="tp-panel rounded-sm p-3 flex items-center gap-3">
              <span className="tp-hud text-[0.6rem] text-[#5a6a5a] w-6 text-right">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-[#e8e8e0] truncate">{src.name}</span>
                  <Badge variant="outline" className="tp-source-tag border-[#3a4a3a]">
                    {sourceTypeLabel(src.type)}
                  </Badge>
                </div>
                {src.url && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[0.65rem] text-[#f59e0b]/70 hover:text-[#f59e0b] flex items-center gap-1 mt-0.5"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    {src.url}
                  </a>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="tp-hud text-[0.55rem]">EVIDENCE</p>
                <p className="tp-hud-value text-sm font-bold">{src.count}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="tp-hud text-[0.55rem]">AVG REL</p>
                <ScoreCell score={Math.round(src.avgReliability)} />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function AuditLogTab() {
  const inv = useInvestigationStore((s) => s.currentInvestigation);

  // Build audit events from investigation timeline + metadata
  const auditEvents = useMemo(() => {
    if (!inv) return [];
    const events: Array<{
      id: string;
      action: string;
      detail: string;
      timestamp: string;
    }> = [];

    events.push({
      id: 'audit-created',
      action: 'INVESTIGATION.CREATED',
      detail: `Investigation ${inv.id} created — depth: ${inv.depth}`,
      timestamp: inv.createdAt,
    });

    if (inv.startedAt) {
      events.push({
        id: 'audit-started',
        action: 'INVESTIGATION.STARTED',
        detail: `Processing initiated. Input: ${[inv.inputPhone, inv.inputEmail, inv.inputName, inv.inputBusiness].filter(Boolean).join(' / ')}`,
        timestamp: inv.startedAt,
      });
    }

    for (const tl of inv.timeline) {
      events.push({
        id: tl.id,
        action: `STAGE.${tl.eventType.toUpperCase()}`,
        detail: tl.description,
        timestamp: tl.timestamp,
      });
    }

    if (inv.completedAt) {
      events.push({
        id: 'audit-completed',
        action: 'INVESTIGATION.COMPLETED',
        detail: `Completed in ${formatDuration(inv.startedAt, inv.completedAt)}. ${inv.identityCount} identities, ${inv.evidenceCount} evidence, ${inv.sourceCount} sources. Confidence: ${inv.confidence}%`,
        timestamp: inv.completedAt,
      });
    }

    return events.reverse();
  }, [inv]);

  return (
    <div className="space-y-1">
      {auditEvents.length === 0 ? (
        <EmptyState message="No audit log entries" />
      ) : (
        <div className="tp-panel rounded-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#3a4a3a]">
                <th className="py-2.5 px-4 tp-hud text-[0.6rem] font-normal w-[180px]">Timestamp</th>
                <th className="py-2.5 px-4 tp-hud text-[0.6rem] font-normal w-[200px]">Action</th>
                <th className="py-2.5 px-4 tp-hud text-[0.6rem] font-normal">Detail</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map((ev) => (
                <tr key={ev.id} className="border-b border-[#3a4a3a]/30 last:border-b-0">
                  <td className="py-2 px-4 text-xs text-[#8a9a8a] font-mono">
                    {formatFullDate(ev.timestamp)}
                  </td>
                  <td className="py-2 px-4">
                    <span className="tp-source-tag border-[#3a4a3a]">
                      {ev.action}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-xs text-[#e8e8e0]">
                    {ev.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB DEFINITIONS
// ============================================================

const TABS = [
  { value: 'overview', label: 'Overview', icon: Eye },
  { value: 'identity', label: 'Identity', icon: Fingerprint },
  { value: 'photos', label: 'Photos', icon: ImageIcon },
  { value: 'businesses', label: 'Businesses', icon: Building2 },
  { value: 'presence', label: 'Public Presence', icon: Globe },
  { value: 'location', label: 'Location', icon: Crosshair },
  { value: 'timeline', label: 'Timeline', icon: History },
  { value: 'evidence', label: 'Evidence', icon: FileText },
  { value: 'conflicts', label: 'Conflicts', icon: AlertTriangle },
  { value: 'sources', label: 'Sources', icon: Database },
  { value: 'audit', label: 'Audit Log', icon: ScrollText },
] as const;

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function InvestigationDetail() {
  const { currentInvestigation } = useInvestigationStore();
  const { navigate } = useNavStore();
  const [activeTab, setActiveTab] = useState('overview');

  if (!currentInvestigation) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <p className="text-sm text-[#5a6a5a]">No investigation selected</p>
          <Button
            variant="ghost"
            onClick={() => navigate('investigation')}
            className="mt-2 text-[#f59e0b] hover:text-[#f59e0b] hover:bg-[#2a3322] text-xs uppercase tracking-wider h-8 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Investigations
          </Button>
        </div>
      </div>
    );
  }

  const inv = currentInvestigation;

  return (
    <div className="space-y-5">
      {/* Back header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate('investigation')}
            className="text-[#8a9a8a] hover:text-[#e8e8e0] hover:bg-[#2a3322] h-8 w-8 p-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-sm font-semibold text-[#e8e8e0] tracking-wide uppercase flex items-center gap-2">
              Investigation Report
              <span className="tp-hud text-[0.65rem] font-normal text-[#8a9a8a]">
                {inv.id}
              </span>
            </h1>
            <p className="tp-hud text-[0.6rem] mt-0.5">
              {inv.isBatch && <span className="text-[#f59e0b]">BATCH · </span>}
              {inv.depth.toUpperCase()} DEPTH · COMPLETED{' '}
              {inv.completedAt && formatTimestamp(inv.completedAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LocationStatusBadge status={inv.locationStatus} />
          {inv.hasConflicts && (
            <span className="flex items-center gap-1 text-[0.6rem] text-[#ef4444] font-mono bg-[#ef4444]/10 px-2 py-0.5 rounded-sm border border-[#ef4444]/30">
              <AlertTriangle className="w-3 h-3" />
              CONFLICTS
            </span>
          )}
        </div>
      </div>

      <Separator className="bg-[#3a4a3a]" />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Custom scrollable tab list */}
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="bg-[#1a201c] border border-[#3a4a3a] rounded-sm h-auto p-1 w-full inline-flex gap-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.value;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={`rounded-sm h-8 px-3 text-[0.65rem] font-mono uppercase tracking-wider transition-all shrink-0 gap-1.5 cursor-pointer data-[state=active]:bg-[#2a3322] data-[state=active]:text-[#f59e0b] data-[state=active]:border-[#f59e0b]/30 data-[state=active]:shadow-none data-[state=active]:border data-[state=active]:border-solid text-[#8a9a8a] hover:text-[#e8e8e0] hover:bg-[#2a3322]/50 ${
                    isActive ? 'bg-[#2a3322] text-[#f59e0b] border border-[#f59e0b]/30 shadow-none' : 'border border-transparent'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="identity">
          <IdentityTab />
        </TabsContent>
        <TabsContent value="photos">
          <PhotosTab />
        </TabsContent>
        <TabsContent value="businesses">
          <BusinessesTab />
        </TabsContent>
        <TabsContent value="presence">
          <PublicPresenceTab />
        </TabsContent>
        <TabsContent value="location">
          <LocationTab />
        </TabsContent>
        <TabsContent value="timeline">
          <TimelineTab />
        </TabsContent>
        <TabsContent value="evidence">
          <EvidenceTab />
        </TabsContent>
        <TabsContent value="conflicts">
          <ConflictsTab />
        </TabsContent>
        <TabsContent value="sources">
          <SourcesTab />
        </TabsContent>
        <TabsContent value="audit">
          <AuditLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
