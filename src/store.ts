import { create } from 'zustand';
import { Goal, Timer, GoalSettings, DEFAULT_GOAL_SETTINGS, LEVELS, WeeklyTrophy, Entitlement } from './types';
import { format, getWeek } from 'date-fns';
import { AuthUser } from './services/auth.js';
import { createGoal, updateGoalFields, completeGoal, deleteGoalRemote, saveGoalSnapshots } from './services/goals.js';

interface Store {
  goals: Goal[];
  activeTimer: { goalId: string | null } & Timer;
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
  stopTimer: () => void;
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
export function shouldShowAds(entitlement: Entitlement | null, isLoading: boolean): boolean {
  if (isLoading || !entitlement) return false;
  return entitlement.hasAdvertising;
}

const calculateWeeklyTrophies = (weeklyTimeSpent: number, weeklyGoal: number): number => {
  if (weeklyTimeSpent >= weeklyGoal) {
    return Math.floor(weeklyTimeSpent / weeklyGoal);
  }
  return 0;
};

const checkAndUpdateTrophies = (goal: Goal): { trophies: number; weeklyTrophies: WeeklyTrophy[] } => {
  const currentDate = new Date();
  const weekNumber = getWeek(currentDate);
  const year = currentDate.getFullYear();
  
  let weeklyTrophies = goal.weeklyTrophies || [];
  let currentWeekTrophy = weeklyTrophies.find(
    w => w.weekNumber === weekNumber && w.year === year
  );
  
  if (!currentWeekTrophy) {
    currentWeekTrophy = {
      weekNumber,
      year,
      trophies: calculateWeeklyTrophies(goal.weeklyTimeSpent, goal.weeklyGoal),
      weeklyTimeSpent: goal.weeklyTimeSpent
    };
    weeklyTrophies = [...weeklyTrophies, currentWeekTrophy];
  } else {
    currentWeekTrophy = {
      ...currentWeekTrophy,
      trophies: calculateWeeklyTrophies(goal.weeklyTimeSpent, goal.weeklyGoal),
      weeklyTimeSpent: goal.weeklyTimeSpent,
    };
    weeklyTrophies = weeklyTrophies.map(wt =>
      wt.weekNumber === weekNumber && wt.year === year ? currentWeekTrophy! : wt
    );
  }

  // Calculate total trophies from all weeks
  const totalTrophies = weeklyTrophies.reduce((sum, week) => sum + week.trophies, 0);

  return {
    trophies: totalTrophies,
    weeklyTrophies: weeklyTrophies.sort((a, b) => 
      a.year === b.year ? a.weekNumber - b.weekNumber : a.year - b.year
    )
  };
};

export const useStore = create<Store>((set, get) => ({
  goals: [],
  activeTimer: {
    goalId: null,
    isRunning: false,
    startTime: null,
    elapsedTime: 0,
  },
  defaultSettings: DEFAULT_GOAL_SETTINGS,
  user: null,
  isAuthLoading: true,
  entitlement: null,
  isEntitlementLoading: true,
  setEntitlement: (entitlement, isLoading) => set({ entitlement, isEntitlementLoading: isLoading }),
  lastGoalError: null,
  saveGoals: async () => {
    set({ lastGoalError: null });
    const result = await saveGoalSnapshots(get().goals);
    if (!result.ok) set({ lastGoalError: result.error?.message ?? 'Could not save all goals. Please try again.' });
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
    const previous = get().goals.find((g) => g.id === goalId);
    if (!previous) return false;

    set((state) => ({
      goals: state.goals.map((goal) => (goal.id === goalId ? { ...goal, ...updates } : goal)),
      lastGoalError: null,
    }));

    const result = await updateGoalFields(goalId, updates);
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
    const previous = get().goals.find((g) => g.id === goalId);
    if (!previous) return false;
    const completedDate = new Date().toISOString();

    set((state) => ({
      goals: state.goals.map((goal) => (goal.id === goalId ? { ...goal, completed: true, completedDate } : goal)),
      lastGoalError: null,
    }));

    const result = await completeGoal(goalId);
    if (!result.ok) {
      set((state) => ({
        goals: state.goals.map((goal) => (goal.id === goalId ? previous : goal)),
        lastGoalError: result.error?.message ?? 'Could not mark this goal complete.',
      }));
      return false;
    }
    return true;
  },
  deleteGoal: async (goalId) => {
    const state = get();
    const previous = state.goals.find((g) => g.id === goalId);
    if (!previous) return false;
    const previousTimer = state.activeTimer;

    set((s) => ({
      goals: s.goals.filter((goal) => goal.id !== goalId),
      activeTimer: s.activeTimer.goalId === goalId
        ? { goalId: null, isRunning: false, startTime: null, elapsedTime: 0 }
        : s.activeTimer,
      lastGoalError: null,
    }));

    const result = await deleteGoalRemote(goalId);
    if (!result.ok) {
      set((s) => ({
        goals: [...s.goals, previous],
        activeTimer: previousTimer,
        lastGoalError: result.error?.message ?? 'Could not delete this goal.',
      }));
      return false;
    }
    return true;
  },
  startTimer: (goalId) =>
    set((state) => {
      if (!state.goals.some(goal => goal.id === goalId && !goal.completed)) return state;
      const startTime = Date.now();
      const goals = state.goals.map(goal =>
        goal.id === goalId ? { ...goal, lastTimerStartedAt: startTime } : goal
      );
      // lastTimerStartedAt is a low-stakes UX field (resumes an in-progress
      // timer after a refresh); persisted best-effort via updateGoal rather
      // than blocking timer start on a round trip.
      void updateGoalFields(goalId, { lastTimerStartedAt: startTime }).then(result => {
        if (!result.ok) set({ lastGoalError: result.error?.message ?? 'Could not save the timer start. Use Save to retry.' });
      });
      return {
        goals,
        activeTimer: {
          goalId,
          isRunning: true,
          startTime,
          elapsedTime: 0,
        },
      };
    }),
  stopTimer: () => {
    const { activeTimer, goals } = get();
    if (!activeTimer.goalId || !activeTimer.startTime) return;

    const elapsedHours = (Date.now() - activeTimer.startTime) / (1000 * 60 * 60);
    const goal = goals.find((g) => g.id === activeTimer.goalId);
    if (!goal) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    const updatedPracticeDays = goal.practiceDays || [];
    if (!updatedPracticeDays.includes(today)) {
      updatedPracticeDays.push(today);
    }

    const newWeeklyTimeSpent = goal.weeklyTimeSpent + elapsedHours;
    const { trophies, weeklyTrophies } = checkAndUpdateTrophies({
      ...goal,
      weeklyTimeSpent: newWeeklyTimeSpent
    });

    // Check for level up
    let currentLevel = goal.currentLevel;
    const totalTimeSpent = goal.totalTimeSpent + elapsedHours;

    for (let i = currentLevel - 1; i < LEVELS.length; i++) {
      if (totalTimeSpent >= LEVELS[i].requiredHours) {
        currentLevel = i + 1;
      }
    }

    const timerUpdates = {
      totalTimeSpent,
      weeklyTimeSpent: newWeeklyTimeSpent,
      practiceDays: updatedPracticeDays,
      trophies,
      weeklyTrophies,
      currentLevel,
    };

    set((state) => ({
      goals: state.goals.map((g) => (g.id === goal.id ? { ...g, ...timerUpdates } : g)),
      activeTimer: {
        goalId: null,
        isRunning: false,
        startTime: null,
        elapsedTime: 0,
      },
    }));

    // Timer progress never increases the active-goal count, so this is safe
    // to persist best-effort without the optimistic-rollback dance addGoal uses.
    void updateGoalFields(goal.id, timerUpdates).then(result => {
      if (!result.ok) set({ lastGoalError: result.error?.message ?? 'Could not save timer progress. Use Save to retry before leaving this page.' });
    });
  },
  resetTimer: () =>
    set({
      activeTimer: {
        goalId: null,
        isRunning: false,
        startTime: null,
        elapsedTime: 0,
      },
    }),
  // Local-state-only: recomputes trophies for display and replaces the
  // in-memory goal list. This NEVER writes to the server — it is used to
  // apply a freshly loaded/server-confirmed goal list. Any flow that means
  // to persist new or changed goals (import, shared import, duplication)
  // must go through services/goals.ts (importGoals, etc.), which enforces
  // the active-goal quota server-side, rather than calling setGoals directly.
  setGoals: (goals) => {
    const processedGoals = goals.map(goal => {
      const { trophies, weeklyTrophies } = checkAndUpdateTrophies(goal);
      return {
        ...goal,
        trophies,
        weeklyTrophies: weeklyTrophies || []
      };
    });
    set({ goals: processedGoals });
  },
  updateDefaultSettings: (settings) =>
    set((state) => {
      const newSettings = { ...state.defaultSettings, ...settings };
      // Default settings are now user-specific and stored in Firestore
      return { defaultSettings: newSettings };
    }),
  setUser: (user) => set({ user }),
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
      goals: [],
      activeTimer: {
        goalId: null,
        isRunning: false,
        startTime: null,
        elapsedTime: 0,
      },
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
