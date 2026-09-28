/**
 * Success/cancel return experience for Checkout and the Customer Portal
 * (admin_subscriptions.md section 5/7, step 7).
 *
 * A redirect back from Stripe is never proof of payment — this page shows a
 * "confirming" state and waits for the webhook-driven entitlement update
 * (via useSubscription's live listener) before declaring success, with a
 * timeout that offers a retry/support path if the webhook is slow or the
 * payment didn't actually complete.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { useSubscription } from '../hooks/useSubscription.js';

const CONFIRMATION_TIMEOUT_MS = 20_000;

export function BillingReturn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');
  const { user } = useStore();
  const { entitlement, isLoading } = useSubscription(user?.uid ?? null);
  const [timedOut, setTimedOut] = useState(false);
  const [initialPlan] = useState(() => entitlement?.plan ?? null);

  useEffect(() => {
    if (status !== 'success') return;
    const timer = setTimeout(() => setTimedOut(true), CONFIRMATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  if (status === 'cancelled') {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center">
        <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Checkout cancelled</h1>
        <p className="text-gray-600 mb-6">
          No changes were made to your account. Your current access remains exactly as it was.
        </p>
        <button
          onClick={() => navigate('/subscription')}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Back to plans
        </button>
      </div>
    );
  }

  if (status === 'portal-return') {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Back from billing</h1>
        <p className="text-gray-600 mb-6">{isLoading ? 'Checking your plan...' : `Your current app plan is ${entitlement?.plan ?? 'being confirmed'}.`} Changes appear after Stripe confirms them.</p>
        <button
          onClick={() => navigate('/subscription')}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          View my plan
        </button>
      </div>
    );
  }

  // status === 'success' (or missing/unexpected — treat the same: verify before celebrating)
  const planChanged = !isLoading && entitlement && entitlement.plan !== initialPlan && entitlement.source === 'stripe';

  if (planChanged) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">You're subscribed!</h1>
        <p className="text-gray-600 mb-6">
          Your {entitlement.plan} plan is active. Ads are now disabled and your new goal limit applies immediately.
        </p>
        <button
          onClick={() => navigate('/goals')}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Go to my goals
        </button>
      </div>
    );
  }

  if (timedOut) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center">
        <Loader2 className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Still confirming...</h1>
        <p className="text-gray-600 mb-6">
          Payment confirmation is taking longer than usual. Your access hasn't changed yet — this page will keep
          checking automatically. If this doesn't resolve soon, contact support with your payment receipt.
        </p>
        <button
          onClick={() => navigate('/subscription')}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
        >
          Back to plans
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-16 px-4 text-center">
      <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirming your subscription...</h1>
      <p className="text-gray-600">
        This usually takes a few seconds. A redirect back from checkout isn't proof of payment on its own — we wait
        for verified confirmation before updating your access.
      </p>
    </div>
  );
}
