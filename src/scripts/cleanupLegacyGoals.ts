import { db } from '../config/firebase';
import { getCurrentUser } from '../services/auth';
import {
  collection,
  getDocs,
  deleteDoc,
  query
} from 'firebase/firestore';

const GOALS_COLLECTION = 'goals';

import { DocumentReference } from 'firebase/firestore';

interface LegacyGoal {
  id: string;
  data: Record<string, unknown>;
  docRef: DocumentReference;
}

interface ValidGoal {
  userId: string;
  [key: string]: unknown;
}

export async function cleanupLegacyGoals() {
  try {
    console.log('=== LEGACY GOALS CLEANUP ===');
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      console.error('❌ No authenticated user found');
      return;
    }
    
    console.log('✅ Current user:', currentUser.uid, currentUser.email);
    
    // Only allow admin to run this cleanup
    if (currentUser.email !== 'admin@admin.com') {
      console.error('❌ Only admin users can run legacy cleanup');
      return;
    }
    
    console.log('✅ Admin user confirmed, proceeding with cleanup...');
    
    // Find all goals without userId
    console.log('\n--- Finding legacy goals without userId ---');
    const goalsCollection = collection(db, GOALS_COLLECTION);
    const allGoalsQuery = query(goalsCollection);
    const allGoalsSnapshot = await getDocs(allGoalsQuery);
    
    const legacyGoals: LegacyGoal[] = [];
    const validGoals: ValidGoal[] = [];
    
    allGoalsSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      if (!data.userId || data.userId === null || data.userId === undefined) {
        legacyGoals.push({
          id: docSnapshot.id,
          data: data,
          docRef: docSnapshot.ref
        });
      } else {
        validGoals.push(data as ValidGoal);
      }
    });
    
    console.log(`📊 Found ${legacyGoals.length} legacy goals without userId`);
    console.log(`📊 Found ${validGoals.length} valid goals with userId`);
    
    if (legacyGoals.length === 0) {
      console.log('✅ No legacy goals found. Database is clean!');
      return;
    }
    
    // Display legacy goals for review
    console.log('\n--- Legacy goals to be deleted ---');
    legacyGoals.forEach((goal, index) => {
      console.log(`${index + 1}. ID: ${goal.id}`);
      console.log(`   Name: ${goal.data.name || 'No name'}`);
      console.log(`   Type: ${goal.data.type || 'No type'}`);
      console.log(`   Created: ${goal.data.startDate || 'Unknown'}`);
      console.log(`   UserId: ${goal.data.userId || 'MISSING'}`);
      console.log('   ---');
    });
    
    // Confirm deletion
    const confirmMessage = `⚠️  WARNING: This will permanently delete ${legacyGoals.length} legacy goals without userId.\n\nThis action cannot be undone!\n\nType 'DELETE_LEGACY_GOALS' to confirm:`;
    const confirmation = prompt(confirmMessage);
    
    if (confirmation !== 'DELETE_LEGACY_GOALS') {
      console.log('❌ Cleanup cancelled by user');
      return;
    }
    
    console.log('\n--- Starting deletion process ---');
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const goal of legacyGoals) {
      try {
        await deleteDoc(goal.docRef);
        console.log(`✅ Deleted goal: ${goal.id} - ${goal.data.name || 'No name'}`);
        deletedCount++;
      } catch (error) {
        console.error(`❌ Failed to delete goal ${goal.id}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n=== CLEANUP COMPLETE ===');
    console.log(`✅ Successfully deleted: ${deletedCount} goals`);
    console.log(`❌ Failed to delete: ${errorCount} goals`);
    console.log(`📊 Remaining valid goals: ${validGoals.length}`);
    
    if (deletedCount > 0) {
      console.log('\n💡 Recommendation: Refresh the application to see updated data');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Make function available globally in browser
declare global {
  interface Window {
    cleanupLegacyGoals: () => Promise<void>;
  }
}

// Make function available in browser console
if (typeof window !== 'undefined') {
  window.cleanupLegacyGoals = cleanupLegacyGoals;
  console.log('💡 Run cleanupLegacyGoals() in browser console to clean up legacy goals (admin only)');
}