import { PlayCircleIcon } from "lucide-react";

/**
 * Course/module/lesson cover image with a branded gradient fallback when no
 * thumbnail was uploaded. Always sized to match the 16:9 canvas the
 * ThumbnailGenerator produces (pass a width via className, e.g. "w-40", and
 * let aspect-video derive the height) - that's what guarantees the image is
 * never cropped: object-cover only ever crops when the container's aspect
 * ratio doesn't match the image's, and here it always does, regardless of
 * how wide the caller renders it.
 */
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
      <div className={`aspect-video overflow-hidden bg-muted ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- external Blob/local-uploads URLs, matches avatar-upload-form.tsx convention */}
        <img src={src} alt={alt} className="size-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={`flex aspect-video items-center justify-center bg-gradient-to-br from-primary/80 to-primary/30 ${className}`}
    >
      <PlayCircleIcon className="size-10 text-primary-foreground/70" />
    </div>
  );
}
