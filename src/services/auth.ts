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
  /**
   * True only when the Firebase ID token carries the `admin` custom claim,
   * set exclusively by functions/src/admin/setAdminClaim.ts. This replaces
   * the old `email === 'admin@admin.com'` check (admin_subscriptions.md
   * section 2/3) — do not add an email comparison back in.
   */
  isTrustedAdmin: boolean;
}

// Convert UserProfile to AuthUser
const userProfileToAuthUser = (profile: UserProfile, isTrustedAdmin: boolean): AuthUser => ({
  uid: profile.uid,
  email: profile.email,
  displayName: profile.displayName,
  role: profile.role,
  subscriptionPlan: profile.subscriptionPlan,
  isActive: profile.isActive,
  isTrustedAdmin,
});

/** Reads the `admin` custom claim from the current ID token, forcing a refresh so a just-granted claim is picked up without requiring re-login. */
const readTrustedAdminClaim = async (user: User): Promise<boolean> => {
  try {
    const tokenResult = await user.getIdTokenResult();
    return tokenResult.claims.admin === true;
  } catch (error) {
    console.error('Error reading admin claim:', error);
    return false;
  }
};

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
    const isTrustedAdmin = await readTrustedAdminClaim(user);

    return userProfileToAuthUser(userProfile, isTrustedAdmin);
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

    const isTrustedAdmin = await readTrustedAdminClaim(user);
    return userProfileToAuthUser(userProfile, isTrustedAdmin);
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

      const isTrustedAdmin = await readTrustedAdminClaim(user);
      callback(userProfileToAuthUser(userProfile, isTrustedAdmin));
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
      const isTrustedAdmin = await readTrustedAdminClaim(user);
      return userProfileToAuthUser(userProfile, isTrustedAdmin);
    }
  }
  return null;
};