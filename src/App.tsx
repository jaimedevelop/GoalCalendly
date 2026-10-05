import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import Signup from './pages/Signup';
import { Goals } from './pages/Goals';
import { Settings } from './pages/Settings';
import { CompletedGoals } from './pages/CompletedGoals';
import { Help } from './pages/Help';
import { Reports } from './pages/Reports';
import { Header } from './components/Header';
import { ActiveTimer } from './components/ActiveTimer';
import { Toaster } from './components/ui/toaster';
import AdminDashboard from './components/AdminDashboard';
import SubscriptionPlan from './components/SubscriptionPlan';
import { BillingReturn } from './pages/BillingReturn';
import { AdvertisingManager } from './components/AdvertisingManager';
import PWAInstallPrompt from './components/PWAInstallPrompt.tsx';
import { useStore } from './store';
import { onAuthStateChange, signOutUser } from './services/auth';
import { loadFromFirestore } from './services/db';
import { useSubscription } from './hooks/useSubscription.js';

import { useGoalReminders } from './hooks/useGoalReminders';

function App() {
  const { user, isAuthLoading, setUser, setAuthLoading, clearUserData, goals, setGoals, setEntitlement } = useStore();
  const activeGoalCount = goals.filter((g) => !g.completed).length;
  const [goalLoadAttempt, setGoalLoadAttempt] = useState(0);
  const [goalLoadError, setGoalLoadError] = useState(false);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const uid = user?.uid;
  useGoalReminders(uid);

  // Single live entitlement subscription for the whole app, pushed into the
  // store so Header/AdvertisingManager/pricing screens all read the same
  // server-verified plan instead of each mounting its own listener or
  // falling back to the stale Firestore `subscriptionPlan` field.
  const { entitlement, isLoading: isEntitlementLoading } = useSubscription(user?.uid ?? null);
  useEffect(() => {
    setEntitlement(entitlement, isEntitlementLoading);
  }, [entitlement, isEntitlementLoading, setEntitlement]);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChange((user) => {
      console.log('[DEBUG] Auth state change:', user ? 'authenticated' : 'unauthenticated');

      // Clear user data when logging out (user becomes null)
      if (!user) {
        console.log('[DEBUG] User logged out, clearing user data');
        clearUserData();
      }

      setUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setAuthLoading, clearUserData]);

  // Load goals once per authenticated session, app-wide, so every route
  // (including /subscription on a direct visit) sees the real active-goal
  // count rather than a stale or hard-coded value.
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setGoalsLoading(true);
    setGoalLoadError(false);
    loadFromFirestore(uid)
      .then((firestoreGoals) => { if (!cancelled) setGoals(firestoreGoals); })
      .catch((error) => {
        console.error('Error loading goals:', error);
        if (!cancelled) setGoalLoadError(true);
      })
      .finally(() => { if (!cancelled) setGoalsLoading(false); });
    return () => { cancelled = true; };
  }, [uid, goalLoadAttempt, setGoals]);

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Show loading screen while checking auth state
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Single Router for all routes
  console.log('[DEBUG] Rendering routes for user:', user ? 'authenticated' : 'unauthenticated');
  return (
    <>
      <Router>
        {!user ? (
          // Unauthenticated routes
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        ) : (
          // Authenticated routes
          <AdvertisingManager>
            <div className="min-h-screen bg-gray-100">
              <Header user={user} onSignOut={handleSignOut} />
              {goalsLoading && <p role="status" className="p-3 text-center">Loading your goals...</p>}
              {goalLoadError && <div role="alert" className="p-3 text-center text-red-700">Your goals could not be loaded. <button className="underline" onClick={() => setGoalLoadAttempt(value => value + 1)}>Retry loading goals</button></div>}
              
              {!goalsLoading && !goalLoadError && <Routes>
                <Route path="/goals" element={<Goals />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/completed" element={<CompletedGoals />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/help" element={<Help />} />
                <Route
                  path="/subscription"
                  element={<SubscriptionPlan user={user} currentGoalCount={activeGoalCount} />}
                />
                <Route path="/billing/return" element={<BillingReturn />} />
                {user.isTrustedAdmin && (
                  <Route path="/admin" element={<AdminDashboard />} />
                )}
                <Route path="/" element={<Navigate to="/goals" replace />} />
              </Routes>}
              <ActiveTimer />
            </div>
          </AdvertisingManager>
        )}
      </Router>
      <Toaster />
      <PWAInstallPrompt />
    </>
  );
}

export default App;
