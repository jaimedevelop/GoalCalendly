# Firestore Setup Guide

## 🚨 **Fixing PERMISSION_DENIED Error**

The `PERMISSION_DENIED` error occurs because Firestore security rules are blocking access. Here's how to fix it:

### Step 1: Access Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **goal-calendly**
3. Navigate to **Firestore Database** in the left sidebar

### Step 2: Update Security Rules

1. Click on the **Rules** tab
2. You'll see the current rules (probably restrictive)
3. Replace the existing rules with this **development-friendly** version:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to all documents for development
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

4. Click **Publish** to save the changes

### Step 3: Test the Connection

After updating the rules, test your connection:

```bash
npm run test:firestore
```

You should see:
```
✅ Write operation successful
✅ Read operation successful
✅ Cleanup successful
🎉 Firestore connection test completed successfully!
```

## 🔒 **Production Security Rules**

⚠️ **WARNING**: The above rules allow unrestricted access and should only be used for development.

For production, use more restrictive rules like:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Goals collection - require authentication
    match /goals/{goalId} {
      allow read, write: if request.auth != null;
    }
    
    // Shared goals - allow read for anyone, write for authenticated users
    match /sharedGoals/{shareId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Test collection - allow for development only
    match /test/{testId} {
      allow read, write: if true;
    }
  }
}
```

## 🔧 **Alternative: Firebase Authentication Setup**

If you want to implement proper authentication:

### 1. Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click **Get started**
3. Choose sign-in methods (Email/Password, Google, etc.)

### 2. Update Your App

Add authentication to your React app:

```bash
npm install firebase
```

```typescript
// src/auth/firebase-auth.ts
import { getAuth, signInAnonymously } from 'firebase/auth';
import app from '../config/firebase';

const auth = getAuth(app);

// Sign in anonymously for development
export const signInAnonymous = () => {
  return signInAnonymously(auth);
};

export { auth };
```

### 3. Use Authentication in Your App

```typescript
// In your main component
import { signInAnonymous } from './auth/firebase-auth';

useEffect(() => {
  // Sign in anonymously when app loads
  signInAnonymous().then(() => {
    console.log('Signed in anonymously');
  });
}, []);
```

## 🎯 **Quick Fix Summary**

**For immediate development access:**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: **goal-calendly**
3. Firestore Database → Rules
4. Replace rules with: `allow read, write: if true;`
5. Click **Publish**
6. Test with: `npm run test:firestore`

## 📞 **Still Having Issues?**

If you continue to have problems:

1. Run the diagnostic: `npm run diagnose:firestore`
2. Check that Firestore is enabled in your Firebase project
3. Verify your Firebase configuration in `src/config/firebase.ts`
4. Ensure you're using the correct project ID

## 🔍 **Understanding the Error**

- **Code 7 PERMISSION_DENIED**: Firestore security rules are blocking the operation
- **Not related to**: Username/password (Firestore doesn't use traditional auth)
- **Common cause**: Default security rules deny all access
- **Solution**: Update security rules or implement authentication