import { create } from 'zustand';
import { Goal, Timer, GoalSettings, DEFAULT_GOAL_SETTINGS, LEVELS, WeeklyTrophy } from './types';
import { format, getWeek } from 'date-fns';
import { AuthUser } from './services/auth.js';
import { saveToFirestore } from './services/db';

interface Store {
  goals: Goal[];
  activeTimer: { goalId: string | null } & Timer;
  defaultSettings: GoalSettings;
  user: AuthUser | null;
  isAuthLoading: boolean;
  addGoal: (goal: Goal) => void;
  updateGoal: (goalId: string, updates: Partial<Goal>) => void;
  deleteGoal: (goalId: string) => void;
  startTimer: (goalId: string) => void;
  stopTimer: () => void;
  resetTimer: () => void;
  setGoals: (goals: Goal[]) => void;
  updateDefaultSettings: (settings: Partial<GoalSettings>) => void;
  setUser: (user: AuthUser | null) => void;
  setAuthLoading: (loading: boolean) => void;
  canAddGoal: () => boolean;
  getGoalLimit: () => number;
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
    currentWeekTrophy.trophies = calculateWeeklyTrophies(goal.weeklyTimeSpent, goal.weeklyGoal);
    currentWeekTrophy.weeklyTimeSpent = goal.weeklyTimeSpent;
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

// Auto-save helper function with retry logic
const autoSaveToFirestore = async (goals: Goal[]) => {
  try {
    console.log('[DEBUG] Auto-save: Starting save operation for', goals.length, 'goals');
    const success = await saveToFirestore(goals);
    console.log('[DEBUG] Auto-save: Save operation result:', success);
    if (!success) {
      console.error('[DEBUG] Auto-save: Save operation returned false');
      // Retry once after a short delay
      setTimeout(async () => {
        console.log('[DEBUG] Auto-save: Retrying save operation');
        await saveToFirestore(goals);
      }, 1000);
    }
  } catch (error) {
    console.error('[DEBUG] Auto-save failed:', error);
    // Retry once after a short delay
    setTimeout(async () => {
      console.log('[DEBUG] Auto-save: Retrying after error');
      try {
        await saveToFirestore(goals);
      } catch (retryError) {
        console.error('[DEBUG] Auto-save retry failed:', retryError);
      }
    }, 1000);
  }
};

export const useStore = create<Store>((set) => ({
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
  addGoal: (goal) => set((state) => {
    console.log('[DEBUG] addGoal: Adding goal:', goal.name);
    const newGoals = [...state.goals, {
      ...goal,
      weeklyTrophies: []
    }];
    
    console.log('[DEBUG] addGoal: New goals array length:', newGoals.length);
    
    // Auto-save to Firestore
    autoSaveToFirestore(newGoals);
    
    return { goals: newGoals };
  }),
  updateGoal: (goalId, updates) =>
    set((state) => {
      const newGoals = state.goals.map((goal) =>
        goal.id === goalId ? { ...goal, ...updates } : goal
      );
      
      // Auto-save to Firestore
      autoSaveToFirestore(newGoals);
      
      return { goals: newGoals };
    }),
  deleteGoal: (goalId) =>
    set((state) => {
      const newGoals = state.goals.filter((goal) => goal.id !== goalId);
      const newActiveTimer = state.activeTimer.goalId === goalId ? {
        goalId: null,
        isRunning: false,
        startTime: null,
        elapsedTime: 0,
      } : state.activeTimer;
      
      // Auto-save to Firestore
      autoSaveToFirestore(newGoals);
      
      return {
        goals: newGoals,
        activeTimer: newActiveTimer,
      };
    }),
  startTimer: (goalId) =>
    set({
      activeTimer: {
        goalId,
        isRunning: true,
        startTime: Date.now(),
        elapsedTime: 0,
      },
    }),
  stopTimer: () =>
    set((state) => {
      const { activeTimer, goals } = state;
      if (!activeTimer.goalId || !activeTimer.startTime) return state;

      const elapsedHours = (Date.now() - activeTimer.startTime) / (1000 * 60 * 60);
      const goal = goals.find((g) => g.id === activeTimer.goalId);

      if (!goal) return state;

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
      
      const updatedGoal = {
        ...goal,
        totalTimeSpent,
        weeklyTimeSpent: newWeeklyTimeSpent,
        practiceDays: updatedPracticeDays,
        trophies,
        weeklyTrophies,
        currentLevel,
        settings: {
          ...goal.settings,
          reminders: goal.settings.reminders
        }
      };

      // Settings are now saved to Firestore with the goal data

      const newGoals = goals.map((g) => (g.id === goal.id ? updatedGoal : g));
      
      // Auto-save to Firestore
      autoSaveToFirestore(newGoals);
      
      return {
        goals: newGoals,
        activeTimer: {
          goalId: null,
          isRunning: false,
          startTime: null,
          elapsedTime: 0,
        },
      };
    }),
  resetTimer: () =>
    set({
      activeTimer: {
        goalId: null,
        isRunning: false,
        startTime: null,
        elapsedTime: 0,
      },
    }),
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
  canAddGoal: () => {
    return true; // Will be implemented in component level
  },
  getGoalLimit: () => {
    return -1; // Will be implemented in component level
  },
}));