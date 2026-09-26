/**
 * Subscribes to the current user's server-owned entitlement state
 * (admin_subscriptions.md section 4/6, step 7-8).
 *
 * Reads `entitlements/{uid}` directly via onSnapshot rather than polling, so
 * plan labels and ad eligibility update live once the webhook/reconciliation
 * has written a new entitlement — no sign-out/sign-in required. Distinguishes
 * "no record yet" (a brand-new user before createFreeProfile's write lands,
 * or a real read error) from "confirmed Free" so callers don't misreport a
 * transient loading state as a downgrade.
 */
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import type { Entitlement } from '../types.js';

export interface SubscriptionState {
  entitlement: Entitlement | null;
  /** True until the first snapshot (from cache or server) has been received. */
  isLoading: boolean;
  /** Set when the live listener reports an error (e.g. offline); the last known entitlement is kept. */
  error: string | null;
}

export function useSubscription(uid: string | null): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>({ entitlement: null, isLoading: true, error: null });

  useEffect(() => {
    if (!uid) {
      setState({ entitlement: null, isLoading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    const unsubscribe = onSnapshot(
      doc(db, 'entitlements', uid),
      (snapshot) => {
        setState({
          entitlement: snapshot.exists() ? (snapshot.data() as Entitlement) : null,
          isLoading: false,
          error: null,
        });
      },
      (error) => {
        // Keep the last known entitlement on a transient read error rather
        // than treating it as a confirmed downgrade (admin_subscriptions.md
        // section 7: "Do not interpret a temporary entitlement-read error as
        // a confirmed downgrade").
        console.error('Error listening to entitlement:', error);
        setState((prev) => ({ ...prev, isLoading: false, error: error.message }));
      }
    );

    return () => unsubscribe();
  }, [uid]);

  return state;
}
