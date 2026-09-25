const SIZE_CONFIG = {
  sm: { box: 56, boxClass: "w-11 h-11 sm:w-14 sm:h-14", stroke: 5, text: "text-xs sm:text-sm" },
  md: { box: 68, boxClass: "w-[52px] h-[52px] sm:w-[68px] sm:h-[68px]", stroke: 5, text: "text-sm sm:text-base" },
  lg: { box: 96, boxClass: "w-16 h-16 sm:w-24 sm:h-24", stroke: 7, text: "text-base sm:text-xl" },
} as const;

/** A small SVG ring showing a 0-100 percentage, used for course/module progress. */
export function CircularProgress({
  percent,
  size = "md",
  tone = "default",
  className,
}: {
  percent: number;
  size?: keyof typeof SIZE_CONFIG;
  /** "onDark" swaps the track/label colors for use inside a dark banner (see CourseBanner). */
  tone?: "default" | "onDark";
  className?: string;
}) {
  const { box, boxClass, stroke, text } = SIZE_CONFIG[size];
  const radius = (box - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={`relative inline-flex shrink-0 items-center justify-center ${boxClass} ${className ?? ""}`}>
      <svg width="100%" height="100%" viewBox={`0 0 ${box} ${box}`} className="-rotate-90">
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className={tone === "onDark" ? "text-white/15" : "text-muted"}
        />
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
      <span
        className={`absolute font-bold tabular-nums ${text} ${tone === "onDark" ? "text-white" : "text-foreground"}`}
      >
        {Math.round(clamped)}%
      </span>
    </div>
  );
}
