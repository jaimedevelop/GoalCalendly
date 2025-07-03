export type UserRole = 'user' | 'admin';

export type SubscriptionPlan = 'free' | 'pro' | 'platinum' | 'enterprise';

export interface SubscriptionLimits {
  maxGoals: number;
  features: string[];
  price: number; // Monthly price in USD
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, SubscriptionLimits> = {
  free: {
    maxGoals: 3,
    features: ['Basic goal tracking', 'Timer functionality', 'Progress tracking'],
    price: 0
  },
  pro: {
    maxGoals: 15,
    features: ['All Free features', 'Advanced analytics', 'Goal sharing', 'Custom reminders'],
    price: 3.50
  },
  platinum: {
    maxGoals: 30,
    features: ['All Pro features', 'Priority support', 'Advanced reporting', 'Team collaboration'],
    price: 9.50
  },
  enterprise: {
    maxGoals: -1, // unlimited
    features: ['All Platinum features', 'Custom integrations', 'Dedicated support', 'SLA guarantee'],
    price: -1 // Contact for pricing
  }
};

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  subscriptionPlan: SubscriptionPlan;
  createdAt: string;
  lastLoginAt: string;
  isActive: boolean;
}

export interface Goal {
  id: string;
  name: string;
  targetHours: number;
  currentLevel: number;
  startDate: string;
  totalTimeSpent: number;
  weeklyTimeSpent: number;
  weeklyGoal: number;
  medals: string[];
  trophies: number;
  practiceDays: string[];
  settings: GoalSettings;
  note?: string;
  completed?: boolean;
  completedDate?: string;
  weeklyTrophies: WeeklyTrophy[];
}

export interface WeeklyTrophy {
  weekNumber: number;
  year: number;
  trophies: number;
  weeklyTimeSpent: number;
}

export interface Timer {
  isRunning: boolean;
  startTime: number | null;
  elapsedTime: number;
}

export interface GoalSettings {
  frequency: 'daily' | 'weekly' | 'monthly';
  target: {
    type: 'hours' | 'days' | 'weeks' | 'months' | 'books' | 'tutorials' | 'videos';
    value: number;
  };
  resources: Resource[];
  reminders: boolean;
  notifications: boolean;
}

export interface Resource {
  type: 'book' | 'tutorial' | 'video' | 'course' | 'project';
  name: string;
  url?: string;
  completed: boolean;
}

export const LEVELS = [
  { name: 'Beginner', months: '1-2', hours: '4-5', requiredHours: 4 },
  { name: 'Intermediate', months: '3-5', hours: '5-6', requiredHours: 20 },
  { name: 'Advanced', months: '6-8', hours: '6-7', requiredHours: 50 },
  { name: 'Master', months: '9-10', hours: '7-8', requiredHours: 100 },
  { name: 'Ninja', months: '11-12', hours: '8-10', requiredHours: 200 },
  { name: 'The One', months: '13-14', hours: '8-10', requiredHours: 350 },
  { name: 'God', months: '15-18', hours: '8-10', requiredHours: 500 }
];

export const DEFAULT_GOAL_SETTINGS: GoalSettings = {
  frequency: 'weekly',
  target: {
    type: 'hours',
    value: 5
  },
  resources: [],
  reminders: false,
  notifications: false,
};

export interface Campaign {
  id: string;
  name: string;
  type: 'internal' | 'external';
  url: string;
  description: string;
  status: 'active' | 'paused';
  clicks: number;
  revenue: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdvertisingWay {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  displayMethod: string;
  targetLocation: string;
  frequency: string;
  createdAt: string;
  updatedAt: string;
}