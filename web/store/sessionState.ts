import type {
  Agent,
  ArchitectData,
  ArchitectResultEvent,
  CouncilEvent,
  CouncilSession,
  CriticData,
  CriticResultEvent,
  ErrorEvent,
  FinalizerDoneEvent,
  GeneratorDoneEvent,
  MetricData,
  MetricUsage,
} from './types';

export function emptyUsage(): MetricUsage {
  return { total: 0, prompt: 0, completion: 0 };
}

export function createSession(id: string, query: string, agents: Agent[]): CouncilSession {
  return {
    id,
    query,
    date: new Date().toISOString(),
    summary: 'Council briefing in progress...',
    agents: JSON.parse(JSON.stringify(agents)),
    activePhase: 1,
    status: 'streaming',
    generatorStreams: {},
    agentModels: {},
    criticData: null,
    architectData: null,
    finalizerText: '',
    issues: [],
    metrics: {
      generators: {},
      totalTime: 0,
      totalTokens: emptyUsage(),
    },
  };
}

export function deriveLoadPhase(session: Pick<CouncilSession, 'finalizerText' | 'architectData' | 'criticData'>): 1 | 2 | 3 | 4 {
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

export function getSessionSummary(session: Pick<CouncilSession, 'status' | 'finalizerText' | 'issues'>): string {
  const finalText = session.finalizerText.trim();
  if (finalText) {
    return `${finalText.slice(0, 120)}${finalText.length > 120 ? '...' : ''}`;
  }
  if (session.status === 'stopped') {
    return 'Stopped before the final verdict was delivered.';
  }
  if (session.status === 'error') {
    const latestIssue = session.issues[session.issues.length - 1];
    return latestIssue?.message || 'Session ended with an unrecoverable error.';
  }
  if (session.issues.length > 0) {
    return 'Completed with recoverable issues.';
  }
  return 'Council briefing in progress...';
}

function mergeCriticData(previous: CriticData | null, incoming: CriticResultEvent): CriticData {
  const previousReasoning = previous?.reasoning?.trim();
  const nextReasoning = incoming.reasoning?.trim();

  return {
    ...previous,
    ...incoming,
    scores: { ...(previous?.scores || {}), ...(incoming.scores || {}) },
    flaws: { ...(previous?.flaws || {}), ...(incoming.flaws || {}) },
    reasoning: [previousReasoning, nextReasoning].filter(Boolean).join('\n\n---\n\n'),
    rankings: incoming.rankings || previous?.rankings || [],
    winner_id: [previous?.winner_id, incoming.winner_id].filter(Boolean).join(' & '),
  };
}

function addIssue(session: CouncilSession, event: ErrorEvent): CouncilSession {
  return {
    ...session,
    issues: [
      ...session.issues,
      {
        id: crypto.randomUUID(),
        message: event.message,
        timestamp: Date.now(),
        phase: event.phase,
        agent: event.agent,
        recoverable: event.recoverable ?? true,
      },
    ],
  };
}

function updateGeneratorMetric(
  session: CouncilSession,
  event: GeneratorDoneEvent,
): CouncilSession {
  const metric: MetricData = {
    time: event.time_taken,
    model: event.model,
    usage: event.usage,
  };

  return {
    ...session,
    metrics: {
      ...session.metrics,
      generators: {
        ...session.metrics.generators,
        [event.agent]: metric,
      },
    },
  };
}

function updatePhaseMetric<T extends ArchitectResultEvent | CriticResultEvent | FinalizerDoneEvent>(
  session: CouncilSession,
  phase: 'critic' | 'architect' | 'finalizer',
  event: T,
): CouncilSession {
  const previousMetric = session.metrics[phase];
  const usage = event.usage || emptyUsage();
  const mergedMetric: MetricData = phase === 'critic' && previousMetric
    ? {
        time: previousMetric.time + (event.time_taken || 0),
        model: event.model || previousMetric.model,
        usage: {
          total: previousMetric.usage.total + usage.total,
          prompt: previousMetric.usage.prompt + usage.prompt,
          completion: previousMetric.usage.completion + usage.completion,
        },
      }
    : {
        time: event.time_taken || 0,
        model: event.model || 'N/A',
        usage,
      };

  return {
    ...session,
    metrics: {
      ...session.metrics,
      [phase]: mergedMetric,
    },
  };
}

export function applyCouncilEvent(session: CouncilSession, event: CouncilEvent): CouncilSession {
  switch (event.type) {
    case 'generator_start': {
      const nextSession: CouncilSession = {
        ...session,
        activePhase: 1,
        status: 'streaming',
        agentModels: {
          ...session.agentModels,
          [event.agent]: event.model,
        },
      };
      nextSession.summary = getSessionSummary(nextSession);
      return nextSession;
    }

    case 'generator_chunk': {
      const nextSession: CouncilSession = {
        ...session,
        activePhase: 1,
        status: 'streaming',
        generatorStreams: {
          ...session.generatorStreams,
          [event.agent]: `${session.generatorStreams[event.agent] || ''}${event.chunk}`,
        },
      };
      nextSession.summary = getSessionSummary(nextSession);
      return nextSession;
    }

    case 'generator_done': {
      const nextSession = updateGeneratorMetric(session, event);
      nextSession.summary = getSessionSummary(nextSession);
      return nextSession;
    }

    case 'critic_result': {
      const withMetric = updatePhaseMetric(
        {
          ...session,
          activePhase: Math.max(session.activePhase, 2) as CouncilSession['activePhase'],
          status: 'streaming',
          criticData: mergeCriticData(session.criticData, event),
        },
        'critic',
        event,
      );
      withMetric.summary = getSessionSummary(withMetric);
      return withMetric;
    }

    case 'architect_result': {
      const withMetric = updatePhaseMetric(
        {
          ...session,
          activePhase: Math.max(session.activePhase, 3) as CouncilSession['activePhase'],
          status: 'streaming',
          architectData: event as ArchitectData,
        },
        'architect',
        event,
      );
      withMetric.summary = getSessionSummary(withMetric);
      return withMetric;
    }

    case 'finalizer_chunk': {
      const nextSession: CouncilSession = {
        ...session,
        activePhase: 4,
        status: 'streaming',
        finalizerText: `${session.finalizerText}${event.chunk}`,
      };
      nextSession.summary = getSessionSummary(nextSession);
      return nextSession;
    }

    case 'finalizer_done': {
      const withMetric = updatePhaseMetric(session, 'finalizer', event);
      withMetric.summary = getSessionSummary(withMetric);
      return withMetric;
    }

    case 'error': {
      const withIssue = addIssue(session, event);
      if (event.recoverable === false) {
        withIssue.status = 'error';
      }
      withIssue.summary = getSessionSummary(withIssue);
      return withIssue;
    }

    case 'done': {
      const status = session.status === 'stopped'
        ? 'stopped'
        : session.status === 'error' && !session.finalizerText
          ? 'error'
          : 'completed';
      const nextSession: CouncilSession = {
        ...session,
        activePhase: Math.max(session.activePhase, 4) as CouncilSession['activePhase'],
        status,
        metrics: {
          ...session.metrics,
          totalTime: event.total_execution_time,
          totalTokens: event.total_tokens,
        },
      };
      nextSession.summary = getSessionSummary(nextSession);
      return nextSession;
    }

    default:
      return session;
  }
}

export function stopSessionState(session: CouncilSession): CouncilSession {
  const stoppedSession = addIssue(session, {
    type: 'error',
    message: 'Session stopped by user.',
    recoverable: true,
    phase: `phase-${session.activePhase}`,
  });
  stoppedSession.status = 'stopped';
  stoppedSession.summary = getSessionSummary(stoppedSession);
  return stoppedSession;
}
