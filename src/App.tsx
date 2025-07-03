import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import Signup from './pages/Signup';
import { Goals } from './pages/Goals';
import { Settings } from './pages/Settings';
import { CompletedGoals } from './pages/CompletedGoals';
import { Help } from './pages/Help';
import { Header } from './components/Header';
import { Toaster } from './components/ui/toaster';
import AdminDashboard from './components/AdminDashboard';
import SubscriptionPlan from './components/SubscriptionPlan';
import { AdvertisingManager } from './components/AdvertisingManager';
import { useStore } from './store';
import { onAuthStateChange, signOutUser } from './services/auth';

function App() {
  const { user, isAuthLoading, setUser, setAuthLoading, clearUserData } = useStore();

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
              
              <Routes>
                <Route path="/goals" element={<Goals />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/completed" element={<CompletedGoals />} />
                <Route path="/help" element={<Help />} />
                <Route
                  path="/subscription"
                  element={<SubscriptionPlan user={user} currentGoalCount={0} />}
                />
                {user.role === 'admin' && user.email === 'admin@admin.com' && (
                  <Route path="/admin" element={<AdminDashboard />} />
                )}
                <Route path="/" element={<Navigate to="/goals" replace />} />
              </Routes>
            </div>
          </AdvertisingManager>
        )}
      </Router>
      <Toaster />
    </>
  );
}

export default App;