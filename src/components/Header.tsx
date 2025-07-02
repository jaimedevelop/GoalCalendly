import { useNavigate } from 'react-router-dom';
import { Crown, HelpCircle } from 'lucide-react';
import { AuthUser } from '../services/auth';

interface HeaderProps {
  user: AuthUser;
  onSignOut: () => void;
}

export function Header({ user, onSignOut }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <h1 className="text-xl font-semibold text-gray-900">Goal Calendly</h1>
          <div className="flex items-center space-x-4">
            {user.role === 'admin' && user.email === 'admin@admin.com' && (
              <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                <Crown className="w-3 h-3" />
                Admin
              </div>
            )}
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
              {user.subscriptionPlan.charAt(0).toUpperCase() + user.subscriptionPlan.slice(1)}
            </div>
            <span className="text-sm text-gray-600">
              Welcome, {user.displayName || user.email}
            </span>
            <button
              onClick={() => navigate('/help')}
              className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700"
              title="Help & Guide"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Help</span>
            </button>
            <button
              onClick={onSignOut}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}