import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB, which a phone photo or scanned PDF CV routinely
      // exceeds - the upload then fails at the framework level (crashing
      // the whole page) before it ever reaches our own code/error handling.
      bodySizeLimit: "10mb",
    },
  },
  images: {
    // Vercel Blob (production file storage, see src/lib/file-storage.ts) -
    // needed so next/image can resize/transcode uploaded course thumbnails
    // etc. instead of serving the original multi-MB file straight through.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
