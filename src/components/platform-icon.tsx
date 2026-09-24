// lucide-react ships no branded platform icons (trademark reasons) - a small
// colored initial badge stands in for Facebook/Instagram/LinkedIn wherever a
// platform icon would otherwise go.
const PLATFORM_STYLE: Record<"FACEBOOK" | "INSTAGRAM" | "LINKEDIN", { bg: string; letter: string }> = {
  FACEBOOK: { bg: "#1877F2", letter: "f" },
  INSTAGRAM: { bg: "#E4405F", letter: "IG" },
  LINKEDIN: { bg: "#0A66C2", letter: "in" },
};

export function PlatformIcon({
  platform,
  className = "size-4",
}: {
  platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN";
  className?: string;
}) {
  const { bg, letter } = PLATFORM_STYLE[platform];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-[0.55em] leading-none font-bold text-white ${className}`}
      style={{ backgroundColor: bg }}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}
