# Security & Deployment Guide

## 🚨 CRITICAL: Before GitHub Upload

### 1. Remove Sensitive Files from Git History
If you've already committed sensitive files, you need to remove them from git history:

```bash
# Remove .env from git tracking (if previously committed)
git rm --cached .env

# Add and commit the security changes
git add .gitignore .env.example src/config/firebase.ts SECURITY_DEPLOYMENT.md
git commit -m "Security: Move Firebase config to environment variables"
```

### 2. Verify .env is Ignored
Make sure your `.env` file is NOT being tracked:
```bash
git status
# .env should NOT appear in the list
```

## 🔐 Environment Variables Setup

### For Local Development
1. Copy `.env.example` to `.env`
2. Fill in your actual Firebase credentials in `.env`
3. Never commit `.env` to git

### For Netlify Deployment
1. Go to your Netlify site dashboard
2. Navigate to Site settings > Environment variables
3. Add these environment variables:
   - `VITE_FIREBASE_API_KEY` = `AIzaSyAOGuFBMzXiM9YDMQKIFdKZAz-VVdIitp4`
   - `VITE_FIREBASE_AUTH_DOMAIN` = `goal-calendly.firebaseapp.com`
   - `VITE_FIREBASE_PROJECT_ID` = `goal-calendly`
   - `VITE_FIREBASE_STORAGE_BUCKET` = `goal-calendly.firebasestorage.app`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID` = `219082198777`
   - `VITE_FIREBASE_APP_ID` = `1:219082198777:web:c50bea586218335f705c28`
   - `VITE_FIREBASE_MEASUREMENT_ID` = `G-WCL14RTDH7`

## 🛡️ Firebase Security Rules

### Current Firestore Rules
Your current `firestore.rules` file should be reviewed for production:

```javascript
// Make sure your rules are restrictive enough for production
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Review these rules before production deployment
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Recommended Production Rules
Consider implementing more restrictive rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Goals are user-specific
    match /goals/{goalId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // Admin-only access to user management
    match /admin/{document=**} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## 🚀 Deployment Checklist

### Before GitHub Upload:
- [ ] `.env` is in `.gitignore`
- [ ] Firebase config uses environment variables
- [ ] No hardcoded secrets in code
- [ ] `.env.example` is included for reference

### Before Netlify Deployment:
- [ ] Environment variables configured in Netlify
- [ ] Firebase security rules reviewed
- [ ] Build command: `npm run build`
- [ ] Publish directory: `dist`

### After Deployment:
- [ ] Test authentication works
- [ ] Test database operations
- [ ] Verify admin functions work
- [ ] Check browser console for errors

## 🔍 Security Best Practices

1. **Never commit sensitive data** to version control
2. **Use environment variables** for all configuration
3. **Review Firebase security rules** regularly
4. **Monitor Firebase usage** and set up billing alerts
5. **Enable Firebase App Check** for production
6. **Use HTTPS only** (Netlify provides this automatically)

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify environment variables are set correctly
3. Test Firebase connection in development first
4. Review Netlify build logs for deployment issues