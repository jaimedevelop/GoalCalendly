// User-specific goal cleanup script
// This script cleans up the current user's goals only (respects new security rules)

import { db } from '../config/firebase';
import { collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
import { getCurrentUser } from '../services/auth';

export const cleanupCurrentUserGoals = async () => {
  console.log('🧹 [USER-CLEANUP] Starting current user goal cleanup...');
  
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      console.error('🧹 [USER-CLEANUP] No authenticated user found');
      return;
    }
    
    console.log('🧹 [USER-CLEANUP] Cleaning goals for user:', currentUser.uid);
    
    // Get current user's goals only (respects security rules)
    const goalsCollection = collection(db, 'goals');
    const userGoalsQuery = query(
      goalsCollection, 
      where('type', '==', 'goal'),
      where('userId', '==', currentUser.uid)
    );
    
    const querySnapshot = await getDocs(userGoalsQuery);
    console.log(`🧹 [USER-CLEANUP] Found ${querySnapshot.size} goals for current user`);
    
    if (querySnapshot.size === 0) {
      console.log('🧹 [USER-CLEANUP] No goals found to clean up');
      return;
    }
    
    // List all goals for user review
    const goals: Array<{ id: string; name: string; createdAt?: string }> = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      goals.push({
        id: doc.id,
        name: data.name || 'Unnamed Goal',
        createdAt: data.createdAt || 'Unknown'
      });
    });
    
    console.log('🧹 [USER-CLEANUP] Your goals:');
    goals.forEach((goal, index) => {
      console.log(`  ${index + 1}. ${goal.name} (ID: ${goal.id})`);
    });
    
    // Ask user what to do
    const action = prompt(`You have ${goals.length} goals. Choose action:\n1. Keep all goals\n2. Delete all goals\n3. Cancel\n\nEnter 1, 2, or 3:`);
    
    if (action === '2') {
      const confirmDelete = confirm(`Are you sure you want to delete ALL ${goals.length} of your goals? This cannot be undone!`);
      
      if (confirmDelete) {
        let deletedCount = 0;
        for (const goal of goals) {
          try {
            await deleteDoc(doc(db, 'goals', goal.id));
            console.log(`🧹 [USER-CLEANUP] Deleted: ${goal.name}`);
            deletedCount++;
          } catch (error) {
            console.error(`🧹 [USER-CLEANUP] Error deleting ${goal.name}:`, error);
          }
        }
        
        console.log(`🧹 [USER-CLEANUP] Successfully deleted ${deletedCount} goals`);
        
        // Refresh the page to update the UI
        const refreshPage = confirm('Goals deleted. Refresh page to update the UI?');
        if (refreshPage) {
          window.location.reload();
        }
      } else {
        console.log('🧹 [USER-CLEANUP] Deletion cancelled');
      }
    } else if (action === '1') {
      console.log('🧹 [USER-CLEANUP] Keeping all goals');
    } else {
      console.log('🧹 [USER-CLEANUP] Cleanup cancelled');
    }
    
  } catch (error) {
    console.error('🧹 [USER-CLEANUP] Error during cleanup:', error);
  }
};

// Make it available globally for browser console
declare global {
  interface Window {
    cleanupCurrentUserGoals: typeof cleanupCurrentUserGoals;
  }
}

window.cleanupCurrentUserGoals = cleanupCurrentUserGoals;

console.log('🧹 [USER-CLEANUP] User cleanup script loaded. Run cleanupCurrentUserGoals() to clean your goals.');