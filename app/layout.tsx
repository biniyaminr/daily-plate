import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Benji’s Daily Plate', template: '%s · Benji’s Daily Plate' },
  description: 'Benji — meals, training and progress.',
  icons: { icon: '/favicon.svg' },
  robots: { index: true, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#486139' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
