'use client';

import { Brain, Clock, Cpu, Hash, Send, Square } from 'lucide-react';
import { FormEvent, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useCouncilStore } from '@/store/councilStore';
import type { FollowUpModel } from '@/store/types';

const MODEL_OPTIONS: { value: FollowUpModel; label: string }[] = [
  { value: 'openai/gpt-oss-20b', label: 'GPT-OSS-20B' },
  { value: 'openai/gpt-oss-120b', label: 'GPT-OSS-120B' },
];

export function PhaseFollowUpChat() {
  const { currentSessionId, sessions, isFollowUpStreaming, followUpSessionId, setFollowUpModel, sendFollowUpMessage, stopFollowUpMessage } = useCouncilStore();
  const session = sessions.find((candidate) => candidate.id === currentSessionId);
  const [draft, setDraft] = useState('');

  if (!session || session.status !== 'completed' || !session.finalizerText.trim()) return null;
  const chat = session.followUpChat;
  const isStreamingThisSession = isFollowUpStreaming && followUpSessionId === session.id;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim() || isFollowUpStreaming) return;
    void sendFollowUpMessage(draft);
    setDraft('');
  };

  return (
    <section className="mx-auto max-w-[1400px] space-y-6 py-4">
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400"><Brain className="h-5 w-5" /></div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-500">Council Follow-Up</p>
          <h3 className="mt-1 text-xl font-bold text-[var(--text-main)]">Continue from the final consensus</h3>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">This conversation is grounded only in the final synthesized report and this chat. Council drafts, reviews, and blueprints are not included.</p>
        </div>
      </div>

      <div className="space-y-5">
        {chat.messages.length === 0 && <div className="rounded-2xl border border-dashed border-[var(--border-base)] bg-[var(--bg-panel-secondary)]/50 px-5 py-10 text-center text-sm text-[var(--text-muted)]">Ask the council to clarify, expand, or adapt its final report.</div>}
        {chat.messages.map((message) => message.role === 'user' ? (
          <div key={message.id} className="flex justify-end"><div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-indigo-500/80 px-4 py-2.5 text-sm leading-relaxed text-white shadow-lg shadow-indigo-500/10">{message.content}</div></div>
        ) : (
          <article key={message.id} className="relative max-w-none py-3 pr-24">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-400">
              <Brain className="h-3.5 w-3.5" /> <span>Council follow-up</span>
              {message.model && <span className="text-[var(--text-muted)]">{message.model.split('/').pop()}</span>}
            </div>
            {message.reasoning && <details className="group absolute right-0 top-3"><summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-300 transition hover:text-indigo-200">Thinking</summary><pre className="absolute right-0 top-6 z-10 hidden w-[min(420px,85vw)] whitespace-pre-wrap rounded-xl border border-indigo-500/20 bg-[var(--bg-panel)] p-4 font-sans text-xs leading-relaxed text-[var(--text-muted)] shadow-2xl group-open:block">{message.reasoning}</pre></details>}
            {message.content ? <div className="prose prose-sm max-w-none text-[var(--text-main)] dark:prose-invert prose-p:text-[var(--text-main)] prose-headings:text-[var(--text-main)]"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div> : message.status === 'streaming' ? <p className="animate-pulse text-sm italic text-[var(--text-muted)]">Preparing a response...</p> : null}
            {message.error && <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{message.error}</p>}
            {message.status === 'stopped' && <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Response stopped</p>}
            {message.usage && <div className="mt-4 flex flex-wrap gap-4 text-[10px] font-mono uppercase text-[var(--text-muted)]"><span className="flex items-center gap-1"><Hash className="h-3 w-3" /> In {message.usage.prompt}</span><span className="flex items-center gap-1"><Hash className="h-3 w-3" /> Out {message.usage.completion}</span><span className="flex items-center gap-1"><Hash className="h-3 w-3" /> Total {message.usage.total}</span><span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Saved locally</span></div>}
          </article>
        ))}
      </div>

      <form onSubmit={submit} className="border-t border-[var(--border-base)] pt-5">
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask a follow-up about the final report..." rows={3} disabled={isFollowUpStreaming} className="w-full resize-y rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-main)] outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[var(--text-muted)]">{isFollowUpStreaming && !isStreamingThisSession ? 'Another session has a follow-up response in progress.' : 'Thinking is saved locally with this session.'}</p><div className="flex items-center gap-2"><label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]"><Cpu className="h-4 w-4 text-cyan-400" /><select value={chat.selectedModel} onChange={(event) => setFollowUpModel(event.target.value as FollowUpModel)} className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-panel-secondary)] px-3 py-2 text-xs font-bold text-[var(--text-main)] outline-none focus:border-cyan-500">{MODEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{isStreamingThisSession ? <button type="button" onClick={stopFollowUpMessage} className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20"><Square className="h-4 w-4" /> Stop</button> : <button type="submit" disabled={!draft.trim() || isFollowUpStreaming} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" /> Send</button>}</div></div>
      </form>
    </section>
  );
}
