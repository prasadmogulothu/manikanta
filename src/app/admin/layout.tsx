import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import '@/admin/admin.css';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
