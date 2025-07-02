# Admin and Subscription Setup Guide

This guide covers the setup and configuration of the admin user management system and subscription plans for the Goal Calendly application.

## Overview

The application now includes:
- **Admin Dashboard**: User management interface for administrators
- **Subscription Plans**: Four tiers with different goal limits
- **User Profiles**: Firestore-based user management system
- **Role-based Access**: Admin-only features and user data isolation

## Admin Account Setup

### 1. Create Admin Account

The admin account is automatically assigned admin privileges based on the email address:

- **Admin Email**: `admin@admin.com`
- **Password**: Set any secure password during registration
- **Role**: Automatically assigned `admin` role upon first login

### 2. Admin Features

Once logged in as admin, you'll have access to:

- **User Management Dashboard**: View all registered users
- **User Statistics**: Total users, subscription distribution
- **User Actions**: Delete users, modify subscription plans
- **Admin Navigation**: Special admin menu items
- **Unlimited Goals**: Admin users can create unlimited goals without subscription restrictions
- **No Payment Required**: Admin account is free from all subscription limitations

### 3. Accessing Admin Dashboard

1. Register or login with `admin@admin.com`
2. Navigate to the Admin Dashboard via the navigation menu
3. View and manage all users in the system

## Subscription Plans

### Plan Tiers

| Plan | Goal Limit | Features |
|------|------------|----------|
| **Free** | 3 goals | Basic goal tracking |
| **Pro** | 15 goals | Enhanced features |
| **Platinum** | 30 goals | Premium features |
| **Enterprise** | Unlimited | Contact for pricing |

### Default Behavior

- **New Users**: Automatically enrolled in Free plan
- **Goal Limits**: Enforced during goal creation
- **Upgrade Path**: Users can view upgrade options (implementation pending)

### Plan Management

Admins can modify user subscription plans through the Admin Dashboard:

1. Navigate to Admin Dashboard
2. Find the user in the user list
3. Use the subscription dropdown to change plans
4. Changes take effect immediately

## Technical Implementation

### User Profile Structure

```typescript
interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  role: 'user' | 'admin';
  subscriptionPlan: 'free' | 'pro' | 'platinum' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
}
```

### Subscription Limits

```typescript
const SUBSCRIPTION_PLANS = {
  free: { goalLimit: 3, name: 'Free' },
  pro: { goalLimit: 15, name: 'Pro' },
  platinum: { goalLimit: 30, name: 'Platinum' },
  enterprise: { goalLimit: -1, name: 'Enterprise' } // -1 = unlimited
};
```

### Security Rules

The Firestore security rules ensure:
- Users can only access their own data
- Admin users can access all user profiles
- Goal creation respects subscription limits
- Proper authentication for all operations

## Setup Steps

### 1. Deploy Firestore Rules

Copy the rules from `firestore.rules` to your Firebase Console:

1. Go to Firebase Console > Firestore Database > Rules
2. Replace existing rules with the content from `firestore.rules`
3. Publish the rules

### 2. Test Admin Account

1. Register with email `admin@admin.com`
2. Verify admin role assignment in the user interface
3. Access the Admin Dashboard
4. Test user management features

### 3. Test Subscription Limits

1. Create a regular user account
2. Try to create more than 3 goals (should be blocked)
3. Use admin account to upgrade the user to Pro plan
4. Verify the user can now create up to 15 goals

### 4. Verify Security

1. Test that regular users cannot access admin features
2. Verify users can only see their own goals
3. Confirm admin can view all users but not their goals directly

## Troubleshooting

### Common Issues

1. **Admin Role Not Assigned**
   - Verify email is exactly `admin@admin.com`
   - Check browser console for authentication errors
   - Ensure Firestore rules are properly deployed

2. **Subscription Limits Not Working**
   - Check goal creation logic in Goals component
   - Verify subscription plan is properly set in user profile
   - Confirm limit checking function is working

3. **Admin Dashboard Not Accessible**
   - Verify user has admin role
   - Check navigation component for admin menu items
   - Ensure admin routes are properly configured

4. **User Profile Creation Issues**
   - Check authentication service integration
   - Verify Firestore rules allow user profile creation
   - Confirm user service functions are working

### Debug Steps

1. **Check User Profile**:
   ```javascript
   // In browser console
   console.log(await userService.getUserProfile(currentUser.uid));
   ```

2. **Verify Admin Status**:
   ```javascript
   // In browser console
   console.log(await userService.isAdmin(currentUser.uid));
   ```

3. **Check Subscription Limits**:
   ```javascript
   // In browser console
   console.log(store.getState().subscription);
   ```

## Development Notes

### File Structure

- `src/services/user.ts`: User management service
- `src/components/AdminDashboard.tsx`: Admin interface
- `src/components/SubscriptionPlan.tsx`: Subscription display
- `src/types.ts`: Type definitions for users and subscriptions
- `firestore.rules`: Security rules for user management

### Key Functions

- `userService.createUserProfile()`: Creates user profile on registration
- `userService.getAllUsers()`: Admin function to fetch all users
- `userService.deleteUser()`: Admin function to delete users
- `store.checkSubscriptionLimit()`: Validates goal creation against limits

### Future Enhancements

- Payment integration for subscription upgrades
- Email notifications for subscription changes
- Usage analytics and reporting
- Bulk user management operations
- Advanced admin permissions system

## Support

For issues with admin or subscription features:

1. Check this guide for common solutions
2. Verify Firestore rules are properly deployed
3. Test with browser developer tools
4. Check Firebase Console for error logs
5. Ensure all required services are properly configured