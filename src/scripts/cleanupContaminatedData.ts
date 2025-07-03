// CRITICAL: Cleanup script for contaminated user data
// This script should be run in the browser console to clean up data that was
// created when Firestore rules were open (allow read, write: if true)

import { db } from '../config/firebase';
import { collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';

export const cleanupContaminatedData = async () => {
  console.log('🚨 [CLEANUP] Starting contaminated data cleanup...');
  
  try {
    // Get all goals
    const goalsCollection = collection(db, 'goals');
    const allGoalsQuery = query(goalsCollection, where('type', '==', 'goal'));
    const querySnapshot = await getDocs(allGoalsQuery);
    
    console.log(`🚨 [CLEANUP] Found ${querySnapshot.size} total goals`);
    
    // Group goals by userId to identify contamination
    const goalsByUser: { [userId: string]: Array<{ id: string; name: string; userId: string; [key: string]: unknown }> } = {};
    const goalsToDelete: string[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const userId = data.userId;
      
      if (!goalsByUser[userId]) {
        goalsByUser[userId] = [];
      }
      goalsByUser[userId].push({ id: doc.id, ...data } as { id: string; name: string; userId: string; [key: string]: unknown });
    });
    
    console.log('🚨 [CLEANUP] Goals by user:', Object.keys(goalsByUser).map(userId => ({
      userId,
      goalCount: goalsByUser[userId].length,
      goalNames: goalsByUser[userId].map(g => g.name)
    })));
    
    // Ask user which goals to keep for each user
    for (const userId of Object.keys(goalsByUser)) {
      const userGoals = goalsByUser[userId];
      console.log(`\n🚨 [CLEANUP] User ${userId} has ${userGoals.length} goals:`);
      userGoals.forEach((goal, index) => {
        console.log(`  ${index + 1}. ${goal.name} (ID: ${goal.id})`);
      });
      
      if (userGoals.length > 1) {
        const keepAll = confirm(`User ${userId} has ${userGoals.length} goals. Keep all goals for this user? (Cancel to delete duplicates)`);
        
        if (!keepAll) {
          // Keep only the first goal, mark others for deletion
          for (let i = 1; i < userGoals.length; i++) {
            goalsToDelete.push(userGoals[i].id);
            console.log(`🚨 [CLEANUP] Marked for deletion: ${userGoals[i].name} (${userGoals[i].id})`);
          }
        }
      }
    }
    
    // Delete marked goals
    if (goalsToDelete.length > 0) {
      const confirmDelete = confirm(`About to delete ${goalsToDelete.length} contaminated goals. Continue?`);
      
      if (confirmDelete) {
        for (const goalId of goalsToDelete) {
          try {
            await deleteDoc(doc(db, 'goals', goalId));
            console.log(`🚨 [CLEANUP] Deleted goal: ${goalId}`);
          } catch (error) {
            console.error(`🚨 [CLEANUP] Error deleting goal ${goalId}:`, error);
          }
        }
        
        console.log(`🚨 [CLEANUP] Successfully deleted ${goalsToDelete.length} contaminated goals`);
      } else {
        console.log('🚨 [CLEANUP] Cleanup cancelled by user');
      }
    } else {
      console.log('🚨 [CLEANUP] No contaminated goals found to delete');
    }
    
    console.log('🚨 [CLEANUP] Cleanup completed');
    
  } catch (error) {
    console.error('🚨 [CLEANUP] Error during cleanup:', error);
  }
};

// Make it available globally for browser console
declare global {
  interface Window {
    cleanupContaminatedData: typeof cleanupContaminatedData;
  }
}

window.cleanupContaminatedData = cleanupContaminatedData;

console.log('🚨 [CLEANUP] Cleanup script loaded. Run cleanupContaminatedData() in console to start cleanup.');