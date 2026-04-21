export interface Agent {
  id: string;
  name: string;
  selected: boolean;
}

export interface MetricUsage {
  total: number;
  prompt: number;
  completion: number;
}

export interface MetricData {
  time: number;
  model: string;
  usage: MetricUsage;
}

export interface SessionIssue {
  id: string;
  message: string;
  timestamp: number;
  phase?: string;
  agent?: string;
  recoverable: boolean;
}

export interface CriticData {
  winner_id: string;
  rankings: string[];
  reasoning: string;
  flaws: Record<string, string | string[]>;
  scores: Record<string, number>;
  time_taken?: number;
  model?: string;
  usage?: MetricUsage;
}

export interface ArchitectData {
  structure: string[];
  tone_guidelines: string;
  missing_facts_to_add: string[];
  critique_integration?: string;
  time_taken?: number;
  model?: string;
  usage?: MetricUsage;
}

export type SessionStatus = 'idle' | 'streaming' | 'completed' | 'stopped' | 'error';
export type CouncilPhase = 0 | 1 | 2 | 3 | 4;

export interface CouncilMetrics {
  generators: Record<string, MetricData>;
  critic?: MetricData;
  architect?: MetricData;
  finalizer?: MetricData;
  totalTime: number;
  totalTokens: MetricUsage;
}

export interface CouncilSession {
  id: string;
  query: string;
  date: string;
  summary: string;
  agents: Agent[];
  activePhase: CouncilPhase;
  status: SessionStatus;
  generatorStreams: Record<string, string>;
  agentModels: Record<string, string>;
  criticData: CriticData | null;
  architectData: ArchitectData | null;
  finalizerText: string;
  issues: SessionIssue[];
  metrics: CouncilMetrics;
}

type BaseCouncilEvent = { type: string };

export interface GeneratorStartEvent extends BaseCouncilEvent {
  type: 'generator_start';
  agent: string;
  model: string;
}

export interface GeneratorChunkEvent extends BaseCouncilEvent {
  type: 'generator_chunk';
  agent: string;
  chunk: string;
}

export interface GeneratorDoneEvent extends BaseCouncilEvent {
  type: 'generator_done';
  agent: string;
  time_taken: number;
  model: string;
  usage: MetricUsage;
}

export interface CriticResultEvent extends CriticData {
  type: 'critic_result';
}

export interface ArchitectResultEvent extends ArchitectData {
  type: 'architect_result';
}

export interface FinalizerChunkEvent extends BaseCouncilEvent {
  type: 'finalizer_chunk';
  chunk: string;
}

export interface FinalizerDoneEvent extends BaseCouncilEvent {
  type: 'finalizer_done';
  time_taken: number;
  model: string;
  usage: MetricUsage;
}

export interface DoneEvent extends BaseCouncilEvent {
  type: 'done';
  total_execution_time: number;
  total_tokens: MetricUsage;
}

export interface ErrorEvent extends BaseCouncilEvent {
  type: 'error';
  message: string;
  phase?: string;
  agent?: string;
  recoverable?: boolean;
}

export type CouncilEvent =
  | GeneratorStartEvent
  | GeneratorChunkEvent
  | GeneratorDoneEvent
  | CriticResultEvent
  | ArchitectResultEvent
  | FinalizerChunkEvent
  | FinalizerDoneEvent
  | DoneEvent
  | ErrorEvent;

export interface ValidationState {
  status: 'valid' | 'invalid' | 'loading' | null;
  message?: string;
}

