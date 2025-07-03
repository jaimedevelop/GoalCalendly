import { Goal, Campaign, AdvertisingWay } from '../types';
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
const CAMPAIGNS_COLLECTION = 'campaigns';
const ADVERTISING_WAYS_COLLECTION = 'advertisingWays';

// Get goals count by user (admin only)
export async function getGoalsCountByUser(): Promise<Record<string, number>> {
  try {
    console.log('[DEBUG] getGoalsCountByUser: Starting goal count aggregation');
    const currentUser = await getCurrentUser();
    console.log('[DEBUG] getGoalsCountByUser: currentUser =', currentUser ? 'authenticated' : 'null');
    
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const goalsCollection = collection(db, GOALS_COLLECTION);
    const goalsSnapshot = await getDocs(goalsCollection);
    
    const goalsByUser: Record<string, number> = {};
    
    goalsSnapshot.forEach((doc) => {
      const goalData = doc.data();
      const userId = goalData.userId;
      if (userId) {
        goalsByUser[userId] = (goalsByUser[userId] || 0) + 1;
      }
    });
    
    console.log('[DEBUG] getGoalsCountByUser: Aggregated counts for', Object.keys(goalsByUser).length, 'users');
    return goalsByUser;
  } catch (error) {
    console.error('Error getting goals count by user:', error);
    throw error;
  }
}

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
      
      console.log('[DEBUG] saveToFirestore: Saving goal', goal.id, 'with userId:', currentUser.uid);
      // Create clean goal data without undefined values (Firestore doesn't allow undefined)
      const goalData: Omit<Goal, 'note' | 'completed' | 'completedDate'> & {
        type: string;
        userId: string;
        updatedAt: ReturnType<typeof serverTimestamp>;
        note?: string;
        completed?: boolean;
        completedDate?: string;
      } = {
        // Required fields
        id: goal.id,
        name: goal.name,
        targetHours: goal.targetHours,
        currentLevel: goal.currentLevel,
        startDate: goal.startDate,
        totalTimeSpent: goal.totalTimeSpent,
        weeklyTimeSpent: goal.weeklyTimeSpent,
        weeklyGoal: goal.weeklyGoal,
        trophies: goal.trophies,
        settings: goal.settings,
        
        // System fields
        type: 'goal',
        userId: currentUser.uid,
        updatedAt: serverTimestamp(),
        
        // Arrays (ensure they're never undefined)
        medals: goal.medals || [],
        practiceDays: goal.practiceDays || [],
        weeklyTrophies: goal.weeklyTrophies || [],
      };
      
      // Only include optional fields if they are defined
      if (goal.completed !== undefined) {
        goalData.completed = goal.completed;
      }
      if (goal.completedDate !== undefined) {
        goalData.completedDate = goal.completedDate;
      }
      if (goal.note !== undefined) {
        goalData.note = goal.note;
      }
      
      // Debug logging to validate undefined value filtering
      console.log('🔍 [DEBUG] Saving goal data to Firestore:', {
        goalId: goal.id,
        hasUndefinedValues: Object.values(goalData).some(value => value === undefined),
        optionalFields: {
          completed: goal.completed,
          completedDate: goal.completedDate,
          note: goal.note
        },
        filteredData: goalData
      });
      
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
    console.log('[DEBUG] loadFromFirestore: Current user UID =', currentUser.uid);
    const goalsQuery = query(
      goalsCollection,
      where('type', '==', 'goal'),
      where('userId', '==', currentUser.uid), // Filter by user ID
      orderBy('updatedAt', 'desc')
    );
    
    console.log('[DEBUG] loadFromFirestore: Executing query with userId filter =', currentUser.uid);
    const querySnapshot = await getDocs(goalsQuery);
    const goals: Goal[] = [];
    console.log('[DEBUG] loadFromFirestore: Query returned', querySnapshot.size, 'documents');
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('[DEBUG] loadFromFirestore: Processing goal - ID:', data.id, 'Name:', data.name, 'UserId:', data.userId, 'Expected UserId:', currentUser.uid, 'Match:', data.userId === currentUser.uid);
      
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
    console.log('🗑️ [DEBUG] Starting Firestore goal deletion:', { goalId });
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      console.error('🗑️ [DEBUG] Delete failed: User not authenticated');
      return false;
    }
    
    console.log('🗑️ [DEBUG] User authenticated, proceeding with deletion:', {
      userId: currentUser.uid,
      goalId
    });
    
    const goalDoc = doc(db, GOALS_COLLECTION, goalId);
    await deleteDoc(goalDoc);
    
    console.log('🗑️ [DEBUG] Goal successfully deleted from Firestore:', { goalId });
    return true;
  } catch (error) {
    console.error('🗑️ [DEBUG] Error deleting goal from Firestore:', { goalId, error });
    return false;
  }
}

// Get completed goals from Firestore
export async function getCompletedGoalsFromFirestore(): Promise<Goal[]> {
  try {
    console.log('[DEBUG] getCompletedGoalsFromFirestore: Starting load operation');
    const currentUser = await getCurrentUser();
    console.log('[DEBUG] getCompletedGoalsFromFirestore: currentUser =', currentUser ? 'authenticated' : 'null');
    if (!currentUser) {
      console.error('User not authenticated');
      return [];
    }

    const goalsCollection = collection(db, GOALS_COLLECTION);
    const completedGoalsQuery = query(
      goalsCollection,
      where('type', '==', 'goal'),
      where('userId', '==', currentUser.uid), // Add missing userId filter
      where('completed', '==', true),
      orderBy('completedDate', 'desc')
    );
    
    console.log('[DEBUG] getCompletedGoalsFromFirestore: Executing query WITHOUT userId filter');
    const querySnapshot = await getDocs(completedGoalsQuery);
    const goals: Goal[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('[DEBUG] getCompletedGoalsFromFirestore: Found goal with userId:', data.userId, 'current user:', currentUser.uid);
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

// Campaign CRUD functions
export async function getAllCampaigns(): Promise<Campaign[]> {
  try {
    console.log('[DEBUG] getAllCampaigns: Starting load operation');
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const campaignsCollection = collection(db, CAMPAIGNS_COLLECTION);
    const campaignsSnapshot = await getDocs(campaignsCollection);
    const campaigns: Campaign[] = [];
    
    campaignsSnapshot.forEach((doc) => {
      const data = doc.data();
      campaigns.push({
        id: data.id,
        name: data.name,
        type: data.type,
        url: data.url,
        description: data.description,
        status: data.status,
        clicks: data.clicks || 0,
        revenue: data.revenue || 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      } as Campaign);
    });
    
    console.log('[DEBUG] getAllCampaigns: Loaded', campaigns.length, 'campaigns');
    return campaigns;
  } catch (error) {
    console.error('Error loading campaigns:', error);
    throw error;
  }
}

export async function createCampaign(campaignData: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<Campaign> {
  try {
    console.log('[DEBUG] createCampaign: Creating new campaign');
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const campaign: Campaign = {
      ...campaignData,
      id: campaignId,
      createdAt: now,
      updatedAt: now
    };

    const campaignDoc = doc(db, CAMPAIGNS_COLLECTION, campaignId);
    await setDoc(campaignDoc, {
      ...campaign,
      updatedAt: serverTimestamp()
    });
    
    console.log('[DEBUG] createCampaign: Campaign created successfully', campaignId);
    return campaign;
  } catch (error) {
    console.error('Error creating campaign:', error);
    throw error;
  }
}

export async function updateCampaign(campaignId: string, updates: Partial<Omit<Campaign, 'id' | 'createdAt'>>): Promise<void> {
  try {
    console.log('[DEBUG] updateCampaign: Updating campaign', campaignId);
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const campaignDoc = doc(db, CAMPAIGNS_COLLECTION, campaignId);
    await setDoc(campaignDoc, {
      ...updates,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log('[DEBUG] updateCampaign: Campaign updated successfully');
  } catch (error) {
    console.error('Error updating campaign:', error);
    throw error;
  }
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  try {
    console.log('[DEBUG] deleteCampaign: Deleting campaign', campaignId);
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const campaignDoc = doc(db, CAMPAIGNS_COLLECTION, campaignId);
    await deleteDoc(campaignDoc);
    
    console.log('[DEBUG] deleteCampaign: Campaign deleted successfully');
  } catch (error) {
    console.error('Error deleting campaign:', error);
    throw error;
  }
}

// Advertising Ways CRUD functions
export async function getAllAdvertisingWays(): Promise<AdvertisingWay[]> {
  try {
    console.log('[DEBUG] getAllAdvertisingWays: Starting load operation');
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const advertisingWaysCollection = collection(db, ADVERTISING_WAYS_COLLECTION);
    const advertisingWaysSnapshot = await getDocs(advertisingWaysCollection);
    const advertisingWays: AdvertisingWay[] = [];
    
    advertisingWaysSnapshot.forEach((doc) => {
      const data = doc.data();
      advertisingWays.push({
        id: data.id,
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        displayMethod: data.displayMethod,
        targetLocation: data.targetLocation,
        frequency: data.frequency,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      } as AdvertisingWay);
    });
    
    console.log('[DEBUG] getAllAdvertisingWays: Loaded', advertisingWays.length, 'advertising ways');
    return advertisingWays;
  } catch (error) {
    console.error('Error loading advertising ways:', error);
    throw error;
  }
}

export async function createAdvertisingWay(advertisingWayData: Omit<AdvertisingWay, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdvertisingWay> {
  try {
    console.log('[DEBUG] createAdvertisingWay: Creating new advertising way');
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const advertisingWayId = `adway_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const advertisingWay: AdvertisingWay = {
      ...advertisingWayData,
      id: advertisingWayId,
      createdAt: now,
      updatedAt: now
    };

    const advertisingWayDoc = doc(db, ADVERTISING_WAYS_COLLECTION, advertisingWayId);
    await setDoc(advertisingWayDoc, {
      ...advertisingWay,
      updatedAt: serverTimestamp()
    });
    
    console.log('[DEBUG] createAdvertisingWay: Advertising way created successfully', advertisingWayId);
    return advertisingWay;
  } catch (error) {
    console.error('Error creating advertising way:', error);
    throw error;
  }
}

export async function updateAdvertisingWay(advertisingWayId: string, updates: Partial<Omit<AdvertisingWay, 'id' | 'createdAt'>>): Promise<void> {
  try {
    console.log('[DEBUG] updateAdvertisingWay: Updating advertising way', advertisingWayId);
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const advertisingWayDoc = doc(db, ADVERTISING_WAYS_COLLECTION, advertisingWayId);
    await setDoc(advertisingWayDoc, {
      ...updates,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log('[DEBUG] updateAdvertisingWay: Advertising way updated successfully');
  } catch (error) {
    console.error('Error updating advertising way:', error);
    throw error;
  }
}

export async function deleteAdvertisingWay(advertisingWayId: string): Promise<void> {
  try {
    console.log('[DEBUG] deleteAdvertisingWay: Deleting advertising way', advertisingWayId);
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const advertisingWayDoc = doc(db, ADVERTISING_WAYS_COLLECTION, advertisingWayId);
    await deleteDoc(advertisingWayDoc);
    
    console.log('[DEBUG] deleteAdvertisingWay: Advertising way deleted successfully');
  } catch (error) {
    console.error('Error deleting advertising way:', error);
    throw error;
  }
}

// Firestore sharing functions
export const storeSharedGoals = storeSharedGoalsInFirestore;
export const getSharedGoals = getSharedGoalsFromFirestore;