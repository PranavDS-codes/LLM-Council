export interface Agent {
  id: string;
  name: string;
  selected: boolean;
}

export interface AgentRegistryEntry {
  id: string;
  name: string;
  personaInstruction: string;
  model: string;
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

export type FollowUpModel = 'openai/gpt-oss-20b' | 'openai/gpt-oss-120b';
export type FollowUpMessageStatus = 'streaming' | 'completed' | 'stopped' | 'error';

export interface FollowUpMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning: string;
  timestamp: number;
  model?: FollowUpModel;
  status?: FollowUpMessageStatus;
  usage?: MetricUsage;
  error?: string;
}

export interface FollowUpChat {
  selectedModel: FollowUpModel;
  messages: FollowUpMessage[];
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
  scorecards?: Record<string, CriticScorecard>;
  finalists?: string[];
}

export interface CriticScorecard {
  metric_scores: Record<string, number>;
  average: number;
  critique: string;
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
  generatorThinking: Record<string, string>;
  agentModels: Record<string, string>;
  criticStream: string;
  criticProgress: { batch: number; totalBatches: number; model: string } | null;
  criticThinking: Record<number, string>;
  criticData: CriticData | null;
  architectStream: string;
  architectThinking: string;
  architectModel: string | null;
  architectData: ArchitectData | null;
  finalizerModel: string | null;
  finalizerText: string;
  finalizerThinking: string;
  followUpChat: FollowUpChat;
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

export interface GeneratorThinkingEvent extends BaseCouncilEvent {
  type: 'generator_thinking';
  agent: string;
  chunk: string;
}

export interface GeneratorThinkingDoneEvent extends BaseCouncilEvent {
  type: 'generator_thinking_done';
  agent: string;
}

export interface CriticResultEvent extends CriticData {
  type: 'critic_result';
}

export interface CriticStartEvent extends BaseCouncilEvent {
  type: 'critic_start';
  model: string;
  batch: number;
  total_batches: number;
}

export interface CriticChunkEvent extends BaseCouncilEvent {
  type: 'critic_chunk';
  chunk: string;
}

export interface CriticDoneEvent extends BaseCouncilEvent {
  type: 'critic_done';
}

export interface CriticThinkingEvent extends BaseCouncilEvent {
  type: 'critic_thinking';
  batch: number;
  chunk: string;
}

export interface CriticThinkingDoneEvent extends BaseCouncilEvent {
  type: 'critic_thinking_done';
  batch: number;
}

export interface ArchitectResultEvent extends ArchitectData {
  type: 'architect_result';
}

export interface ArchitectStartEvent extends BaseCouncilEvent {
  type: 'architect_start';
  model: string;
}

export interface ArchitectChunkEvent extends BaseCouncilEvent {
  type: 'architect_chunk';
  chunk: string;
}

export interface ArchitectThinkingEvent extends BaseCouncilEvent {
  type: 'architect_thinking';
  chunk: string;
}

export interface ArchitectThinkingDoneEvent extends BaseCouncilEvent {
  type: 'architect_thinking_done';
}

export interface FinalizerStartEvent extends BaseCouncilEvent {
  type: 'finalizer_start';
  model: string;
}

export interface FinalizerChunkEvent extends BaseCouncilEvent {
  type: 'finalizer_chunk';
  chunk: string;
}

export interface FinalizerThinkingEvent extends BaseCouncilEvent {
  type: 'finalizer_thinking';
  chunk: string;
}

export interface FinalizerThinkingDoneEvent extends BaseCouncilEvent {
  type: 'finalizer_thinking_done';
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

export interface ChatStartEvent extends BaseCouncilEvent {
  type: 'chat_start';
  model: FollowUpModel;
}

export interface ChatReasoningChunkEvent extends BaseCouncilEvent {
  type: 'chat_reasoning_chunk';
  chunk: string;
}

export interface ChatContentChunkEvent extends BaseCouncilEvent {
  type: 'chat_content_chunk';
  chunk: string;
}

export interface ChatDoneEvent extends BaseCouncilEvent {
  type: 'chat_done';
  model: FollowUpModel;
  usage: MetricUsage;
}

export interface ChatErrorEvent extends BaseCouncilEvent {
  type: 'chat_error';
  message: string;
  recoverable: boolean;
}

export type FollowUpChatEvent = ChatStartEvent | ChatReasoningChunkEvent | ChatContentChunkEvent | ChatDoneEvent | ChatErrorEvent;

export type CouncilEvent =
  | GeneratorStartEvent
  | GeneratorChunkEvent
  | GeneratorDoneEvent
  | GeneratorThinkingEvent
  | GeneratorThinkingDoneEvent
  | CriticStartEvent
  | CriticChunkEvent
  | CriticDoneEvent
  | CriticThinkingEvent
  | CriticThinkingDoneEvent
  | CriticResultEvent
  | ArchitectStartEvent
  | ArchitectChunkEvent
  | ArchitectThinkingEvent
  | ArchitectThinkingDoneEvent
  | ArchitectResultEvent
  | FinalizerStartEvent
  | FinalizerChunkEvent
  | FinalizerThinkingEvent
  | FinalizerThinkingDoneEvent
  | FinalizerDoneEvent
  | DoneEvent
  | ErrorEvent;

export interface ValidationState {
  status: 'valid' | 'invalid' | 'loading' | null;
  message?: string;
}
