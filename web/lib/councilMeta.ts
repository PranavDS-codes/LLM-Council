import { type LucideIcon, Brain, Gavel, Shield, User, Zap } from 'lucide-react';

import type { Agent, CouncilPhase, SessionStatus } from '@/store/types';

export const AGENT_ICONS: Record<string, LucideIcon> = {
  'The Academic': Brain,
  'The Layman': User,
  'The Skeptic': Shield,
  'The Futurist': Zap,
  'The Ethical Guardian': Gavel,
};

export function getSelectedAgents(agents: Agent[]): Agent[] {
  return agents.filter((agent) => agent.selected);
}

export function getPhaseStatusLabel(
  activePhase: CouncilPhase,
  status: SessionStatus,
): string {
  const phaseLabel = (() => {
    switch (activePhase) {
      case 1:
        return 'Generator';
      case 2:
        return 'Critic';
      case 3:
        return 'Blueprint';
      case 4:
        return 'Synthesis';
      default:
        return 'Ready';
    }
  })();

  if (status === 'stopped') {
    return `Paused in ${phaseLabel}`;
  }

  if (status === 'error') {
    return `Blocked in ${phaseLabel}`;
  }

  return phaseLabel;
}
