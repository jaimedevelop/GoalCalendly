import { useNavigate } from 'react-router-dom';
import { Crown, HelpCircle, AlertTriangle } from 'lucide-react';
import { AuthUser } from '../services/auth';
import { useStore } from '../store';
import { useBillingSummary } from '../hooks/useBillingSummary.js';

interface HeaderProps {
  user: AuthUser;
  onSignOut: () => void;
}

export function Header({ user, onSignOut }: HeaderProps) {
  const navigate = useNavigate();
  const { entitlement, isEntitlementLoading } = useStore();
  const { summary: billingSummary } = useBillingSummary(user.uid);

  // Prefer the live, server-verified entitlement plan over the raw Firestore
  // `subscriptionPlan` field, which only reflects billing state after a
  // sign-out/sign-in. Falls back to the profile field only while the
  // entitlement hasn't loaded yet, so the badge never goes blank.
  const displayPlan = !isEntitlementLoading && entitlement ? entitlement.plan : user.subscriptionPlan;
  const isPastDue = billingSummary?.status === 'past_due';

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-2 overflow-x-auto">
          <h1 className="text-xl font-semibold text-gray-900 flex-shrink-0">Goal Calendly</h1>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {user.isTrustedAdmin && (
              <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium whitespace-nowrap">
                <Crown className="w-3 h-3" />
                Admin
              </div>
            )}
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium whitespace-nowrap">
              {displayPlan.charAt(0).toUpperCase() + displayPlan.slice(1)}
            </div>
            {isPastDue && (
              <button
                onClick={() => navigate('/subscription')}
                className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium hover:bg-amber-200 whitespace-nowrap"
                title="Payment issue — click to update your billing"
              >
                <AlertTriangle className="w-3 h-3" />
                <span className="hidden sm:inline">Payment issue</span>
              </button>
            )}
            <span className="text-sm text-gray-600 hidden md:inline whitespace-nowrap">
              Welcome, {user.displayName || user.email}
            </span>
            <button
              onClick={() => navigate('/help')}
              className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700 whitespace-nowrap"
              title="Help & Guide"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Help</span>
            </button>
            <button
              onClick={onSignOut}
              className="text-sm text-gray-500 hover:text-gray-700 whitespace-nowrap"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}