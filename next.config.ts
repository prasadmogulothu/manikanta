import type { NextConfig } from 'next';

// There's an unrelated lockfile in the parent folder, so name this folder as the root.
const config: NextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  // Dev server only: lets a phone on the home network load the page's scripts (cart, popups).
  allowedDevOrigins: ['192.168.1.146'],
  // No other page may frame these, so nobody can trick a signed-in owner into clicking the admin.
  // ponytail: no full Content-Security-Policy. No owner text reaches the page as HTML, so add one
  // if a module ever renders stored HTML.
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ],
};

export default config;
