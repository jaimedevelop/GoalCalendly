import { Goal } from '../types';
import { db } from '../config/firebase';
import { getCurrentUser } from './auth.js';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

// Firestore collection names
const GOALS_COLLECTION = 'goals';
const SHARED_GOALS_COLLECTION = 'sharedGoals';

// Firestore functions
export async function saveToFirestore(goals: Goal[]): Promise<boolean> {
  try {
    console.log('[DEBUG] saveToFirestore: Starting save operation');
    const currentUser = await getCurrentUser();
    console.log('[DEBUG] saveToFirestore: currentUser =', currentUser ? 'authenticated' : 'null');
    if (!currentUser) {
      console.error('User not authenticated');
      return false;
    }

    const goalsCollection = collection(db, GOALS_COLLECTION);
    
    // Save each goal as a separate document
    for (const goal of goals) {
      const goalDoc = doc(goalsCollection, goal.id);
      
      const goalData = {
        ...goal,
        type: 'goal',
        userId: currentUser.uid, // Add user ID for data scoping
        updatedAt: serverTimestamp(),
        // Convert date strings to Firestore timestamps if needed
        startDate: goal.startDate,
        // Only include fields that are not undefined (Firestore doesn't allow undefined)
        ...(goal.completedDate !== undefined && { completedDate: goal.completedDate }),
        ...(goal.note !== undefined && { note: goal.note }),
        // Ensure arrays are properly formatted
        medals: goal.medals || [],
        practiceDays: goal.practiceDays || [],
        weeklyTrophies: goal.weeklyTrophies || []
      };
      
      await setDoc(goalDoc, goalData, { merge: true });
    }
    
    return true;
  } catch (error) {
    console.error('Error saving to Firestore:', error);
    return false;
  }
}

export async function loadFromFirestore(): Promise<Goal[]> {
  try {
    console.log('[DEBUG] loadFromFirestore: Starting load operation');
    const currentUser = await getCurrentUser();
    console.log('[DEBUG] loadFromFirestore: currentUser =', currentUser ? 'authenticated' : 'null');
    if (!currentUser) {
      console.error('User not authenticated');
      return [];
    }

    const goalsCollection = collection(db, GOALS_COLLECTION);
    const goalsQuery = query(
      goalsCollection,
      where('type', '==', 'goal'),
      where('userId', '==', currentUser.uid), // Filter by user ID
      orderBy('updatedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(goalsQuery);
    const goals: Goal[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Convert Firestore data back to Goal format
      const goal: Goal = {
        id: data.id,
        name: data.name,
        targetHours: data.targetHours,
        currentLevel: data.currentLevel,
        startDate: data.startDate,
        totalTimeSpent: data.totalTimeSpent,
        weeklyTimeSpent: data.weeklyTimeSpent,
        weeklyGoal: data.weeklyGoal,
        medals: data.medals || [],
        trophies: data.trophies,
        practiceDays: data.practiceDays || [],
        settings: data.settings,
        note: data.note,
        completed: data.completed,
        completedDate: data.completedDate,
        weeklyTrophies: data.weeklyTrophies || []
      };
      
      goals.push(goal);
    });
    
    return goals;
  } catch (error) {
    console.error('Error loading from Firestore:', error);
    return [];
  }
}

// Get a specific goal from Firestore
export async function getGoalFromFirestore(goalId: string): Promise<Goal | null> {
  try {
    const goalDoc = doc(db, GOALS_COLLECTION, goalId);
    const goalSnapshot = await getDoc(goalDoc);
    
    if (goalSnapshot.exists()) {
      const data = goalSnapshot.data();
      return {
        id: data.id,
        name: data.name,
        targetHours: data.targetHours,
        currentLevel: data.currentLevel,
        startDate: data.startDate,
        totalTimeSpent: data.totalTimeSpent,
        weeklyTimeSpent: data.weeklyTimeSpent,
        weeklyGoal: data.weeklyGoal,
        medals: data.medals || [],
        trophies: data.trophies,
        practiceDays: data.practiceDays || [],
        settings: data.settings,
        note: data.note,
        completed: data.completed,
        completedDate: data.completedDate,
        weeklyTrophies: data.weeklyTrophies || []
      } as Goal;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting goal from Firestore:', error);
    return null;
  }
}

// Delete a goal from Firestore
export async function deleteGoalFromFirestore(goalId: string): Promise<boolean> {
  try {
    const goalDoc = doc(db, GOALS_COLLECTION, goalId);
    await deleteDoc(goalDoc);
    return true;
  } catch (error) {
    console.error('Error deleting goal from Firestore:', error);
    return false;
  }
}

// Get completed goals from Firestore
export async function getCompletedGoalsFromFirestore(): Promise<Goal[]> {
  try {
    const goalsCollection = collection(db, GOALS_COLLECTION);
    const completedGoalsQuery = query(
      goalsCollection,
      where('type', '==', 'goal'),
      where('completed', '==', true),
      orderBy('completedDate', 'desc')
    );
    
    const querySnapshot = await getDocs(completedGoalsQuery);
    const goals: Goal[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      goals.push({
        id: data.id,
        name: data.name,
        targetHours: data.targetHours,
        currentLevel: data.currentLevel,
        startDate: data.startDate,
        totalTimeSpent: data.totalTimeSpent,
        weeklyTimeSpent: data.weeklyTimeSpent,
        weeklyGoal: data.weeklyGoal,
        medals: data.medals || [],
        trophies: data.trophies,
        practiceDays: data.practiceDays || [],
        settings: data.settings,
        note: data.note,
        completed: data.completed,
        completedDate: data.completedDate,
        weeklyTrophies: data.weeklyTrophies || []
      } as Goal);
    });
    
    return goals;
  } catch (error) {
    console.error('Error getting completed goals from Firestore:', error);
    return [];
  }
}

// Store shared goals in Firestore for persistent sharing
export async function storeSharedGoalsInFirestore(shareId: string, goals: Goal[]): Promise<string> {
  try {
    const sharedGoalsDoc = doc(db, SHARED_GOALS_COLLECTION, shareId);
    
    await setDoc(sharedGoalsDoc, {
      id: shareId,
      goals,
      timestamp: serverTimestamp(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + (24 * 60 * 60 * 1000))) // 24 hours expiry
    });
    
    return shareId;
  } catch (error) {
    console.error('Error storing shared goals in Firestore:', error);
    throw error;
  }
}

// Get shared goals from Firestore
export async function getSharedGoalsFromFirestore(shareId: string): Promise<Goal[] | null> {
  try {
    const sharedGoalsDoc = doc(db, SHARED_GOALS_COLLECTION, shareId);
    const docSnapshot = await getDoc(sharedGoalsDoc);
    
    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      const now = new Date();
      const expiresAt = data.expiresAt.toDate();
      
      if (now > expiresAt) {
        // Document has expired, delete it
        await deleteDoc(sharedGoalsDoc);
        return null;
      }
      
      return data.goals;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting shared goals from Firestore:', error);
    return null;
  }
}

// Firestore sharing functions
export const storeSharedGoals = storeSharedGoalsInFirestore;
export const getSharedGoals = getSharedGoalsFromFirestore;