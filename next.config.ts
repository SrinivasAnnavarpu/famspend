import type { NextConfig } from 'next'

// next-pwa (offline support)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // Cache Supabase + app routes with network-first to allow offline fallback.
  runtimeCaching: [
    {
      urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/_next/') || url.pathname.startsWith('/icons/') || url.pathname.endsWith('.png'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      urlPattern: ({ url }: { url: URL }) => url.origin.includes('supabase.co'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-api',
        networkTimeoutSeconds: 4,
        expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 6 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: ({ request }: { request: Request }) => request.destination === 'document',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        networkTimeoutSeconds: 4,
        expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
})

const nextConfig: NextConfig = {
  // Silence Turbopack+webpack plugin warning for now.
  turbopack: {},
}

export default withPWA(nextConfig)
