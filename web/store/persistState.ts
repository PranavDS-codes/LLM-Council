import type { Agent, AgentRegistryEntry, CouncilMetrics, CouncilSession, MetricData, MetricUsage, SessionIssue, SessionStatus } from './types';

const LEGACY_AGENT_REGISTRY: AgentRegistryEntry[] = [
  ['The Academic', 'You are a rigorous researcher. Focus on definitions, historical context, theoretical frameworks, and first principles. Cite logical fallacies if present. Use formal, precise language. Prioritize accuracy and depth over simplicity.'],
  ['The Layman', 'You are a regular person who values common sense. You hate jargon. Explain how this affects daily life using plain English, analogies, and simple metaphors. Be skeptical of over-complication.'],
  ['The Skeptic', 'You are a critical thinker who looks for the catch. Question the premise, identify edge cases, security risks, downsides, and hidden costs. Focus on risk mitigation.'],
  ['The Futurist', 'You are a visionary focused on the long-term horizon. Discuss trends, exponential technologies, and second-order effects. Focus on what is possible while acknowledging disruptive potential.'],
  ['The Ethical Guardian', 'You are a moral philosopher and safety advocate. Focus on societal impact, bias, fairness, environmental cost, and human well-being. Ask should we rather than can we. Prioritize safety and responsibility.'],
].map(([name, personaInstruction]) => ({ id: name, name, personaInstruction, model: 'openai/gpt-oss-20b' }));

type PersistedSettings = {
  apiKey: string;
  modelOverrides: Record<string, string>;
};

type MergeableCouncilState = {
  settings: PersistedSettings;
  sessions: CouncilSession[];
  currentSessionId: string | null;
  theme: 'dark' | 'light';
  isStreaming: boolean;
  abortController: AbortController | null;
  agents: Agent[];
  agentRegistry: AgentRegistryEntry[];
  agentDraft: AgentRegistryEntry[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function sanitizeNvidiaModelOverrides(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sanitizeStringRecord(value)).filter(([, model]) => !model.endsWith(':free')),
  );
}

function sanitizeAgentRegistry(value: unknown, legacyModels: Record<string, string>): AgentRegistryEntry[] {
  if (!Array.isArray(value)) {
    return LEGACY_AGENT_REGISTRY.map((agent, index) => ({
      ...agent,
      model: legacyModels[agent.name] || legacyModels[`generator_${index + 1}`] || agent.model,
    }));
  }

  const ids = new Set<string>();
  const names = new Set<string>();
  const entries = value.flatMap((agent) => {
    if (!isRecord(agent) || typeof agent.id !== 'string' || typeof agent.name !== 'string' || typeof agent.personaInstruction !== 'string' || typeof agent.model !== 'string') return [];
    const id = agent.id.trim();
    const name = agent.name.trim();
    const personaInstruction = agent.personaInstruction.trim();
    const model = agent.model.trim();
    if (!id || !name || !personaInstruction || !model || ids.has(id) || names.has(name.toLowerCase())) return [];
    ids.add(id);
    names.add(name.toLowerCase());
    return [{ id, name, personaInstruction, model }];
  });
  return entries.length > 0 ? entries : LEGACY_AGENT_REGISTRY;
}

function sanitizePhaseModelOverrides(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sanitizeNvidiaModelOverrides(value)).filter(([role]) => ['critic', 'architect', 'finalizer'].includes(role)),
  );
}

function emptyUsage(): MetricUsage {
  return { total: 0, prompt: 0, completion: 0 };
}

function deriveLoadPhase(session: Pick<CouncilSession, 'finalizerText' | 'architectData' | 'criticData'>): 1 | 2 | 3 | 4 {
  if (session.finalizerText) {
    return 4;
  }
  if (session.architectData) {
    return 3;
  }
  if (session.criticData) {
    return 2;
  }
  return 1;
}

function sanitizeUsage(value: unknown): MetricUsage {
  if (!isRecord(value)) {
    return emptyUsage();
  }

  return {
    total: Number(value.total || 0),
    prompt: Number(value.prompt || 0),
    completion: Number(value.completion || 0),
  };
}

function sanitizeMetricData(value: unknown): MetricData | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    time: Number(value.time || 0),
    model: typeof value.model === 'string' ? value.model : 'N/A',
    usage: sanitizeUsage(value.usage),
  };
}

function sanitizeMetrics(value: unknown): CouncilMetrics {
  if (!isRecord(value)) {
    return {
      generators: {},
      totalTime: 0,
      totalTokens: emptyUsage(),
    };
  }

  const generators = isRecord(value.generators)
    ? Object.fromEntries(
        Object.entries(value.generators)
          .map(([agent, metric]) => [agent, sanitizeMetricData(metric)])
          .filter((entry): entry is [string, MetricData] => entry[1] !== undefined),
      )
    : {};

  return {
    generators,
    critic: sanitizeMetricData(value.critic),
    architect: sanitizeMetricData(value.architect),
    finalizer: sanitizeMetricData(value.finalizer),
    totalTime: Number(value.totalTime || 0),
    totalTokens: sanitizeUsage(value.totalTokens),
  };
}

function sanitizeAgents(value: unknown): Agent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((agent) => {
    if (!isRecord(agent) || typeof agent.id !== 'string' || typeof agent.name !== 'string') {
      return [];
    }

    return [
      {
        id: agent.id,
        name: agent.name,
        selected: agent.selected !== false,
      },
    ];
  });
}

function sanitizeIssues(value: unknown): SessionIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((issue) => {
    if (!isRecord(issue) || typeof issue.id !== 'string' || typeof issue.message !== 'string') {
      return [];
    }

    return [
      {
        id: issue.id,
        message: issue.message,
        timestamp: Number(issue.timestamp || Date.now()),
        phase: typeof issue.phase === 'string' ? issue.phase : undefined,
        agent: typeof issue.agent === 'string' ? issue.agent : undefined,
        recoverable: issue.recoverable !== false,
      },
    ];
  });
}

function sanitizeStatus(value: unknown): SessionStatus {
  return value === 'idle'
    || value === 'streaming'
    || value === 'completed'
    || value === 'stopped'
    || value === 'error'
    ? value
    : 'completed';
}

function sanitizeSession(value: unknown): CouncilSession | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.query !== 'string') {
    return null;
  }

  const finalizerText = typeof value.finalizerText === 'string' ? value.finalizerText : '';
  const architectData = isRecord(value.architectData)
    ? (value.architectData as unknown as CouncilSession['architectData'])
    : null;
  const criticData = isRecord(value.criticData)
    ? (value.criticData as unknown as CouncilSession['criticData'])
    : null;

  return {
    id: value.id,
    query: value.query,
    date: typeof value.date === 'string' ? value.date : new Date(0).toISOString(),
    summary: typeof value.summary === 'string' ? value.summary : '',
    agents: sanitizeAgents(value.agents),
    activePhase:
      value.activePhase === 0
      || value.activePhase === 1
      || value.activePhase === 2
      || value.activePhase === 3
      || value.activePhase === 4
        ? value.activePhase
        : deriveLoadPhase({
            finalizerText,
            architectData,
            criticData,
          }),
    status: sanitizeStatus(value.status),
    generatorStreams: sanitizeStringRecord(value.generatorStreams),
    agentModels: sanitizeStringRecord(value.agentModels),
    criticStream: typeof value.criticStream === 'string' ? value.criticStream : '',
    criticProgress: isRecord(value.criticProgress) && typeof value.criticProgress.model === 'string'
      ? { batch: Number(value.criticProgress.batch || 1), totalBatches: Number(value.criticProgress.totalBatches || 1), model: value.criticProgress.model }
      : null,
    criticData,
    architectStream: typeof value.architectStream === 'string' ? value.architectStream : '',
    architectModel: typeof value.architectModel === 'string' ? value.architectModel : null,
    architectData,
    finalizerModel: typeof value.finalizerModel === 'string' ? value.finalizerModel : null,
    finalizerText,
    issues: sanitizeIssues(value.issues),
    metrics: sanitizeMetrics(value.metrics),
  };
}

export function mergePersistedCouncilState<T extends MergeableCouncilState>(
  persistedState: unknown,
  currentState: T,
): T {
  const raw = isRecord(persistedState) ? persistedState : {};
  const rawSettings = isRecord(raw.settings) ? raw.settings : {};
  const legacyModels = sanitizeNvidiaModelOverrides(rawSettings.modelOverrides);
  const agentRegistry = sanitizeAgentRegistry(raw.agentRegistry, legacyModels);
  const agentDraft = Array.isArray(raw.agentDraft)
    ? sanitizeAgentRegistry(raw.agentDraft, {})
    : agentRegistry;
  const hydratedSessions = Array.isArray(raw.sessions)
    ? raw.sessions
        .map(sanitizeSession)
        .filter((session): session is CouncilSession => session !== null)
    : [];

  return {
    ...currentState,
    isStreaming: false,
    abortController: null,
    theme: raw.theme === 'dark' || raw.theme === 'light' ? raw.theme : currentState.theme,
    currentSessionId:
      typeof raw.currentSessionId === 'string' || raw.currentSessionId === null
        ? raw.currentSessionId
        : currentState.currentSessionId,
    settings: {
      // Keys saved before the NIM migration cannot authenticate with NVIDIA.
      apiKey: '',
      modelOverrides: sanitizePhaseModelOverrides(rawSettings.modelOverrides),
    },
    agentRegistry,
    agentDraft,
    agents: agentRegistry.map((agent) => ({ id: agent.id, name: agent.name, selected: true })),
    sessions: hydratedSessions,
  };
}
