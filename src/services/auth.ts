import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase.js';
import { UserRole, SubscriptionPlan, UserProfile } from '../types.js';
import { getUserProfile, updateUserProfile } from './user.js';

// Creates users/{uid} and entitlements/{uid} together, server-side, with role/plan
// forced to safe defaults (admin_subscriptions.md section 3/6). The client-side
// createUserProfile() only ever wrote users/{uid}, silently leaving entitlements/{uid}
// missing — which left every new signup with no confirmed entitlement (ads never showed,
// subscription screen never resolved a plan). No-ops if a profile already exists.
const createFreeProfileCallable = httpsCallable(functions, 'createFreeProfile');

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
    // Firebase caches the ID token client-side and only refreshes it proactively
    // near expiry; without forceRefresh, a claim granted after the cached token
    // was minted stays invisible for up to an hour, even across reloads/re-logins.
    const tokenResult = await user.getIdTokenResult(true);
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
    
    // Create user profile + entitlement together via the backend callable.
    await createFreeProfileCallable({ displayName: displayName || null });
    const userProfile = await getUserProfile(user.uid);
    if (!userProfile) {
      throw new Error('Profile creation did not complete.');
    }
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
      // Create profile + entitlement via the backend callable (for existing
      // auth users whose Firestore profile is missing, e.g. legacy accounts).
      await createFreeProfileCallable({ displayName: user.displayName || null });
      userProfile = await getUserProfile(user.uid);
      if (!userProfile) {
        throw new Error('Profile creation did not complete.');
      }
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
        // Create profile + entitlement via the backend callable if it doesn't exist
        await createFreeProfileCallable({ displayName: user.displayName || null });
        userProfile = await getUserProfile(user.uid);
      }

      const isTrustedAdmin = await readTrustedAdminClaim(user);
      callback(userProfile ? userProfileToAuthUser(userProfile, isTrustedAdmin) : null);
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