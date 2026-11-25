import './globals.css';
import type { Metadata, Viewport } from 'next';
import Toaster from '@/components/Toaster';
import MotionLayer from '@/components/MotionLayer';

export const metadata: Metadata = { title: 'HOOSE · Production Management', description: 'ระบบวางแผนพรีโปรดักชันและโปรดักชันของ HOOSE' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0D00FF' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body><MotionLayer />{children}<Toaster /></body>
    </html>
  );
}
