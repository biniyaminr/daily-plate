import type { Metadata, Viewport } from 'next';
import { Fraunces } from 'next/font/google';
import './globals.css';

const display = Fraunces({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Enjera · Ethiopian food for weight loss and muscle gain', template: '%s · Enjera' },
  description: 'Free weekly Ethiopian meal plans sized for your goal: lose weight, build muscle or both. Injera, wot, tibs and shiro, plus fasting days, a food log and workouts.',
  icons: { icon: '/favicon.svg' },
  robots: { index: true, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#486139' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body>{children}</body>
    </html>
  );
}
