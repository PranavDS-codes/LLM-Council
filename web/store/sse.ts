import type {
  ArchitectResultEvent,
  ArchitectStartEvent,
  ArchitectThinkingDoneEvent,
  ArchitectThinkingEvent,
  CouncilEvent,
  CriticStartEvent,
  CriticThinkingDoneEvent,
  CriticThinkingEvent,
  CriticResultEvent,
  DoneEvent,
  ErrorEvent,
  FinalizerDoneEvent,
  FinalizerStartEvent,
  FinalizerThinkingDoneEvent,
  FinalizerThinkingEvent,
  FollowUpChatEvent,
  ChatDoneEvent,
  ChatErrorEvent,
  ChatStartEvent,
  GeneratorDoneEvent,
  GeneratorStartEvent,
  GeneratorThinkingDoneEvent,
  GeneratorThinkingEvent,
  MetricUsage,
} from './types';

export interface ParsedSseResult {
  buffer: string;
  events: CouncilEvent[];
}

function toUsage(value: unknown): MetricUsage {
  if (!value || typeof value !== 'object') {
    return { total: 0, prompt: 0, completion: 0 };
  }

  const maybeUsage = value as Partial<MetricUsage>;
  return {
    total: Number(maybeUsage.total || 0),
    prompt: Number(maybeUsage.prompt || 0),
    completion: Number(maybeUsage.completion || 0),
  };
}

function normalizeEvent(type: string, payload: Record<string, unknown>): CouncilEvent | null {
  switch (type) {
    case 'generator_start':
      if (typeof payload.agent === 'string' && typeof payload.model === 'string') {
        return {
          type,
          agent: payload.agent,
          model: payload.model,
        } satisfies GeneratorStartEvent;
      }
      return null;

    case 'generator_chunk':
      if (typeof payload.agent === 'string' && typeof payload.chunk === 'string') {
        return { type, agent: payload.agent, chunk: payload.chunk };
      }
      return null;

    case 'generator_done':
      if (typeof payload.agent === 'string' && typeof payload.model === 'string') {
        return {
          type,
          agent: payload.agent,
          time_taken: Number(payload.time_taken || 0),
          model: payload.model,
          usage: toUsage(payload.usage),
        } satisfies GeneratorDoneEvent;
      }
      return null;

    case 'generator_thinking':
      return typeof payload.agent === 'string' && typeof payload.chunk === 'string'
        ? { type, agent: payload.agent, chunk: payload.chunk } satisfies GeneratorThinkingEvent
        : null;

    case 'generator_thinking_done':
      return typeof payload.agent === 'string' ? { type, agent: payload.agent } satisfies GeneratorThinkingDoneEvent : null;

    case 'critic_result':
      return {
        type,
        winner_id: String(payload.winner_id || ''),
        rankings: Array.isArray(payload.rankings) ? payload.rankings.map(String) : [],
        reasoning: String(payload.reasoning || ''),
        flaws: typeof payload.flaws === 'object' && payload.flaws ? payload.flaws as CriticResultEvent['flaws'] : {},
        scores: typeof payload.scores === 'object' && payload.scores
          ? Object.fromEntries(Object.entries(payload.scores).map(([key, value]) => [key, Number(value)]))
          : {},
        scorecards: typeof payload.scorecards === 'object' && payload.scorecards
          ? Object.fromEntries(Object.entries(payload.scorecards).flatMap(([agent, value]) => {
              if (!value || typeof value !== 'object') return [];
              const card = value as Record<string, unknown>;
              const metricScores = card.metric_scores;
              if (!metricScores || typeof metricScores !== 'object') return [];
              return [[agent, {
                metric_scores: Object.fromEntries(Object.entries(metricScores).map(([metric, score]) => [metric, Number(score)])),
                average: Number(card.average || 0),
                critique: String(card.critique || ''),
              }]];
            }))
          : undefined,
        finalists: Array.isArray(payload.finalists) ? payload.finalists.map(String) : undefined,
        time_taken: Number(payload.time_taken || 0),
        model: typeof payload.model === 'string' ? payload.model : 'N/A',
        usage: toUsage(payload.usage),
      } satisfies CriticResultEvent;

    case 'critic_start':
      if (typeof payload.model === 'string') {
        return { type, model: payload.model, batch: Number(payload.batch || 1), total_batches: Number(payload.total_batches || 1) } satisfies CriticStartEvent;
      }
      return null;

    case 'critic_chunk':
      return typeof payload.chunk === 'string' ? { type, chunk: payload.chunk } : null;

    case 'critic_done':
      return { type };

    case 'critic_thinking':
      return typeof payload.chunk === 'string'
        ? { type, batch: Number(payload.batch || 1), chunk: payload.chunk } satisfies CriticThinkingEvent
        : null;

    case 'critic_thinking_done':
      return { type, batch: Number(payload.batch || 1) } satisfies CriticThinkingDoneEvent;

    case 'architect_result':
      return {
        type,
        structure: Array.isArray(payload.structure) ? payload.structure.map(String) : [],
        tone_guidelines: String(payload.tone_guidelines || ''),
        missing_facts_to_add: Array.isArray(payload.missing_facts_to_add)
          ? payload.missing_facts_to_add.map(String)
          : [],
        critique_integration: typeof payload.critique_integration === 'string'
          ? payload.critique_integration
          : undefined,
        time_taken: Number(payload.time_taken || 0),
        model: typeof payload.model === 'string' ? payload.model : 'N/A',
        usage: toUsage(payload.usage),
      } satisfies ArchitectResultEvent;

    case 'architect_start':
      return typeof payload.model === 'string' ? { type, model: payload.model } satisfies ArchitectStartEvent : null;

    case 'architect_chunk':
      return typeof payload.chunk === 'string' ? { type, chunk: payload.chunk } : null;

    case 'architect_thinking':
      return typeof payload.chunk === 'string' ? { type, chunk: payload.chunk } satisfies ArchitectThinkingEvent : null;

    case 'architect_thinking_done':
      return { type } satisfies ArchitectThinkingDoneEvent;

    case 'finalizer_start':
      return typeof payload.model === 'string' ? { type, model: payload.model } satisfies FinalizerStartEvent : null;

    case 'finalizer_chunk':
      if (typeof payload.chunk === 'string') {
        return { type, chunk: payload.chunk };
      }
      return null;

    case 'finalizer_thinking':
      return typeof payload.chunk === 'string' ? { type, chunk: payload.chunk } satisfies FinalizerThinkingEvent : null;

    case 'finalizer_thinking_done':
      return { type } satisfies FinalizerThinkingDoneEvent;

    case 'finalizer_done':
      return {
        type,
        time_taken: Number(payload.time_taken || 0),
        model: typeof payload.model === 'string' ? payload.model : 'N/A',
        usage: toUsage(payload.usage),
      } satisfies FinalizerDoneEvent;

    case 'done':
      return {
        type,
        total_execution_time: Number(payload.total_execution_time || 0),
        total_tokens: toUsage(payload.total_tokens),
      } satisfies DoneEvent;

    case 'error':
      return {
        type,
        message: String(payload.message || 'Malformed stream event received.'),
        phase: typeof payload.phase === 'string' ? payload.phase : undefined,
        agent: typeof payload.agent === 'string' ? payload.agent : undefined,
        recoverable: typeof payload.recoverable === 'boolean' ? payload.recoverable : true,
      } satisfies ErrorEvent;

    default:
      return null;
  }
}

function parseFrame(frame: string): CouncilEvent | null {
  const lines = frame
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);

  let eventType = '';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  try {
    const payload = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
    const type = eventType || String(payload.type || '');
    return normalizeEvent(type, payload)
      || ({
        type: 'error',
        message: `Unknown stream event received: ${type || 'unknown'}.`,
        recoverable: true,
      } satisfies ErrorEvent);
  } catch {
    return {
      type: 'error',
      message: 'Malformed stream event received from the server.',
      recoverable: true,
    } satisfies ErrorEvent;
  }
}

export function parseSseChunk(buffer: string, chunk: string): ParsedSseResult {
  const normalized = `${buffer}${chunk}`.replace(/\r\n/g, '\n');
  const frames = normalized.split('\n\n');
  const nextBuffer = frames.pop() ?? '';
  const events = frames
    .map(parseFrame)
    .filter((event): event is CouncilEvent => event !== null);

  return {
    buffer: nextBuffer,
    events,
  };
}

export interface ParsedFollowUpSseResult {
  buffer: string;
  events: FollowUpChatEvent[];
}

function normalizeFollowUpEvent(type: string, payload: Record<string, unknown>): FollowUpChatEvent | null {
  const model = payload.model;
  const supportedModel = model === 'openai/gpt-oss-20b' || model === 'openai/gpt-oss-120b';
  switch (type) {
    case 'chat_start':
      return supportedModel ? { type, model } satisfies ChatStartEvent : null;
    case 'chat_reasoning_chunk':
      return typeof payload.chunk === 'string' ? { type, chunk: payload.chunk } : null;
    case 'chat_content_chunk':
      return typeof payload.chunk === 'string' ? { type, chunk: payload.chunk } : null;
    case 'chat_done':
      return supportedModel ? { type, model, usage: toUsage(payload.usage) } satisfies ChatDoneEvent : null;
    case 'chat_error':
      return { type, message: String(payload.message || 'Follow-up chat stream failed.'), recoverable: payload.recoverable !== false } satisfies ChatErrorEvent;
    default:
      return null;
  }
}

function parseFollowUpFrame(frame: string): FollowUpChatEvent | null {
  const lines = frame.split('\n').map((line) => line.trimEnd()).filter(Boolean);
  let eventType = '';
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('event:')) eventType = line.slice('event:'.length).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trimStart());
  }
  if (!dataLines.length) return null;
  try {
    const payload = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
    return normalizeFollowUpEvent(eventType || String(payload.type || ''), payload)
      || { type: 'chat_error', message: 'Malformed follow-up chat event received.', recoverable: true };
  } catch {
    return { type: 'chat_error', message: 'Malformed follow-up chat event received.', recoverable: true };
  }
}

export function parseFollowUpSseChunk(buffer: string, chunk: string): ParsedFollowUpSseResult {
  const normalized = `${buffer}${chunk}`.replace(/\r\n/g, '\n');
  const frames = normalized.split('\n\n');
  const nextBuffer = frames.pop() ?? '';
  return {
    buffer: nextBuffer,
    events: frames.map(parseFollowUpFrame).filter((event): event is FollowUpChatEvent => event !== null),
  };
}
