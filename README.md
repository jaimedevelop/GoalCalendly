# Goal Calendly Application

A comprehensive goal tracking application built with React, TypeScript, and Google Firestore with Firebase Authentication.

## Features

- **User Authentication**: Secure login and signup with Firebase Auth
- **Subscription Plans**: Free (2 active goals, $0), Pro (15 active goals, $4.99/mo), Platinum (30 active goals, $9.99/mo), Enterprise (unlimited, custom pricing)
- **Admin Dashboard**: Admin users can manage all users and their subscriptions
- Create and manage personal goals (user-scoped data)
- Track progress with interactive calendars
- Set weekly targets and earn trophies
- Timer functionality for tracking practice sessions
- Import/Export goals
- Share goals via QR codes
- Complete goals tracking
- Multiple view layouts (Top, Double, Three)
- Starting a timer moves its goal first and scrolls it into view in every layout. Goals stay ordered by their most recent timer start after stopping; this order is saved with the goals. The running clock stays fixed at the bottom right.
- Timer ticks and taskbar notification updates run locally without database writes. Starting a timer saves only that goal's updated ordering; stopping saves only that goal's completed session totals. Individual goal edits and additions also save only the affected goal. The explicit Save Goals action still saves all goals.
- **Installable PWA**: Install the app to your home screen/desktop with offline support via a service worker
- **Background Timer Notifications**: Active timers keep tracking and notify you even when the app is in the background or the phone is locked, including a persistent mobile taskbar/notification-bar indicator
- Real-time data synchronization with Firestore
- Secure cloud storage with user data isolation
- **Goal Limits**: Subscription-based limits on the number of goals users can create

## Admin Features

### Administrator Account
- **Admin provisioning**: trusted admins are granted via a Firebase custom claim (see `functions/scripts/setAdminClaim.ts`), not an automatic email match. There is no special "admin" email address.
- **User Management**: View, manage, and delete user accounts
- **Subscription Management**: View and modify user subscription plans
- **User Statistics**: Dashboard with user counts and subscription analytics
- **Unlimited Goals**: Admin users can create unlimited goals without subscription restrictions
- **No Payment Required**: Admin account is free from all subscription limitations

### Subscription Plans
- **Free Plan**: Up to 2 active goals, $0/mo, with advertising
- **Pro Plan**: Up to 15 active goals, $4.99/mo ($49.90/yr)
- **Platinum Plan**: Up to 30 active goals, $9.99/mo ($99.90/yr)
- **Enterprise Plan**: Unlimited active goals (contact us for pricing)

Users are automatically enrolled in the Free plan upon registration, no card required. Goal creation is limited based on the user's current **active** goal count (completed goals don't count against the limit) and is enforced server-side — see `admin_subscriptions.md` for the full billing/entitlement design.

## Components

The application consists of several key components:

- **GoalCard**: Main component for displaying goal information and progress
- **Calendar**: Shows practice days and progress visualization
- **ActiveTimer**: Tracks ongoing practice sessions
- **NewGoalDialog**: Interface for creating new goals
- **ShareDialog**: Handles goal sharing functionality
- **ImportTimeDialog**: Manages goal import process
- **SettingsDialog**: Configures goal-specific settings
- **AdminDashboard**: Admin interface for user and subscription management
- **SubscriptionPlan**: Displays current plan and upgrade options

## Local Setup

### Prerequisites

1. Node.js (v16 or higher)
2. Firebase project with Firestore enabled
3. Git (optional)

### Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore Database in your Firebase project
3. Enable Authentication and configure Email/Password provider:
   - Go to Authentication > Sign-in method
   - Enable "Email/Password" provider
   - Optionally enable "Email link (passwordless sign-in)"
4. Get your Firebase configuration from Project Settings > General > Your apps
5. Update the Firebase configuration in `src/config/firebase.ts`

### Firestore Security Rules

Deploy the security rules from the `firestore.rules` file at the repo root
(`firebase deploy --only firestore:rules`) — do not copy the snippet below,
it is a summary, not the source of truth:

- Users can read their own profile, but can only update allowlisted personal
  fields; `role` and `subscriptionPlan` cannot be changed by the client at
  all (they're set only by trusted backend functions).
- Goals: the owner can read their own goals; **all writes go through the
  authenticated backend function `mutateGoals`** (see `functions/src/goals/mutateGoals.ts`),
  which enforces the active-goal limit atomically. Direct client writes to
  `goals/*` are denied.
- Trusted admin status comes only from a Firebase custom claim (see
  `functions/scripts/setAdminClaim.ts`), never from an email address or a
  Firestore field.
- Billing, entitlement, usage, and audit-log collections are backend-owned;
  clients can read their own entitlement/billing summary but never write to
  any of them directly.
- Shared goals remain readable/writable by any authenticated user, matching
  the app's public sharing feature.

See `admin_subscriptions.md` for the full data model and rationale.

### Application Setup

1. Clone or copy the project files to your local machine

2. Install project dependencies:
   ```bash
   npm install
   ```

3. Test your Firestore connection:
   ```bash
   npm run test:firestore
   ```

4. Initialize Firestore with sample data (optional):
   ```bash
   npm run init:firestore
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open http://localhost:5173 in your browser

## Database Structure

The Firestore database contains the following collections:

- **goals**: Main collection storing goal documents
  - Properties: id, name, targetHours, currentLevel, etc.
  - Type: 'goal'
  - Indexed by: updatedAt, completed, completedDate

- **users**: User profile collection for subscription and role management
  - Properties: uid, email, displayName, role, subscriptionPlan, createdAt, updatedAt
  - Roles: 'user' | 'admin'
  - Subscription Plans: 'free' | 'pro' | 'platinum' | 'enterprise'

- **sharedGoals**: Collection for shared goal data
  - Properties: id, goals, timestamp, expiresAt
  - Used for persistent goal sharing

## PWA and Notifications

The app is installable as a Progressive Web App and uses a service worker (`public/sw.js`) for offline caching and background timer notifications.

- See [PWA_NOTIFICATION_GUIDE.md](./PWA_NOTIFICATION_GUIDE.md) for details on the notification setup and mobile taskbar/active-timer behavior.
- Manifest and icons live in `public/manifest.json` and `public/icon-*.svg`.

## Admin and Subscription Setup

For detailed instructions on setting up the admin user management system and subscription plans, see the [ADMIN_SETUP.md](./ADMIN_SETUP.md) guide.

### Quick Admin Setup
1. Register a normal account and find its Firebase UID
2. Grant the trusted admin claim (from `functions/`): `ADMIN_ACTION_ACTOR_UID=<your-uid> npx tsx scripts/setAdminClaim.ts <target-uid> grant "reason"`
3. Deploy the Firestore security rules from `firestore.rules`
4. Sign out and back in (or refresh the ID token) so the new claim takes effect, then access the Admin Dashboard

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test:firestore` - Test Firestore connection
- `npm run init:firestore` - Initialize Firestore with sample data
- `npm run diagnose:firestore` - Diagnose Firestore connection issues

## Data Import/Export

### Import Goals
1. Use the Import button in the application
2. Select a JSON file with the correct format:
   ```json
   {
     "goals": [...],
     "exportDate": "2024-01-01T00:00:00.000Z",
     "version": "1.0"
   }
   ```

### Export Goals
1. Use the Export button to download your goals as JSON
2. The exported file can be imported later or used for backup

## Sharing Goals

The application supports two types of goal sharing:

1. **Temporary Sharing**: Share goals with a temporary link for 24 hours
2. **Persistent Sharing**: Store shared goals in Firestore with expiration

## Troubleshooting

### Common Issues

1. **Firebase Configuration Error**:
   - Verify your Firebase config in `src/config/firebase.ts`
   - Ensure your Firebase project has Firestore enabled
   - Check that your API key is valid

2. **Permission Denied**:
   - Update your Firestore security rules
   - Ensure the rules allow read/write access for your use case

3. **Connection Issues**:
   - Run `npm run test:firestore` to verify connectivity
   - Check your internet connection
   - Verify Firebase project is active

4. **Import/Export Issues**:
   - Ensure JSON file format is correct
   - Check browser console for detailed error messages
   - Verify file permissions

### Development Tips

1. **Firestore Emulator** (Optional):
   ```bash
   npm install -g firebase-tools
   firebase init emulators
   firebase emulators:start
   ```

2. **Monitoring Usage**:
   - Check Firebase console for usage statistics
   - Monitor read/write operations
   - Set up billing alerts if needed

3. **Performance Optimization**:
   - Use Firestore indexes for complex queries
   - Implement pagination for large datasets
   - Consider offline persistence for better UX

## Environment Variables

For different environments, you can use environment variables:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## Deployment

### Security Preparation
Before deploying to production, ensure you've followed the security guidelines in [`SECURITY_DEPLOYMENT.md`](./SECURITY_DEPLOYMENT.md).

### Netlify Deployment
1. **Prepare for deployment**:
   ```bash
   npm run build
   ```

2. **Environment Variables**: Set up the following environment variables in your Netlify dashboard:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`

3. **Build Settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`

4. **Deploy**: Connect your GitHub repository to Netlify for automatic deployments

### Other Platforms
The application can be deployed to any static hosting service that supports environment variables:
- Vercel
- GitHub Pages (with GitHub Actions)
- AWS S3 + CloudFront
- Firebase Hosting

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Check Firebase console logs
3. Verify your Firestore security rules
4. Verify all prerequisites are met
5. Test Firestore connection with `npm run test:firestore`
6. Review [`SECURITY_DEPLOYMENT.md`](./SECURITY_DEPLOYMENT.md) for deployment issues

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
