import type { Goal } from '../types';

/** Shares use the same plain JSON representation as a downloaded goal export.
 * Loaded goals contain absent optional fields explicitly set to undefined;
 * Firestore rejects those even when nested inside an array or settings.
 * Serialize only the goal payload, leaving document Timestamp sentinels intact.
 */
export function serializeSharedGoals(goals: Goal[]): Goal[] {
  return JSON.parse(JSON.stringify(goals)) as Goal[];
}
