import { PlayCircleIcon } from "lucide-react";

const SIZE_CONFIG = {
  lg: { pad: "p-5 sm:p-6", thumb: "w-28 sm:w-36", title: "text-xl sm:text-2xl", eyebrow: "text-xs" },
  md: { pad: "p-4 sm:p-5", thumb: "w-20 sm:w-24", title: "text-lg sm:text-xl", eyebrow: "text-[11px]" },
} as const;

/**
 * The dark "ambient blur" header banner used across the learner-facing course,
 * module and lesson pages, matching LearningSuite's look: the cover image
 * fills the whole banner as a blurred, darkened backdrop (so it never needs
 * cropping to a specific shape) with a crisp, un-cropped copy of the same
 * thumbnail placed on top next to the title. Same trick as the video
 * recorder/trimmer's ambient-blur preview background.
 */
export function CourseBanner({
  thumbnailUrl,
  eyebrow,
  title,
  meta,
  right,
  size = "lg",
}: {
  thumbnailUrl: string | null;
  eyebrow: string;
  title: string;
  meta?: string;
  right?: React.ReactNode;
  size?: keyof typeof SIZE_CONFIG;
}) {
  const { pad, thumb, title: titleSize, eyebrow: eyebrowSize } = SIZE_CONFIG[size];

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-neutral-900 ${pad}`}>
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full scale-125 object-cover opacity-50 blur-2xl"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-neutral-900 to-neutral-900" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/80 via-neutral-950/50 to-neutral-950/80" />

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className={`aspect-video shrink-0 overflow-hidden rounded-lg bg-white/10 ${thumb}`}>
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnailUrl} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center">
                <PlayCircleIcon className="size-8 text-white/60" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className={`font-medium tracking-wide text-white/60 uppercase ${eyebrowSize}`}>{eyebrow}</p>
            <h1 className={`mt-0.5 truncate font-bold text-white ${titleSize}`} title={title}>
              {title}
            </h1>
            {meta && <p className="mt-1 text-sm text-white/50">{meta}</p>}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}
