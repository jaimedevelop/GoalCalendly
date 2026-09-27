/**
 * Subscribes to the current user's owner-readable billing summary
 * (admin_subscriptions.md section 6/8, step 8: payment-warning messaging).
 *
 * Reads `billingSummaries/{uid}` — the projection written alongside
 * `billingCustomers` by functions/src/billing/syncSubscription.ts, carrying
 * no internal Stripe IDs. `billingCustomers` itself is backend-only.
 */
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import type { BillingSummary } from '../types.js';

export interface BillingSummaryState {
  summary: BillingSummary | null;
  isLoading: boolean;
}

export function useBillingSummary(uid: string | null): BillingSummaryState {
  const [state, setState] = useState<BillingSummaryState>({ summary: null, isLoading: true });

  useEffect(() => {
    if (!uid) {
      setState({ summary: null, isLoading: false });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    const unsubscribe = onSnapshot(
      doc(db, 'billingSummaries', uid),
      (snapshot) => {
        setState({ summary: snapshot.exists() ? (snapshot.data() as BillingSummary) : null, isLoading: false });
      },
      (error) => {
        console.error('Error listening to billing summary:', error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    );

    return () => unsubscribe();
  }, [uid]);

  return state;
}
