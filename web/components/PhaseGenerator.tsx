'use client';

import { useState } from 'react';
import { Activity, AlertTriangle, Clock, Cpu, Hash, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import { useCouncilStore } from '@/store/councilStore';

export function PhaseGenerator() {
  const { currentSessionId, sessions } = useCouncilStore();
  const currentSession = sessions.find((session) => session.id === currentSessionId);
  const generatorStreams = currentSession?.generatorStreams || {};
  const agentModels = currentSession?.agentModels || {};
  const selectedAgentNames =
    currentSession?.agents.filter((agent) => agent.selected).map((agent) => agent.name) || [];
  const activeAgentNames =
    selectedAgentNames.length > 0 ? selectedAgentNames : Object.keys(generatorStreams);
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedTab, setSelectedTab] = useState('');

  const currentTab = selectedTab || activeAgentNames[0] || '';
  const agentIssues =
    currentSession?.issues.filter((issue) => issue.agent === currentTab) || [];

  if (activeAgentNames.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-[24px] border border-[var(--border-base)] bg-[var(--bg-panel)] shadow-sm transition-all duration-300 ${
        isExpanded ? 'min-h-[420px]' : ''
      }`}
    >
      <div className="flex items-center justify-between border-b border-[var(--border-base)] bg-[var(--bg-panel-secondary)] pr-2">
        <div className="flex gap-2 overflow-x-auto p-2 no-scrollbar">
          {activeAgentNames.map((agentName) => (
            <button
              key={agentName}
              onClick={() => setSelectedTab(agentName)}
              className={`flex items-center gap-2 whitespace-nowrap rounded border px-3 py-2 text-xs font-mono uppercase tracking-wider transition-colors ${
                currentTab === agentName
                  ? 'border-cyan-500/30 bg-cyan-900/20 text-cyan-600 dark:text-cyan-400'
                  : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-main)]'
              }`}
            >
              {generatorStreams[agentName] ? (
                <Activity className={`h-3 w-3 ${currentTab === agentName ? 'animate-pulse' : ''}`} />
              ) : (
                <Sparkles className="h-3 w-3 opacity-50" />
              )}
              {agentName}
            </button>
          ))}
        </div>

        <button
          onClick={() => setIsExpanded((value) => !value)}
          className="ml-2 flex-shrink-0 rounded p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-panel)] hover:text-[var(--text-main)]"
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      <div
        className={`p-6 text-sm leading-relaxed text-[var(--text-main)] transition-all duration-300 ${
          !isExpanded ? 'line-clamp-3 overflow-hidden' : ''
        }`}
      >
        {agentIssues.length > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
              <div>
                <div className="font-semibold uppercase tracking-[0.18em] text-amber-200">
                  Agent issue
                </div>
                <p className="mt-1 opacity-85">
                  {agentIssues[agentIssues.length - 1]?.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {currentTab && generatorStreams[currentTab] ? (
          <div className="prose prose-sm max-w-none font-mono prose-headings:text-[var(--text-main)] prose-p:text-[var(--text-main)] prose-strong:text-[var(--text-main)] prose-li:text-[var(--text-main)] prose-code:text-[var(--text-main)] dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
              {generatorStreams[currentTab]}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border-base)] bg-[var(--bg-panel-secondary)] px-4 py-10 text-center">
            <p className="text-sm italic text-[var(--text-muted)]">
              Waiting for {currentTab || 'the next agent'} to deliver a first draft...
            </p>
          </div>
        )}

        {isExpanded && <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-cyan-500 align-middle" />}

        {currentTab && generatorStreams[currentTab] && (
          <div className="mt-6 flex items-center justify-end gap-4 border-t border-dashed border-[var(--border-base)] pt-3 font-mono text-[10px] uppercase text-[var(--text-muted)] opacity-80">
            {currentSession?.metrics?.generators?.[currentTab] && (
              <>
                <div className="flex items-center gap-1.5" title="Execution Time">
                  <Clock className="h-3 w-3" />
                  <span>{currentSession.metrics.generators[currentTab].time.toFixed(2)}s</span>
                </div>
                <div className="flex items-center gap-1.5" title="Total Tokens">
                  <Hash className="h-3 w-3" />
                  <span>{currentSession.metrics.generators[currentTab].usage?.total || 0} Tok</span>
                </div>
              </>
            )}
            {agentModels[currentTab] && (
              <div className="flex items-center gap-1.5" title="Model ID">
                <Cpu className="h-3 w-3" />
                <span>{agentModels[currentTab].split('/').pop()}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
