import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Gem, Building, Users, Check, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { SubscriptionPlan, SUBSCRIPTION_PLANS } from '../types.js';
import { SUBSCRIPTION_PLANS as SHARED_SUBSCRIPTION_PLANS, ENTERPRISE_CONTACT_EMAIL } from '../../shared/subscriptionPlans.js';
import { AuthUser } from '../services/auth.js';
import { startCheckout, openBillingPortal } from '../services/billing.js';
import { useSubscription } from '../hooks/useSubscription.js';
import { useBillingSummary } from '../hooks/useBillingSummary.js';
import type { BillingInterval } from '../../shared/subscriptionPlans.js';

interface SubscriptionPlanProps {
  user: AuthUser;
  currentGoalCount: number;
}

const SubscriptionPlanComponent: React.FC<SubscriptionPlanProps> = ({ user, currentGoalCount }) => {
  const navigate = useNavigate();
  const isAdmin = user.isTrustedAdmin;

  const { entitlement, isLoading: isEntitlementLoading } = useSubscription(user.uid);
  // Live, server-verified plan drives every display below — the raw
  // Firestore subscriptionPlan field only reflects billing changes after a
  // fresh sign-in, so it's used purely as a loading-state fallback here
  // (admin_subscriptions.md section 7/8: labels must update without signing
  // out). Admins always effectively see 'enterprise'/unlimited regardless.
  const displayPlan: SubscriptionPlan = !isEntitlementLoading && entitlement ? entitlement.plan : user.subscriptionPlan;
  const currentPlan = SUBSCRIPTION_PLANS[displayPlan];
  const isAtLimit = !isAdmin && currentPlan.maxGoals !== -1 && currentGoalCount >= currentPlan.maxGoals;

  const [interval, setIntervalChoice] = useState<BillingInterval>('month');
  const [pendingPlan, setPendingPlan] = useState<'pro' | 'platinum' | null>(null);
  const [portalPending, setPortalPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { summary: billingSummary } = useBillingSummary(user.uid);
  const hasPaidBillingRecord = entitlement?.source === 'stripe' ||
    ['active', 'past_due', 'trialing', 'unpaid', 'paused', 'incomplete'].includes(billingSummary?.status ?? '');
  const isPastDue = billingSummary?.status === 'past_due';

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

  const priceForInterval = (plan: 'pro' | 'platinum'): number | null => {
    // SUBSCRIPTION_PLANS (src/types.ts) only carries a monthly `price` for
    // backward compatibility; read both intervals from the shared catalog
    // directly so the toggle can show either one accurately.
    const def = SHARED_SUBSCRIPTION_PLANS[plan];
    return interval === 'month' ? def.monthlyPrice : def.annualPrice;
  };

  const handleUpgradeClick = async (plan: 'pro' | 'platinum') => {
    setActionError(null);
    setPendingPlan(plan);
    const result = await startCheckout(plan, interval);
    if (result.ok && result.url) {
      window.location.href = result.url;
      return;
    }
    setPendingPlan(null);
    setActionError(result.error?.message ?? 'Could not start checkout. Please try again.');
  };

  const handleManageBilling = async () => {
    setActionError(null);
    setPortalPending(true);
    const result = await openBillingPortal();
    if (result.ok && result.url) {
      window.location.href = result.url;
      return;
    }
    setPortalPending(false);
    setActionError(result.error?.message ?? 'Could not open billing management. Please try again.');
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
          <div className={`p-2 rounded-lg border ${getPlanColor(displayPlan)}`}>
            {getPlanIcon(displayPlan)}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {getPlanName(displayPlan)} Plan
            </h3>
            <p className="text-sm text-gray-500">Your current subscription</p>
          </div>
        </div>
        {!isAdmin && hasPaidBillingRecord && (
          <button
            onClick={handleManageBilling}
            disabled={portalPending}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {portalPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Manage billing
          </button>
        )}
        {isAdmin && (
          <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full font-medium">
            Administrator
          </span>
        )}
      </div>

      {!isAdmin && hasPaidBillingRecord && (
        <div className="mb-4 text-sm text-gray-600">
          <p>Change between Pro and Platinum in billing. Stripe shows any price adjustment before you confirm.</p>
          <button
            onClick={handleManageBilling}
            disabled={portalPending}
            className="mt-2 underline disabled:opacity-50"
          >
            {billingSummary?.cancelAtPeriodEnd ? 'Manage scheduled cancellation in Stripe' : 'Cancel subscription in Stripe'}
          </button>
          <p className="mt-1">Opens Stripe billing for confirmation. Cancellation takes effect at the end of your paid period.</p>
        </div>
      )}

      {entitlement?.source === 'complimentary' && (
        <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800">
          This access is a complimentary grant, not a paid subscription{entitlement.expiresAt ? ` — expires ${new Date(entitlement.expiresAt).toLocaleDateString()}` : ''}.
        </div>
      )}

      {isPastDue && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Your last payment didn't go through.</p>
            <p className="mt-0.5">
              Your access continues for now
              {billingSummary?.gracePeriodEndsAt
                ? ` — please update your payment method by ${new Date(billingSummary.gracePeriodEndsAt).toLocaleDateString()} to avoid losing paid access.`
                : '. Please update your payment method to avoid losing paid access.'}
              {' '}
              <button onClick={handleManageBilling} className="underline hover:no-underline font-medium">
                Update payment method
              </button>
            </p>
          </div>
        </div>
      )}

      {!isPastDue && billingSummary?.cancelAtPeriodEnd && billingSummary.paidThroughDate && (
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
          Your subscription is set to cancel on {new Date(billingSummary.paidThroughDate).toLocaleDateString()}. You'll keep your current plan's access until then.
        </div>
      )}

      {actionError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

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
      {!isAdmin && displayPlan !== 'enterprise' && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">Available Plans</h4>
            <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1 text-xs">
              <button
                onClick={() => setIntervalChoice('month')}
                className={`px-2 py-1 rounded ${interval === 'month' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIntervalChoice('year')}
                className={`px-2 py-1 rounded ${interval === 'year' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}
              >
                Annual
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(SUBSCRIPTION_PLANS).map(([planKey, plan]) => {
              const planType = planKey as SubscriptionPlan;
              if (planType === displayPlan) return null;

              const isPurchasable = planType === 'pro' || planType === 'platinum';
              const price = isPurchasable ? priceForInterval(planType) : null;

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
                          <span className="text-sm font-semibold text-gray-700">
                            ${price}/{interval === 'month' ? 'mo' : 'yr'}
                          </span>
                        )}
                      </div>
                    </div>
                    {planType === 'enterprise' ? (
                      <a
                        href={`mailto:${ENTERPRISE_CONTACT_EMAIL}?subject=Goal%20Calendly%20Enterprise`}
                        className="text-sm px-3 py-1 bg-white border border-current rounded hover:bg-gray-50"
                      >
                        Contact
                      </a>
                    ) : isPurchasable ? (
                      <button
                        onClick={() => hasPaidBillingRecord ? handleManageBilling() : handleUpgradeClick(planType)}
                        disabled={pendingPlan !== null || portalPending}
                        className="text-sm px-3 py-1 bg-white border border-current rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
                      >
                        {pendingPlan === planType && <Loader2 className="w-3 h-3 animate-spin" />}
                        {hasPaidBillingRecord ? 'Change in billing' : 'Upgrade'}
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
