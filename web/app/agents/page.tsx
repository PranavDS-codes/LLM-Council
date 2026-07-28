'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Loader2, Plus, RotateCcw, Save, Shield, Trash2, Users } from 'lucide-react';

import { getApiUrl } from '@/lib/api';
import { useCouncilStore } from '@/store/councilStore';
import type { AgentRegistryEntry, ValidationState } from '@/store/types';

const EMPTY_AGENT = (): AgentRegistryEntry => ({
  id: `agent-${crypto.randomUUID()}`,
  name: 'New Agent',
  personaInstruction: 'Describe this agent\'s distinct expertise, point of view, vocabulary, and priorities.',
  model: 'openai/gpt-oss-20b',
});

export default function AgentsPage() {
  const { agentRegistry, agentDraft: draft, settings, setAgentRegistry, setAgentDraft, resetAgentRegistry } = useCouncilStore();
  const [statuses, setStatuses] = useState<Record<string, ValidationState>>({});
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const update = (id: string, field: keyof Omit<AgentRegistryEntry, 'id'>, value: string) => {
    setAgentDraft(draft.map((agent) => agent.id === id ? { ...agent, [field]: value } : agent));
    if (field === 'model') {
      setStatuses((current) => ({ ...current, [id]: { status: null } }));
    }
    setMessage(null);
  };

  const addAgent = () => {
    if (draft.length >= 12) return;
    setAgentDraft([...draft, EMPTY_AGENT()]);
    setMessage(null);
  };

  const removeAgent = (id: string) => {
    if (draft.length <= 1) return;
    setAgentDraft(draft.filter((agent) => agent.id !== id));
    setMessage(null);
  };

  const validateDraft = () => {
    const names = new Set<string>();
    for (const agent of draft) {
      if (!agent.name.trim() || !agent.personaInstruction.trim() || !agent.model.trim()) return 'Every agent needs a name, persona directive, and model ID.';
      const normalized = agent.name.trim().toLowerCase();
      if (names.has(normalized)) return 'Agent names must be unique.';
      names.add(normalized);
    }
    return null;
  };

  const runTest = async () => {
    const error = validateDraft();
    if (error) { setMessage(error); return; }
    setTesting(true);
    setMessage(null);
    setStatuses(Object.fromEntries(draft.map((agent) => [agent.id, { status: 'loading' }])));
    const results = await Promise.all(draft.map(async (agent) => {
      try {
        const response = await fetch(getApiUrl('/api/check-model'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model_id: agent.model.trim(), api_key: settings.apiKey || undefined }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.detail || `Model verification failed with status ${response.status}. Check the Render NVIDIA_API_KEY and API URL.`);
        }
        return [agent.id, { status: 'valid', message: 'Model verified.' }] as const;
      } catch (testError) {
        return [agent.id, { status: 'invalid', message: testError instanceof Error ? testError.message : 'Unable to verify model.' }] as const;
      }
    }));
    const nextStatuses: Record<string, ValidationState> = Object.fromEntries(results);
    setStatuses(nextStatuses);
    setTesting(false);
    setMessage(Object.values(nextStatuses).some((status) => status.status === 'invalid') ? 'Some models could not be reached. Fix the marked entries and run the test again.' : 'All agent models are available through NVIDIA NIM.');
  };

  const requiresTest = JSON.stringify(draft.map(({ id, model }) => ({ id, model: model.trim() })))
    !== JSON.stringify(agentRegistry.map(({ id, model }) => ({ id, model: model.trim() })));
  const allTested = draft.every((agent) => statuses[agent.id]?.status === 'valid');
  const canSave = !testing && !validateDraft() && (!requiresTest || allTested);

  const save = () => {
    const error = validateDraft();
    if (error) { setMessage(error); return; }
    if (requiresTest && !allTested) { setMessage('Run Test successfully for every agent model before saving these registry changes.'); return; }
    setAgentRegistry(draft.map((agent) => ({ ...agent, name: agent.name.trim(), personaInstruction: agent.personaInstruction.trim(), model: agent.model.trim() })));
    setMessage('Agent registry saved. The summon menu now uses these agents.');
  };

  return (
    <div className="p-8 pb-32">
      <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-base)] pb-6">
          <div className="flex items-center gap-4"><div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3"><Users className="h-8 w-8 text-cyan-500" /></div><div><h1 className="text-3xl font-bold uppercase tracking-tight">Agents / Generators</h1><p className="mt-1 text-[var(--text-muted)]">Define the council members, their persona directives, and their NVIDIA NIM models.</p></div></div>
          <div className="flex gap-3"><button onClick={() => { resetAgentRegistry(); setStatuses({}); setMessage('Default agents restored.'); }} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-base)] bg-[var(--bg-panel-secondary)] px-4 py-2 text-sm font-semibold transition hover:bg-[var(--bg-app)]"><RotateCcw className="h-4 w-4" />Reset Defaults</button><button onClick={addAgent} disabled={draft.length >= 12} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"><Plus className="h-4 w-4" />Add Agent</button></div>
        </header>

        {message && <div className={`rounded-xl border px-4 py-3 text-sm ${message.includes('verified') || message.includes('saved') ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>{message}</div>}

        <div className="grid gap-5">
          {draft.map((agent, index) => {
            const status = statuses[agent.id];
            return <section key={agent.id} className="rounded-2xl border border-[var(--border-base)] bg-[var(--bg-panel)] p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4"><span className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-500">Generator {index + 1}</span><button onClick={() => removeAgent(agent.id)} disabled={draft.length <= 1} className="rounded-md p-2 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30" title="Remove agent"><Trash2 className="h-4 w-4" /></button></div>
              <div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-medium">Name<input value={agent.name} maxLength={60} onChange={(event) => update(agent.id, 'name', event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border-base)] bg-[var(--bg-panel-secondary)] px-3 py-2 text-sm outline-none focus:border-cyan-500" /></label><label className="text-sm font-medium md:col-span-2">NVIDIA NIM Model ID<div className="relative mt-2"><input value={agent.model} maxLength={160} onChange={(event) => update(agent.id, 'model', event.target.value)} className="w-full rounded-lg border border-[var(--border-base)] bg-[var(--bg-panel-secondary)] px-3 py-2 pr-9 font-mono text-sm outline-none focus:border-cyan-500" />{status?.status === 'loading' && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-cyan-500" />}{status?.status === 'valid' && <Check className="absolute right-3 top-2.5 h-4 w-4 text-emerald-500" />}{status?.status === 'invalid' && <AlertTriangle className="absolute right-3 top-2.5 h-4 w-4 text-red-500" />}</div>{status?.message && <p className={`mt-1 text-xs ${status.status === 'invalid' ? 'text-red-400' : 'text-emerald-400'}`}>{status.message}</p>}</label></div>
              <label className="mt-4 block text-sm font-medium">Persona Directive<textarea value={agent.personaInstruction} maxLength={4000} rows={5} onChange={(event) => update(agent.id, 'personaInstruction', event.target.value)} className="mt-2 w-full resize-y rounded-lg border border-[var(--border-base)] bg-[var(--bg-panel-secondary)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-cyan-500" /></label>
            </section>;
          })}
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">Run Test makes one NVIDIA NIM request per current agent model. Adding, removing, or changing a model requires a successful test before saving.</div>
        <div className="fixed bottom-0 left-[72px] right-0 z-50 flex items-center justify-end gap-4 border-t border-[var(--border-base)] bg-[var(--bg-panel)] p-4 md:left-[320px]"><button onClick={runTest} disabled={testing} className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50">{testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}Run Test</button><button onClick={save} disabled={!canSave} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" />Save Agents</button></div>
      </div>
    </div>
  );
}
