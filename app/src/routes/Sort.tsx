import { useMemo } from 'react';
import { GameConfigSchema, type GameConfig } from '@values-cards/shared';
import { SortRound } from '../engine-ui/SortRound';
import { createSortStore } from '../stores/createSortStore';

// Placeholder session identity until 01.2 (client session layer) wires a
// real join flow. The sort loop itself is fully local and config-driven —
// this route just needs *some* session code + participant id + config to
// demonstrate it.
const SESSION_CODE = 'DEMO01';
const PARTICIPANT_ID_KEY = 'vc:demo:participantId';

const DEMO_CONFIG: GameConfig = GameConfigSchema.parse({
  title: 'Demo',
  deck: {
    name: 'Demo deck',
    cards: [
      { value: 'Courage', description: 'Acting despite fear' },
      { value: 'Curiosity', description: 'Seeking to understand' },
      { value: 'Integrity', description: 'Consistency of values and action' },
      { value: 'Trust', description: 'Confidence in others’ intentions' },
      { value: 'Growth', description: 'Committing to improve' },
      { value: 'Empathy', description: 'Understanding others’ experience' },
      { value: 'Discipline', description: 'Doing what matters most' },
      { value: 'Humility', description: 'Openness to being wrong' },
      { value: 'Resilience', description: 'Recovering from setbacks' },
      { value: 'Fairness', description: 'Treating others equitably' },
      { value: 'Creativity', description: 'Generating novel ideas' },
      { value: 'Gratitude', description: 'Appreciating what is given' },
    ],
  },
  rounds: [{ name: 'Round 1', keep: 6, rank: false }],
  theme: { variant: 'default' },
  facilitated: false,
});

function getDemoParticipantId(): string {
  const existing = localStorage.getItem(PARTICIPANT_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(PARTICIPANT_ID_KEY, id);
  return id;
}

export function Sort() {
  const useSortStore = useMemo(() => {
    const participantId = getDemoParticipantId();
    return createSortStore(SESSION_CODE, participantId, DEMO_CONFIG);
  }, []);

  return <SortRound config={DEMO_CONFIG} useSortStore={useSortStore} />;
}
