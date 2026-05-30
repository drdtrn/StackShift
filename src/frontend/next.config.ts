import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5190";
const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL ?? "http://localhost:8080";
const turnstile = "https://challenges.cloudflare.com";
const wsApi = apiUrl.replace(/^http/, "ws");

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${turnstile}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiUrl} ${wsApi} ${keycloakUrl} ${turnstile}`,
  `frame-src ${turnstile}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "report-uri /api/csp-report",
].join("; ");

const securityHeaders = [
  // Report-only first (Plan 08 §5.G): collect violations, then promote to the
  // enforcing Content-Security-Policy header in a later release.
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=(), payment=(self)" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

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
