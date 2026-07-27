import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Emit a self-contained production server for container/standalone deploys.
  output: 'standalone',
  outputFileTracingRoot: process.cwd(),
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'clsx', 'tailwind-merge', 'date-fns', 'zod'],
  },
  // nodemailer and twilio are optional production dependencies that are NOT
  // installed in the default dev setup. Mark them as webpack externals so
  // the build does not fail when they are absent. The dynamic-import guards
  // in src/lib/email.ts (isSmtpConfigured) and src/lib/sms.ts
  // (isTwilioConfigured) already prevent calling them at runtime.
  webpack(config, { isServer }) {
    if (isServer) {
      const prev = Array.isArray(config.externals) ? config.externals : [];
      config.externals = [...prev, 'nodemailer', 'twilio'];
    }
    return config;
  },
  // Phase 8 — image optimisation.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24, // 24h
  },
  // Phase 8 — static asset caching + safety-net security headers.
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
