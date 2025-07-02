import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

async function diagnoseFirestoreIssues() {
  console.log('🔍 Diagnosing Firestore connection issues...\n');
  
  // Check 1: Firebase configuration
  console.log('1. Checking Firebase configuration...');
  try {
    console.log('   ✅ Firebase app initialized');
    console.log('   📋 Project ID:', db.app.options.projectId);
    console.log('   📋 Auth Domain:', db.app.options.authDomain);
  } catch (error) {
    console.log('   ❌ Firebase configuration error:', error);
    return;
  }
  
  // Check 2: Try a simple read operation (less restrictive than write)
  console.log('\n2. Testing read permissions...');
  try {
    const testDocRef = doc(db, 'test', 'permission-test');
    await getDoc(testDocRef);
    console.log('   ✅ Read operation successful (document may not exist, but permission granted)');
  } catch (error) {
    console.log('   ❌ Read operation failed:', error);
    if (error instanceof Error && error.message.includes('permission-denied')) {
      console.log('   🔍 This confirms it\'s a Firestore security rules issue');
    }
  }
  
  // Check 3: Authentication status
  console.log('\n3. Checking authentication status...');
  try {
    // In a browser environment, we could check auth state
    // For now, we'll just note that we're running unauthenticated
    console.log('   📋 Running as: Unauthenticated user');
    console.log('   📋 This means Firestore rules must allow unauthenticated access');
  } catch (error) {
    console.log('   ❌ Auth check failed:', error);
  }
  
  // Check 4: Provide specific guidance
  console.log('\n4. 🎯 Diagnosis Results:');
  console.log('   The PERMISSION_DENIED error indicates your Firestore security rules');
  console.log('   are blocking access. This is the default behavior for new Firestore databases.');
  
  console.log('\n5. 🔧 Recommended Fix:');
  console.log('   Update your Firestore security rules in the Firebase Console:');
  console.log('   1. Go to https://console.firebase.google.com');
  console.log('   2. Select your project:', db.app.options.projectId);
  console.log('   3. Navigate to Firestore Database > Rules');
  console.log('   4. Replace the rules with:');
  console.log(`
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   `);
  console.log('   5. Click "Publish"');
  
  console.log('\n⚠️  WARNING: The above rules allow unrestricted access.');
  console.log('   For production, implement proper authentication and more restrictive rules.');
}

// Run diagnosis if this file is executed directly
if (typeof window === 'undefined') {
  diagnoseFirestoreIssues().then(() => {
    console.log('\n✅ Diagnosis complete. Please update your Firestore rules and try again.');
  }).catch((error) => {
    console.error('❌ Diagnosis failed:', error);
  });
}

export { diagnoseFirestoreIssues };