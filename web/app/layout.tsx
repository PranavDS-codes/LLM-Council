import type { Metadata } from 'next';

import { KeepAlive } from '@/components/KeepAlive';
import { Sidebar } from '@/components/Sidebar';

import './globals.css';

export const metadata: Metadata = {
  title: 'LLM Council Mission Control',
  description: 'A multi-agent council for critique, synthesis, and trustworthy final answers.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden antialiased selection:bg-cyan-500/30">
        <KeepAlive />
        <Sidebar />
        <main className="relative flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
