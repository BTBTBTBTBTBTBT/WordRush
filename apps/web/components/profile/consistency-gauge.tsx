'use client';

interface ConsistencyGaugeProps {
  score: number;
  sampleSize: number;
  accentColor: string;
}

export function ConsistencyGauge({ score, sampleSize, accentColor }: ConsistencyGaugeProps) {
  if (sampleSize < 3) return null;

  const label = score >= 85 ? 'Very Consistent' : score >= 65 ? 'Consistent' : score >= 40 ? 'Variable' : 'Unpredictable';

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-12 h-12 flex-shrink-0">
        <svg viewBox="0 0 48 48" className="w-full h-full">
          <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-border)" strokeWidth="4" />
          <circle
            cx="24" cy="24" r="20" fill="none"
            stroke={accentColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 125.6} 125.6`}
            transform="rotate(-90 24 24)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-black" style={{ color: 'var(--color-text)' }}>{score}</span>
        </div>
      </div>
      <div>
        <div className="text-xs font-black" style={{ color: 'var(--color-text)' }}>{label}</div>
        <div className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
          Based on last {sampleSize} wins
        </div>
      </div>
    </div>
  );
}
