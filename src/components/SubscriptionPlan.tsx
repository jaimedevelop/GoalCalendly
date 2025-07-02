import { useNavigate } from 'react-router-dom';
import { Star, Gem, Building, Users, Check, ArrowLeft } from 'lucide-react';
import { SubscriptionPlan, SUBSCRIPTION_PLANS } from '../types.js';
import { AuthUser } from '../services/auth.js';

interface SubscriptionPlanProps {
  user: AuthUser;
  currentGoalCount: number;
}

const SubscriptionPlanComponent: React.FC<SubscriptionPlanProps> = ({ user, currentGoalCount }) => {
  const navigate = useNavigate();
  const currentPlan = SUBSCRIPTION_PLANS[user.subscriptionPlan];
  const isAdmin = user.email === 'admin@admin.com';
  const isAtLimit = !isAdmin && currentPlan.maxGoals !== -1 && currentGoalCount >= currentPlan.maxGoals;

  const getPlanIcon = (plan: SubscriptionPlan) => {
    switch (plan) {
      case 'free': return <Users className="w-5 h-5" />;
      case 'pro': return <Star className="w-5 h-5" />;
      case 'platinum': return <Gem className="w-5 h-5" />;
      case 'enterprise': return <Building className="w-5 h-5" />;
    }
  };

  const getPlanColor = (plan: SubscriptionPlan) => {
    switch (plan) {
      case 'free': return 'text-gray-600 bg-gray-100 border-gray-200';
      case 'pro': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'platinum': return 'text-purple-600 bg-purple-100 border-purple-200';
      case 'enterprise': return 'text-orange-600 bg-orange-100 border-orange-200';
    }
  };

  const getPlanName = (plan: SubscriptionPlan) => {
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <button
          onClick={() => navigate('/goals')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Goals
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${getPlanColor(user.subscriptionPlan)}`}>
            {getPlanIcon(user.subscriptionPlan)}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {getPlanName(user.subscriptionPlan)} Plan
            </h3>
            <p className="text-sm text-gray-500">Your current subscription</p>
          </div>
        </div>
        {!isAdmin && user.subscriptionPlan !== 'enterprise' && (
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Upgrade
          </button>
        )}
        {isAdmin && (
          <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full font-medium">
            Administrator
          </span>
        )}
      </div>

      {/* Goal Usage */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Goals</span>
          <span className="text-sm text-gray-500">
            {currentGoalCount} / {isAdmin || currentPlan.maxGoals === -1 ? '∞' : currentPlan.maxGoals}
          </span>
        </div>
        {!isAdmin && currentPlan.maxGoals !== -1 && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                isAtLimit ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ 
                width: `${Math.min((currentGoalCount / currentPlan.maxGoals) * 100, 100)}%` 
              }}
            />
          </div>
        )}
        {isAtLimit && (
          <p className="text-sm text-red-600 mt-1">
            You've reached your goal limit. Upgrade to create more goals.
          </p>
        )}
      </div>

      {/* Features */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Plan Features</h4>
        <div className="space-y-2">
          {currentPlan.features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-600">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade Options */}
      {!isAdmin && user.subscriptionPlan !== 'enterprise' && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Available Plans</h4>
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(SUBSCRIPTION_PLANS).map(([planKey, plan]) => {
              const planType = planKey as SubscriptionPlan;
              if (planType === user.subscriptionPlan) return null;
              
              return (
                <div key={planType} className={`p-3 rounded-lg border ${getPlanColor(planType)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getPlanIcon(planType)}
                      <div className="flex flex-col">
                        <span className="font-medium">{getPlanName(planType)}</span>
                        <span className="text-xs text-gray-500">
                          {plan.maxGoals === -1 ? 'Unlimited' : plan.maxGoals} goals
                        </span>
                      </div>
                      <div className="flex flex-col items-end ml-auto mr-2">
                        {planType === 'enterprise' ? (
                          <span className="text-sm font-semibold text-gray-700">Contact us</span>
                        ) : planType === 'free' ? (
                          <span className="text-sm font-semibold text-gray-700">Free</span>
                        ) : (
                          <span className="text-sm font-semibold text-gray-700">${plan.price}/month</span>
                        )}
                      </div>
                    </div>
                    {planType === 'enterprise' ? (
                      <button className="text-sm px-3 py-1 bg-white border border-current rounded hover:bg-gray-50">
                        Contact
                      </button>
                    ) : planType !== 'free' ? (
                      <button className="text-sm px-3 py-1 bg-white border border-current rounded hover:bg-gray-50">
                        Upgrade
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default SubscriptionPlanComponent;