import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Emits .next/standalone/ — a self-contained Node bundle that the
  // production Docker image copies into a minimal node:20-alpine runtime.
  output: "standalone",

  // Serve modern image formats (AVIF then WebP) where supported.
  // Devices list covers common viewports (mobile → 4 K retina).
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Compress gzip on every response (default in Next.js but explicit here).
  compress: true,

  // Package-level tree-shaking for lucide-react prevents bundling icons
  // that are never imported.
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default withBundleAnalyzer(nextConfig);
