'use client';

import { cn } from '@/lib/utils';

interface ConfidenceMeterProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
}

const sizeMap = {
  sm: { bar: 'h-1.5', text: 'text-[10px]', width: 'w-16' },
  md: { bar: 'h-2', text: 'text-xs', width: 'w-24' },
  lg: { bar: 'h-3', text: 'text-sm', width: 'w-32' },
};

function getColor(score: number): { fill: string; text: string; bg: string; label: string } {
  if (score >= 80) return { fill: '#4a9e5a', text: 'text-[#4a9e5a]', bg: 'bg-[#4a9e5a]/8', label: 'HIGH' };
  if (score >= 50) return { fill: '#c8a24e', text: 'text-[#c8a24e]', bg: 'bg-[#c8a24e]/8', label: 'MODERATE' };
  if (score >= 25) return { fill: '#d4763a', text: 'text-[#d4763a]', bg: 'bg-[#d4763a]/8', label: 'LOW' };
  return { fill: '#5e665c', text: 'text-[#5e665c]', bg: 'bg-accent', label: 'INSUFFICIENT' };
}

export function ConfidenceMeter({ score, size = 'md', showLabel = true, animated = false }: ConfidenceMeterProps) {
  const s = sizeMap[size];
  const c = getColor(score);
  const segments = 20;
  const filledSegments = Math.round((score / 100) * segments);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className={cn('mono-label', s.text)}>{showLabel ? 'Confidence' : ''}</span>
        <div className="flex items-center gap-1.5">
          <span className={cn('font-mono font-semibold', s.text, c.text)}>{score}%</span>
          {showLabel && (
            <span className={cn('intel-badge', c.bg, c.text)}>{c.label}</span>
          )}
        </div>
      </div>
      <div className="confidence-bar">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'segment flex-1',
              i < filledSegments ? '' : 'opacity-10'
            )}
            style={{
              background: i < filledSegments
                ? `linear-gradient(90deg, ${c.fill}${i === 0 ? 'cc' : '88'}, ${c.fill})`
                : '#3a3e3a',
              transition: animated ? 'all 0.6s ease' : 'none',
              transitionDelay: animated ? `${i * 30}ms` : '0ms',
              opacity: i < filledSegments ? 1 : 0.15,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function ConfidenceRing({ score, size = 64 }: { score: number; size?: number }) {
  const c = getColor(score);
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="#232823"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={c.fill}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('font-mono font-bold', size > 48 ? 'text-sm' : 'text-[10px]', c.text)}>
          {score}
        </span>
      </div>
    </div>
  );
}

export function EvidenceScoreBar({ label, score, size = 'sm' }: { label: string; score: number; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'h-1' : 'h-1.5';
  const color = score >= 80 ? '#4a9e5a' : score >= 50 ? '#c8a24e' : '#5e665c';

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-muted-foreground w-16 shrink-0 truncate" title={label}>{label}</span>
      <div className={cn('flex-1 rounded-full overflow-hidden bg-accent', s)}>
        <div
          className={cn('h-full rounded-full', s)}
          style={{ width: `${score}%`, background: color, transition: 'width 0.5s ease' }}
        />
      </div>
      <span className="text-[9px] font-mono text-muted-foreground w-6 text-right">{score}</span>
    </div>
  );
}
