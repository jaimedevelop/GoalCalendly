import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth';
import { auth } from '../config/firebase.js';
import { UserRole, SubscriptionPlan, UserProfile } from '../types.js';
import { createUserProfile, getUserProfile, updateUserProfile } from './user.js';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  subscriptionPlan: SubscriptionPlan;
  isActive: boolean;
}

// Convert UserProfile to AuthUser
const userProfileToAuthUser = (profile: UserProfile): AuthUser => ({
  uid: profile.uid,
  email: profile.email,
  displayName: profile.displayName,
  role: profile.role,
  subscriptionPlan: profile.subscriptionPlan,
  isActive: profile.isActive
});

// Sign up with email and password
export const signUp = async (email: string, password: string, displayName?: string): Promise<AuthUser> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update display name if provided
    if (displayName) {
      await updateProfile(user, { displayName });
    }
    
    // Create user profile in Firestore
    const userProfile = await createUserProfile(user.uid, email, displayName || null);
    
    return userProfileToAuthUser(userProfile);
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
};

// Sign in with email and password
export const signIn = async (email: string, password: string): Promise<AuthUser> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get or create user profile
    let userProfile = await getUserProfile(user.uid);
    
    if (!userProfile) {
      // Create profile if it doesn't exist (for existing users)
      userProfile = await createUserProfile(user.uid, user.email || '', user.displayName);
    } else {
      // Update last login time
      await updateUserProfile(user.uid, { lastLoginAt: new Date().toISOString() });
      userProfile.lastLoginAt = new Date().toISOString();
    }
    
    return userProfileToAuthUser(userProfile);
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
};

// Sign out
export const signOutUser = async (): Promise<void> => {
  try {
    console.log('[DEBUG] Signing out user...');
    await signOut(auth);
    console.log('[DEBUG] User signed out successfully');
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Listen to auth state changes
export const onAuthStateChange = (callback: (user: AuthUser | null) => void): (() => void) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // Get user profile from Firestore
      let userProfile = await getUserProfile(user.uid);
      
      if (!userProfile) {
        // Create profile if it doesn't exist
        userProfile = await createUserProfile(user.uid, user.email || '', user.displayName);
      }
      
      callback(userProfileToAuthUser(userProfile));
    } else {
      callback(null);
    }
  });
};

// Get current user with profile
export const getCurrentUser = async (): Promise<AuthUser | null> => {
  const user = auth.currentUser;
  if (user) {
    const userProfile = await getUserProfile(user.uid);
    if (userProfile) {
      return userProfileToAuthUser(userProfile);
    }
  }
  return null;
};