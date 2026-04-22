import type { Agent, CouncilMetrics, CouncilSession, MetricData, MetricUsage, SessionIssue, SessionStatus } from './types';

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
    criticData,
    architectData,
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
      apiKey: typeof rawSettings.apiKey === 'string' ? rawSettings.apiKey : currentState.settings.apiKey,
      modelOverrides: sanitizeStringRecord(rawSettings.modelOverrides),
    },
    sessions: hydratedSessions,
  };
}
