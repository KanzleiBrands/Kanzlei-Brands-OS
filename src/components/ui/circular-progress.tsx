const SIZE_CONFIG = {
  sm: { box: 56, stroke: 5, text: "text-sm" },
  md: { box: 68, stroke: 5, text: "text-base" },
  lg: { box: 96, stroke: 7, text: "text-xl" },
} as const;

/** A small SVG ring showing a 0-100 percentage, used for course/module progress. */
export function CircularProgress({
  percent,
  size = "md",
  className,
}: {
  percent: number;
  size?: keyof typeof SIZE_CONFIG;
  className?: string;
}) {
  const { box, stroke, text } = SIZE_CONFIG[size];
  const radius = (box - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={`relative inline-flex items-center justify-center ${className ?? ""}`} style={{ width: box, height: box }}>
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className="-rotate-90">
        <circle cx={box / 2} cy={box / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted" />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-emerald-500 transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className={`absolute font-bold text-foreground tabular-nums ${text}`}>{Math.round(clamped)}%</span>
    </div>
  );
}
