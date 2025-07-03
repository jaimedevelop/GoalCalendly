import { db } from '../config/firebase';
import { getCurrentUser } from '../services/auth';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy
} from 'firebase/firestore';

const GOALS_COLLECTION = 'goals';

export async function diagnoseUserIsolation() {
  try {
    console.log('=== USER ISOLATION DIAGNOSTIC ===');
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      console.error('❌ No authenticated user found');
      return;
    }
    
    console.log('✅ Current user:', currentUser.uid, currentUser.email);
    
    // Test 1: Query ALL goals (no filters)
    console.log('\n--- Test 1: ALL GOALS (no filters) ---');
    const allGoalsQuery = query(collection(db, GOALS_COLLECTION));
    const allGoalsSnapshot = await getDocs(allGoalsQuery);
    console.log('Total goals in database:', allGoalsSnapshot.size);
    
    const userGoalCounts: { [userId: string]: number } = {};
    allGoalsSnapshot.forEach((doc) => {
      const data = doc.data();
      const userId = data.userId || 'NO_USER_ID';
      userGoalCounts[userId] = (userGoalCounts[userId] || 0) + 1;
      console.log(`Goal ${data.id}: userId=${data.userId}, type=${data.type}, name=${data.name}`);
    });
    
    console.log('Goals by user:', userGoalCounts);
    
    // Test 2: Query with type filter only
    console.log('\n--- Test 2: TYPE FILTER ONLY ---');
    const typeOnlyQuery = query(
      collection(db, GOALS_COLLECTION),
      where('type', '==', 'goal')
    );
    const typeOnlySnapshot = await getDocs(typeOnlyQuery);
    console.log('Goals with type="goal":', typeOnlySnapshot.size);
    
    // Test 3: Query with userId filter only
    console.log('\n--- Test 3: USER ID FILTER ONLY ---');
    const userOnlyQuery = query(
      collection(db, GOALS_COLLECTION),
      where('userId', '==', currentUser.uid)
    );
    const userOnlySnapshot = await getDocs(userOnlyQuery);
    console.log('Goals for current user:', userOnlySnapshot.size);
    
    // Test 4: Query with both filters (current implementation)
    console.log('\n--- Test 4: BOTH FILTERS (current implementation) ---');
    try {
      const bothFiltersQuery = query(
        collection(db, GOALS_COLLECTION),
        where('type', '==', 'goal'),
        where('userId', '==', currentUser.uid),
        orderBy('updatedAt', 'desc')
      );
      const bothFiltersSnapshot = await getDocs(bothFiltersQuery);
      console.log('Goals with both filters:', bothFiltersSnapshot.size);
      
      bothFiltersSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`✅ User goal: ${data.id} - ${data.name} (userId: ${data.userId})`);
      });
    } catch (error) {
      console.error('❌ Error with both filters query:', error);
      console.log('This might indicate a missing composite index!');
    }
    
    // Test 5: Check for goals without userId
    console.log('\n--- Test 5: GOALS WITHOUT USER ID ---');
    const noUserIdQuery = query(
      collection(db, GOALS_COLLECTION),
      where('userId', '==', null)
    );
    try {
      const noUserIdSnapshot = await getDocs(noUserIdQuery);
      console.log('Goals without userId:', noUserIdSnapshot.size);
    } catch {
      console.log('Cannot query for null userId (expected)');
    }
    
    console.log('\n=== DIAGNOSTIC COMPLETE ===');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

// Make function available globally in browser
declare global {
  interface Window {
    diagnoseUserIsolation: () => Promise<void>;
  }
}

// Run diagnostic if this file is executed directly
if (typeof window !== 'undefined') {
  window.diagnoseUserIsolation = diagnoseUserIsolation;
  console.log('💡 Run diagnoseUserIsolation() in browser console to test user isolation');
}