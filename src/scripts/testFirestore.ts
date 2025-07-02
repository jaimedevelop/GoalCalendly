import { db } from '../config/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';

async function testFirestoreConnection() {
  try {
    console.log('Testing Firestore connection...');
    
    // Test write operation
    console.log('1. Testing write operation...');
    const testCollection = collection(db, 'test');
    const testDoc = await addDoc(testCollection, {
      message: 'Hello Firestore!',
      timestamp: new Date(),
      test: true
    });
    console.log('✅ Write operation successful. Document ID:', testDoc.id);
    
    // Test read operation
    console.log('2. Testing read operation...');
    const querySnapshot = await getDocs(testCollection);
    console.log('✅ Read operation successful. Found', querySnapshot.size, 'documents');
    
    // Clean up test documents
    console.log('3. Cleaning up test documents...');
    const deletePromises = querySnapshot.docs.map(docSnapshot => 
      deleteDoc(doc(db, 'test', docSnapshot.id))
    );
    await Promise.all(deletePromises);
    console.log('✅ Cleanup successful');
    
    console.log('🎉 Firestore connection test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Firestore connection test failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        console.log('💡 Tip: Check your Firestore security rules');
      } else if (error.message.includes('not-found')) {
        console.log('💡 Tip: Make sure Firestore is enabled in your Firebase project');
      } else if (error.message.includes('invalid-api-key')) {
        console.log('💡 Tip: Check your Firebase configuration in src/config/firebase.ts');
      }
    }
    
    return false;
  }
}

// Run test if this file is executed directly
if (typeof window === 'undefined') {
  testFirestoreConnection().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

export { testFirestoreConnection };