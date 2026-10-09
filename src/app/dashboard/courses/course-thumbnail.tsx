import Image from "next/image";
import { PlayCircleIcon } from "lucide-react";

/**
 * Course/module/lesson cover image with a branded gradient fallback when no
 * thumbnail was uploaded. Always sized to match the 16:9 canvas the
 * ThumbnailGenerator produces (pass a width via className, e.g. "w-40", and
 * let aspect-video derive the height) - that's what guarantees the image is
 * never cropped: object-cover only ever crops when the container's aspect
 * ratio doesn't match the image's, and here it always does, regardless of
 * how wide the caller renders it.
 *
 * Uses next/image (not a raw <img>, unlike most other upload previews in
 * this codebase) specifically because the ThumbnailGenerator source file is
 * a full 1600x900 image (several hundred KB to a few MB) shown here at
 * 64-300px wide - without resizing, a page listing a dozen courses/modules
 * was pulling tens of MB just for thumbnails. next/image resizes + transcodes
 * to a modern format on Vercel's image CDN and caches the result, so this
 * fixes existing already-uploaded thumbnails too, not just new ones.
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
      <div className={`relative aspect-video overflow-hidden bg-muted ${className}`}>
        <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 300px, (min-width: 640px) 200px, 50vw" className="object-cover" />
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
