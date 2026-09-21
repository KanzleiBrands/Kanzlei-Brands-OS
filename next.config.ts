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
};

export default nextConfig;
