'use client';

import { AgentSelector } from '@/components/AgentSelector';
import { CouncilTimeline } from '@/components/CouncilTimeline';
import { useCouncilStore } from '@/store/councilStore';
import { summonCouncil } from '@/lib/api';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function Home() {
  const { query, setQuery, isProcessing, agents, activePhase } = useCouncilStore();

  const handleSummon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isProcessing) return;

    const selectedAgents = agents.filter(a => a.selected).map(a => a.id);
    await summonCouncil(query, selectedAgents);
  };

  return (
    <div className="min-h-full">

      {/* Setup Phase - Fade out when processing starts? Or just scroll up. 
           For this UI, we keep it at top but maybe collapse it? 
           Let's keep it simple: always visible at top, scrollable body.
       */}
      <div className={`
         transition-all duration-700 ease-in-out border-b border-[var(--border-base)] bg-[var(--bg-app)]/80 backdrop-blur sticky top-0 z-20
         ${activePhase > 0 ? 'py-4 shadow-xl' : 'py-20'}
       `}>
        <div className="max-w-3xl mx-auto px-6 text-center space-y-8">

          {/* Header - Only visible when idle */}
          {activePhase === 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500 filter drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">
                ASSEMBLE THE COUNCIL
              </h1>
              <p className="text-[var(--text-muted)] max-w-lg mx-auto text-lg">
                Deploy a multi-agent swarm to analyze complex queries through divergent generation and convergent synthesis.
              </p>
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSummon} className="space-y-6">

            {/* Agent Selector - Hide when processing to reduce noise? Or disable. */}
            <div className={`transition-all duration-500 ${activePhase > 0 ? 'scale-75 opacity-50 pointer-events-none hidden md:block' : 'opacity-100'}`}>
              <AgentSelector />
            </div>

            {/* Input Field */}
            <div className="relative group max-w-2xl mx-auto">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-indigo-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative flex items-center bg-[var(--bg-panel)] rounded-lg p-1 pr-2 border border-[var(--border-base)] shadow-sm">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your query for the council..."
                  rows={Math.min(10, Math.max(2, query.split('\n').length))}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-[var(--text-main)] placeholder-[var(--text-muted)] px-4 py-3 resize-none min-h-[60px] max-h-[300px] overflow-y-auto"
                  disabled={isProcessing}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSummon(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!query.trim() || isProcessing}
                  className="p-3 bg-gradient-to-r from-cyan-600 to-indigo-600 rounded-md text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_-3px_rgba(99,102,241,0.4)]"
                >
                  {isProcessing ? (
                    <Sparkles className="w-5 h-5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Timeline Feed */}
      <div className="bg-[var(--bg-app)] min-h-screen">
        <CouncilTimeline />
      </div>
    </div>
  );
}
