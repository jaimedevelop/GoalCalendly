import type { Goal } from '../types';

export interface CelebrationEvent {
  id: string;
  userId: string | null;
  goalId: string;
  goalName: string;
  source: 'timer' | 'manual' | 'completion' | 'preview';
  kind: 'timer' | 'trophy' | 'error' | 'completed';
  durationMs: number;
  periodKeys: string[];
  saveState: 'saving' | 'saved' | 'empty' | 'failed';
  createdAt: number;
  error?: string;
  dismissed?: boolean;
  suppressed?: boolean;
  /** Explicit admin preview choice; never applied to real session events. */
  fullMotionPreview?: boolean;
}

export interface FailedSession {
  event: CelebrationEvent;
  snapshot: Goal;
}
