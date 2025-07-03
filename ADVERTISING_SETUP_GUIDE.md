# Advertising Demo Setup Guide

## Quick Setup Instructions

Since the advertising system is now fully implemented, you just need to create some demo data to see it in action. Here are two ways to do this:

### Option 1: Use the Admin Interface (Recommended)

1. **Login as Admin**
   - Go to your app and login with: `admin@admin.com` / `admin123`

2. **Create Advertising Ways**
   - Go to the Admin Dashboard → "Advertising Ways" tab
   - Click "Add New Advertising Way" and create these 6 methods:

   **Banner Advertisement**
   - Name: Banner Advertisement
   - Description: Display banner ads at the top of pages for maximum visibility
   - Display Method: banner
   - Target Location: top-of-page
   - Frequency: always
   - Status: Active ✓

   **Modal Pop-up**
   - Name: Modal Pop-up
   - Description: Show promotional modals after user milestones or time-based triggers
   - Display Method: modal
   - Target Location: center-screen
   - Frequency: milestone-based
   - Status: Active ✓

   **Sidebar Widget**
   - Name: Sidebar Widget
   - Description: Persistent sidebar widgets with relevant offers and promotions
   - Display Method: widget
   - Target Location: sidebar-right
   - Frequency: always
   - Status: Active ✓

   **Notification Style**
   - Name: Notification Style
   - Description: Non-intrusive notification-style ads in the corner
   - Display Method: notification
   - Target Location: top-right-corner
   - Frequency: periodic
   - Status: Active ✓

   **In-Context Suggestions**
   - Name: In-Context Suggestions
   - Description: Contextual suggestions within user workflows and forms
   - Display Method: suggestion
   - Target Location: inline-content
   - Frequency: contextual
   - Status: Active ✓

   **Footer Promotion**
   - Name: Footer Promotion
   - Description: Promotional content in the footer area of pages
   - Display Method: footer
   - Target Location: page-footer
   - Frequency: always
   - Status: Active ✓

3. **Create Demo Campaigns**
   - Go to the Admin Dashboard → "Advertising Campaigns" tab
   - Click "Add New Campaign" and create these campaigns:

   **Campaign 1: TaskMaster Pro Upgrade**
   - Name: TaskMaster Pro - Upgrade Now!
   - Type: Internal
   - URL: https://taskmaster.pro/upgrade
   - Description: Unlock unlimited goals and advanced features with TaskMaster Pro
   - Status: Active

   **Campaign 2: Productivity Books**
   - Name: Productivity Books - Amazon
   - Type: External
   - URL: https://amazon.com/productivity-books
   - Description: Discover the best productivity and goal-setting books
   - Status: Active

   **Campaign 3: Focus Timer App**
   - Name: Focus Timer App
   - Type: External
   - URL: https://focustimer.app
   - Description: Advanced Pomodoro timer to boost your productivity
   - Status: Active

### Option 2: Temporary Rule Modification (Advanced)

If you want to run the automated script, temporarily modify the Firestore rules:

1. **Temporarily Allow Public Write Access**
   ```javascript
   // Add this rule temporarily at the top of firestore.rules
   match /campaigns/{campaignId} {
     allow read, write, create, delete: if true; // TEMPORARY - REMOVE AFTER SETUP
   }
   match /advertisingWays/{advertisingWayId} {
     allow read, write, create, delete: if true; // TEMPORARY - REMOVE AFTER SETUP
   }
   ```

2. **Run the Setup Script**
   ```bash
   node src/scripts/setupAdvertisingDemo.js
   ```

3. **Restore Original Rules**
   - Remove the temporary rules and restore the admin-only restrictions

## Testing the Advertising System

Once you've created the demo data:

1. **Login as a Free User**
   - Create a new account or use an existing non-admin account
   - Make sure the user has `subscriptionTier: 'free'` in their profile

2. **You Should See:**
   - **Banner ads** at the top of pages
   - **Sidebar widgets** on the right side
   - **Notification** in the top-right corner
   - **Modal popup** after 5 seconds on the page
   - **Footer ads** at the bottom of pages
   - **Suggestion ads** when creating new goals

3. **Admin Users Won't See Ads**
   - The system only shows ads to users with `subscriptionTier: 'free'`
   - Admin and premium users won't see any advertisements

## Troubleshooting

If you don't see advertisements:

1. **Check User Subscription Tier**
   - Ensure the user profile has `subscriptionTier: 'free'`
   - Admin users (`role: 'admin'`) won't see ads

2. **Check Advertising Ways Status**
   - Ensure advertising ways are marked as "Active" in the admin panel

3. **Check Campaign Status**
   - Ensure campaigns are marked as "Active" in the admin panel

4. **Check Browser Console**
   - Look for any JavaScript errors that might prevent ad loading

## Current Implementation Status

✅ **Completed Features:**
- Admin dashboard with advertising management
- 6 different advertising presentation methods
- Campaign management system
- User subscription tier checking
- Advertising display components
- Integration with main app flow
- Firestore security rules

🎯 **Ready for Testing:**
The advertising system is fully functional and ready for testing once demo data is created using the instructions above.