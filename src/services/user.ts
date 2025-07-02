import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { UserProfile, UserRole, SubscriptionPlan } from '../types.js';

// Create user profile in Firestore
export const createUserProfile = async (
  uid: string, 
  email: string, 
  displayName: string | null = null
): Promise<UserProfile> => {
  const userProfile: UserProfile = {
    uid,
    email,
    displayName,
    role: email === 'admin@admin.com' ? 'admin' : 'user',
    subscriptionPlan: 'free',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    isActive: true
  };

  await setDoc(doc(db, 'users', uid), userProfile);
  return userProfile;
};

// Get user profile from Firestore
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

// Update user profile
export const updateUserProfile = async (
  uid: string, 
  updates: Partial<UserProfile>
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...updates,
      lastLoginAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// Update user subscription plan
export const updateUserSubscription = async (
  uid: string, 
  plan: SubscriptionPlan
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      subscriptionPlan: plan,
      lastLoginAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating user subscription:', error);
    throw error;
  }
};

// Admin functions
export const getAllUsers = async (): Promise<UserProfile[]> => {
  try {
    const usersCollection = collection(db, 'users');
    const usersQuery = query(usersCollection, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(usersQuery);
    
    return querySnapshot.docs.map(doc => doc.data() as UserProfile);
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
};

// Admin function to delete user
export const deleteUser = async (uid: string): Promise<void> => {
  try {
    // Delete user profile
    await deleteDoc(doc(db, 'users', uid));
    
    // Note: This only deletes the user profile from Firestore
    // To delete the Firebase Auth user, you would need Admin SDK on the backend
    console.log(`User profile ${uid} deleted from Firestore`);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

// Admin function to update user role
export const updateUserRole = async (uid: string, role: UserRole): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      role,
      lastLoginAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

// Admin function to deactivate/activate user
export const toggleUserStatus = async (uid: string, isActive: boolean): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      isActive,
      lastLoginAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error toggling user status:', error);
    throw error;
  }
};

// Check if user is admin
export const isAdmin = (userProfile: UserProfile | null): boolean => {
  return userProfile?.role === 'admin' && userProfile?.email === 'admin@admin.com';
};

// Get user goal count for subscription limits
export const getUserGoalCount = async (uid: string): Promise<number> => {
  try {
    const goalsCollection = collection(db, 'goals');
    const userGoalsQuery = query(goalsCollection, where('userId', '==', uid));
    const querySnapshot = await getDocs(userGoalsQuery);
    
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting user goal count:', error);
    return 0;
  }
};