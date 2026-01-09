import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

import { KeepAlive } from '@/components/KeepAlive';

export const metadata: Metadata = {
  title: 'LLM Council',
  description: 'Multi-Agent Debate System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden text-slate-100 antialiased selection:bg-cyan-500/30">
        <KeepAlive />
        <Sidebar />
        <main className="flex-1 relative overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
