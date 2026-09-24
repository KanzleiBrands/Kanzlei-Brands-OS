import { PlayCircleIcon } from "lucide-react";

/** Course/module cover image with a branded gradient fallback when no thumbnail was uploaded. */
export function CourseThumbnail({
  src,
  alt,
  className = "",
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  if (src) {
    return (
      <div className={`overflow-hidden bg-muted ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- external Blob/local-uploads URLs, matches avatar-upload-form.tsx convention */}
        <img src={src} alt={alt} className="size-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-primary/80 to-primary/30 ${className}`}
    >
      <PlayCircleIcon className="size-10 text-primary-foreground/70" />
    </div>
  );
}
