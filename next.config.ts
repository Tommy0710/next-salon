import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Performance ──────────────────────────────────────────────────────────
  compress: true,          // Gzip/Brotli compression for all responses
  poweredByHeader: false,  // Bỏ X-Powered-By: Next.js header (security + payload)

  // ── Image Optimization ───────────────────────────────────────────────────
  images: {
    minimumCacheTTL: 86400,          // Cache images 24h (default: 60s)
    formats: ['image/avif', 'image/webp'], // Modern formats (smaller size)
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // ── Security Headers ─────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' https://api.openai.com;",
          },
        ],
      },
      // Static assets: cache aggressively
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
