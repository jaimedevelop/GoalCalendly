import { create } from 'zustand';
import { Goal, Timer, GoalSettings, DEFAULT_GOAL_SETTINGS, Entitlement } from './types';
import { addDays, isValid, startOfDay } from 'date-fns';
import { normalizeProgress, practiceTimeUpdates } from './services/practiceTime';
import { AuthUser } from './services/auth.js';
import { createGoal, updateGoalFields, completeGoal, deleteGoalRemote, saveGoalSnapshots } from './services/goals.js';
import { containsSessionProgress, newlyEarnedPeriods } from './services/celebrations';
import type { CelebrationEvent, FailedSession } from './types/celebrations';

interface Store {
  authGeneration: number;
  celebrations: CelebrationEvent[];
  failedSessions: FailedSession[];
  celebratedPeriods: string[];
  dismissCelebration: (id: string) => void;
  confirmProgressSaved: (snapshot: Goal, event?: CelebrationEvent) => void;
  previewCelebration: (kind: 'timer' | 'trophy') => void;
  goals: Goal[];
  /** Most recently started timer (or idle state); kept for single-timer consumers. */
  activeTimer: { goalId: string | null } & Timer;
  /** All running timers, most recently started first. Lowering the limit preserves running timers. */
  activeTimers: ({ goalId: string } & Timer)[];
  /** User preference: how many timers may run at once. Stored per device. */
  maxActiveTimers: number;
  setMaxActiveTimers: (max: number) => void;
  defaultSettings: GoalSettings;
  user: AuthUser | null;
  isAuthLoading: boolean;
  /**
   * Server-owned entitlement, subscribed live once in App.tsx (see
   * src/hooks/useSubscription.ts) and read from here everywhere else so
   * every component agrees on the same effective plan/ad-eligibility
   * without each mounting its own Firestore listener. null before the
   * first snapshot arrives or while signed out — components should treat
   * that as "unknown yet", not "confirmed Free" (admin_subscriptions.md
   * section 7: never treat a transient read gap as a confirmed downgrade).
   */
  entitlement: Entitlement | null;
  isEntitlementLoading: boolean;
  setEntitlement: (entitlement: Entitlement | null, isLoading: boolean) => void;
  /** Set to a human-readable message when the server rejects the most recent goal mutation. Cleared on the next successful one. */
  lastGoalError: string | null;
  saveGoals: () => Promise<boolean>;
  addGoal: (goal: Goal) => Promise<boolean>;
  updateGoal: (goalId: string, updates: Partial<Goal>) => Promise<boolean>;
  completeGoalById: (goalId: string) => Promise<boolean>;
  deleteGoal: (goalId: string) => Promise<boolean>;
  startTimer: (goalId: string) => void;
  stopTimer: (goalId?: string, options?: { completion: boolean }) => Promise<boolean>;
  addManualTime: (goalId: string, date: Date, minutes: number) => Promise<boolean>;
  resetTimer: () => void;
  setGoals: (goals: Goal[]) => void;
  updateDefaultSettings: (settings: Partial<GoalSettings>) => void;
  setUser: (user: AuthUser | null) => void;
  setAuthLoading: (loading: boolean) => void;
  clearUserData: () => void;
  canAddGoal: () => boolean;
  getGoalLimit: () => number;
}

/**
 * True only once we have positive confirmation the user should see ads:
 * a loaded, non-null entitlement with hasAdvertising set. Loading/unknown
 * state and admins never show ads, matching the effective-access policy in
 * functions/src/lib/entitlements.ts.
 */
export const DEFAULT_MAX_ACTIVE_TIMERS = 3;
export const MAX_ACTIVE_TIMERS_LIMIT = 20;
const MAX_TIMERS_KEY = 'max-active-timers';
let celebrationSequence = 0;

function clampMaxTimers(value: number) {
  return Number.isFinite(value)
    ? Math.min(MAX_ACTIVE_TIMERS_LIMIT, Math.max(1, Math.floor(value)))
    : DEFAULT_MAX_ACTIVE_TIMERS;
}

function loadMaxTimers() {
  try {
    const stored = localStorage.getItem(MAX_TIMERS_KEY);
    return stored === null ? DEFAULT_MAX_ACTIVE_TIMERS : clampMaxTimers(Number(stored));
  } catch {
    return DEFAULT_MAX_ACTIVE_TIMERS;
  }
}
const IDLE_TIMER = { goalId: null, isRunning: false, startTime: null, elapsedTime: 0 } as const;

function withTimers(timers: ({ goalId: string } & Timer)[]) {
  return { activeTimers: timers, activeTimer: timers[0] ?? { ...IDLE_TIMER } };
}

export function shouldShowAds(entitlement: Entitlement | null, isLoading: boolean): boolean {
  if (isLoading || !entitlement) return false;
  return entitlement.hasAdvertising;
}

export const useStore = create<Store>((set, get) => ({
  authGeneration: 0,
  celebrations: [],
  failedSessions: [],
  celebratedPeriods: [],
  dismissCelebration: (id) => set(state => ({
    celebrations: state.celebrations.flatMap(event => event.id !== id ? [event]
      : event.saveState === 'saving' ? [{ ...event, dismissed: true }] : []),
  })),
  confirmProgressSaved: (snapshot, event) => set(state => {
    const recovered = state.failedSessions.filter(session => containsSessionProgress(snapshot, session.snapshot));
    const candidates = [...recovered.map(session => ({ ...session.event, suppressed: false })), ...(event ? [event] : [])];
    const celebratedPeriods = [...state.celebratedPeriods];
    let celebrations = [...state.celebrations];
    for (const candidate of candidates) {
      if (!state.goals.some(goal => goal.id === candidate.goalId)) continue;
      const current = celebrations.find(item => item.id === candidate.id) ?? candidate;
      const periodKeys = candidate.periodKeys.filter(key => !celebratedPeriods.includes(`${candidate.goalId}:${key}`));
      celebratedPeriods.push(...periodKeys.map(key => `${candidate.goalId}:${key}`));
      const confirmed: CelebrationEvent = {
        ...current, periodKeys, kind: periodKeys.length ? 'trophy' : 'timer',
        saveState: candidate.durationMs > 0 ? 'saved' : 'empty',
        dismissed: periodKeys.length ? false : current.dismissed, error: undefined,
        suppressed: candidate.suppressed,
      };
      const index = celebrations.findIndex(item => item.id === candidate.id);
      if (confirmed.dismissed || (candidate.source === 'manual' && !periodKeys.length)) {
        celebrations = celebrations.filter(item => item.id !== candidate.id);
      } else if (index >= 0) celebrations[index] = confirmed;
      else if (periodKeys.length) celebrations.push(confirmed);
    }
    return { celebrations, celebratedPeriods,
      failedSessions: state.failedSessions.filter(session => !recovered.includes(session)) };
  }),
  previewCelebration: (kind) => {
    const user = get().user;
    if (!user?.isTrustedAdmin) return;
    const event: CelebrationEvent = {
      id: `preview:${++celebrationSequence}`, userId: user.uid, goalId: 'preview', goalName: 'Focus session',
      source: 'preview', kind, durationMs: 25 * 60000,
      periodKeys: kind === 'trophy' ? ['weekly:preview'] : [], saveState: 'saved', createdAt: Date.now(),
    };
    set(state => ({ celebrations: [...state.celebrations.filter(item => item.source !== 'preview'), event] }));
  },
  goals: [],
  activeTimer: { ...IDLE_TIMER },
  activeTimers: [],
  maxActiveTimers: loadMaxTimers(),
  setMaxActiveTimers: (max) => {
    const value = clampMaxTimers(max);
    try { localStorage.setItem(MAX_TIMERS_KEY, String(value)); } catch { /* Preference stays in memory. */ }
    set({ maxActiveTimers: value });
  },
  defaultSettings: DEFAULT_GOAL_SETTINGS,
  user: null,
  isAuthLoading: true,
  entitlement: null,
  isEntitlementLoading: true,
  setEntitlement: (entitlement, isLoading) => set({ entitlement, isEntitlementLoading: isLoading }),
  lastGoalError: null,
  saveGoals: async () => {
    const generation = get().authGeneration;
    const snapshots = get().goals.map(goal => JSON.parse(JSON.stringify(goal)) as Goal);
    set({ lastGoalError: null });
    const result = await saveGoalSnapshots(snapshots);
    if (generation !== get().authGeneration) return false;
    if (!result.ok) set({ lastGoalError: result.error?.message ?? 'Could not save all goals. Please try again.' });
    else snapshots.forEach(snapshot => get().confirmProgressSaved(snapshot));
    return result.ok;
  },
  addGoal: async (goal) => {
    const newGoal = { ...goal, weeklyTrophies: [] };
    // Optimistic local add for responsive UI; rolled back if the server rejects it
    // (e.g. over the active-goal limit) rather than reporting false success.
    set((state) => ({ goals: [...state.goals, newGoal], lastGoalError: null }));

    const result = await createGoal(newGoal);
    if (!result.ok) {
      set((state) => ({
        goals: state.goals.filter((g) => g.id !== newGoal.id),
        lastGoalError: result.error?.message ?? 'Could not create this goal.',
      }));
      return false;
    }
    return true;
  },
  updateGoal: async (goalId, updates) => {
    const generation = get().authGeneration;
    const previous = get().goals.find((g) => g.id === goalId);
    if (!previous) return false;

    set((state) => ({
      goals: state.goals.map((goal) => (goal.id === goalId ? { ...goal, ...updates } : goal)),
      lastGoalError: null,
    }));

    const result = await updateGoalFields(goalId, updates);
    if (generation !== get().authGeneration) return false;
    if (!result.ok) {
      set((state) => ({
        goals: state.goals.map((goal) => (goal.id === goalId ? previous : goal)),
        lastGoalError: result.error?.message ?? 'Could not save this change.',
      }));
      return false;
    }
    return true;
  },
  completeGoalById: async (goalId) => {
    // Finish this session before hiding the goal, preserving its recorded time
    // even if completion is rejected by the server.
    const generation = get().authGeneration;
    const stopped = get().stopTimer(goalId, { completion: true });
    const previous = get().goals.find((g) => g.id === goalId);
    if (!previous) return false;
    const completedDate = new Date().toISOString();

    set((state) => ({
      goals: state.goals.map((goal) => (goal.id === goalId ? { ...goal, completed: true, completedDate } : goal)),
      lastGoalError: null,
    }));

    const result = await completeGoal(goalId);
    await stopped;
    if (generation !== get().authGeneration) return false;
    set(state => ({ celebrations: state.celebrations.flatMap(event => {
      if (event.goalId !== goalId || !event.suppressed) return [event];
      return result.ok && event.kind === 'timer' ? [] : [{ ...event, suppressed: false }];
    }) }));
    if (!result.ok) {
      set((state) => ({
        goals: state.goals.map((goal) => (goal.id === goalId ? previous : goal)),
        lastGoalError: result.error?.message ?? 'Could not mark this goal complete.',
      }));
      return false;
    }
    const completionEvent: CelebrationEvent = {
      id: `completed:${++celebrationSequence}`, userId: get().user?.uid ?? null, goalId,
      goalName: previous.name, source: 'completion', kind: 'completed', durationMs: 0,
      periodKeys: [], saveState: 'saved', createdAt: Date.now(),
    };
    set(state => ({ celebrations: [...state.celebrations, completionEvent] }));
    return true;
  },
  deleteGoal: async (goalId) => {
    const generation = get().authGeneration;
    const state = get();
    const previous = state.goals.find((g) => g.id === goalId);
    if (!previous) return false;
    const removedTimer = state.activeTimers.find(t => t.goalId === goalId);

    set((s) => ({
      goals: s.goals.filter((goal) => goal.id !== goalId),
      ...withTimers(s.activeTimers.filter(t => t.goalId !== goalId)),
      lastGoalError: null,
    }));

    const result = await deleteGoalRemote(goalId);
    if (generation !== get().authGeneration) return false;
    if (!result.ok) {
      set((s) => ({
        goals: [...s.goals, previous],
        ...withTimers(removedTimer
          ? [...s.activeTimers, removedTimer].sort((a, b) => (b.startTime ?? 0) - (a.startTime ?? 0))
          : s.activeTimers),
        lastGoalError: result.error?.message ?? 'Could not delete this goal.',
      }));
      return false;
    }
    set(state => ({ celebrations: state.celebrations.filter(event => event.goalId !== goalId),
      failedSessions: state.failedSessions.filter(session => session.event.goalId !== goalId) }));
    return true;
  },
  startTimer: (goalId) =>
    set((state) => {
      if (!state.goals.some(goal => goal.id === goalId && !goal.completed)) return state;
      if (state.activeTimers.some(t => t.goalId === goalId)) return state;
      if (state.activeTimers.length >= state.maxActiveTimers) {
        return { lastGoalError: `You can run up to ${state.maxActiveTimers} timers at once. Stop one first or raise the limit in Settings.` };
      }
      const startTime = Date.now();
      const generation = state.authGeneration;
      const goals = state.goals.map(goal =>
        goal.id === goalId ? { ...goal, lastTimerStartedAt: startTime } : goal
      );
      // lastTimerStartedAt is a low-stakes UX field (goal ordering); persisted
      // best-effort via updateGoal rather than blocking timer start on a round trip.
      void updateGoalFields(goalId, { lastTimerStartedAt: startTime }).then(result => {
        if (generation !== get().authGeneration) return;
        if (!result.ok) set({ lastGoalError: result.error?.message ?? 'Could not save the timer start. Use Save to retry.' });
      });
      return {
        goals,
        lastGoalError: null,
        ...withTimers([{ goalId, isRunning: true, startTime, elapsedTime: 0 }, ...state.activeTimers]),
      };
    }),
  stopTimer: async (goalId, options) => {
    const { activeTimers, goals, authGeneration, user } = get();
    const timer = goalId ? activeTimers.find(t => t.goalId === goalId) : activeTimers[0];
    if (!timer || timer.startTime === null) return false;

    const stoppedAt = Date.now();
    const goal = goals.find((g) => g.id === timer.goalId);
    if (!goal) return false;

    let updatedGoal = goal;
    // Stopping marks the goal as last worked on "now" so it stays at the top.
    let timerUpdates: Partial<Goal> = { lastTimerStartedAt: stoppedAt };
    let cursor = timer.startTime;
    while (cursor < stoppedAt) {
      const end = Math.min(addDays(startOfDay(new Date(cursor)), 1).getTime(), stoppedAt);
      const progress = practiceTimeUpdates(updatedGoal, new Date(cursor), (end - cursor) / 3600000, new Date(stoppedAt));
      updatedGoal = { ...updatedGoal, ...progress };
      timerUpdates = { ...timerUpdates, ...progress };
      cursor = end;
    }

    const snapshot = { ...updatedGoal, ...timerUpdates };
    const durationMs = Math.max(0, stoppedAt - timer.startTime);
    const event: CelebrationEvent = {
      id: `timer:${user?.uid ?? 'local'}:${goal.id}:${timer.startTime}`, userId: user?.uid ?? null,
      goalId: goal.id, goalName: goal.name, source: 'timer', kind: 'timer', durationMs,
      periodKeys: newlyEarnedPeriods(goal, snapshot), saveState: durationMs ? 'saving' : 'empty',
      suppressed: options?.completion, createdAt: stoppedAt,
    };
    set((state) => ({
      goals: state.goals.map((g) => (g.id === goal.id ? { ...g, ...timerUpdates } : g)),
      ...withTimers(state.activeTimers.filter(t => t.goalId !== goal.id)),
      celebrations: [...state.celebrations, event],
    }));

    // Timer progress never increases the active-goal count, so this is safe
    // to persist best-effort without the optimistic-rollback dance addGoal uses.
    const result = await updateGoalFields(goal.id, timerUpdates);
    if (authGeneration !== get().authGeneration || !get().goals.some(item => item.id === goal.id)) return false;
    if (!result.ok) {
      const error = result.error?.message ?? 'Could not save timer progress. Use Save to retry before leaving this page.';
      set(state => ({ lastGoalError: error,
        celebrations: state.celebrations.some(item => item.id === event.id)
          ? state.celebrations.map(item => item.id === event.id
            ? { ...item, kind: 'error', saveState: 'failed', error, dismissed: false, suppressed: false } : item)
          : [...state.celebrations, { ...event, kind: 'error', saveState: 'failed', error, suppressed: false }],
        failedSessions: [...state.failedSessions, { event, snapshot }],
      }));
    } else get().confirmProgressSaved(snapshot, event);
    return result.ok;
  },
  addManualTime: async (goalId, date, minutes) => {
    const goal = get().goals.find(g => g.id === goalId);
    if (!goal || !isValid(date) || startOfDay(date) > startOfDay(new Date()) ||
        !Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
      set({ lastGoalError: 'Choose today or a past day and enter between 1 minute and 24 hours.' });
      return false;
    }
    const generation = get().authGeneration;
    const updates = practiceTimeUpdates(goal, date, minutes / 60);
    const snapshot = { ...goal, ...updates };
    const ok = await get().updateGoal(goalId, updates);
    if (ok && generation === get().authGeneration) {
      get().confirmProgressSaved(snapshot, {
        id: `manual:${++celebrationSequence}`, userId: get().user?.uid ?? null,
        goalId, goalName: goal.name, source: 'manual', kind: 'trophy', durationMs: minutes * 60000,
        periodKeys: newlyEarnedPeriods(goal, snapshot), saveState: 'saved', createdAt: Date.now(),
      });
    }
    return ok;
  },
  resetTimer: () => set(withTimers([])),
  // Local-state-only: recomputes trophies for display and replaces the
  // in-memory goal list. This NEVER writes to the server — it is used to
  // apply a freshly loaded/server-confirmed goal list. Any flow that means
  // to persist new or changed goals (import, shared import, duplication)
  // must go through services/goals.ts (importGoals, etc.), which enforces
  // the active-goal quota server-side, rather than calling setGoals directly.
  setGoals: (goals) => {
    const processedGoals = goals.map(goal => normalizeProgress(goal));
    set({ goals: processedGoals });
  },
  updateDefaultSettings: (settings) =>
    set((state) => {
      if (settings.target && (!Number.isFinite(settings.target.value) || settings.target.value <= 0)) return state;
      const newSettings = { ...state.defaultSettings, ...settings };
      // Defaults apply to new goals for the current session.
      return { defaultSettings: newSettings };
    }),
  setUser: (user) => set(state => state.user?.uid === user?.uid ? { user } : {
    user, authGeneration: state.authGeneration + 1, celebrations: [], failedSessions: [], celebratedPeriods: [],
    goals: [], ...withTimers([]), lastGoalError: null,
  }),
  setAuthLoading: (isAuthLoading) => set({ isAuthLoading }),
  clearUserData: () => {
    console.log('🧹 [DEBUG] Clearing all user data from store and localStorage');
    
    // Clear localStorage
    try {
      localStorage.removeItem('goals');
      localStorage.removeItem('goal-calendly-data');
      localStorage.removeItem('default-settings');
      
      // Clear any goal-specific settings
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('goal-') && key.endsWith('-settings')) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('🧹 [DEBUG] localStorage cleared successfully');
    } catch (error) {
      console.warn('🧹 [DEBUG] Error clearing localStorage:', error);
    }
    
    // Reset store to initial state
    set({
      authGeneration: get().authGeneration + 1,
      celebrations: [], failedSessions: [], celebratedPeriods: [], lastGoalError: null,
      goals: [],
      ...withTimers([]),
      defaultSettings: DEFAULT_GOAL_SETTINGS,
      entitlement: null,
      isEntitlementLoading: true,
      // Keep user and isAuthLoading as they are managed by auth flow
    });
    
    console.log('🧹 [DEBUG] Store state reset to initial values');
  },
  canAddGoal: () => {
    return true; // Will be implemented in component level
  },
  getGoalLimit: () => {
    return -1; // Will be implemented in component level
  },
}));
