import React, { useEffect, useState } from 'react';
import { AdvertisingDisplay } from './AdvertisingDisplay';
import { useStore, shouldShowAds } from '../store';

interface AdvertisingManagerProps {
  children: React.ReactNode;
}

export const AdvertisingManager: React.FC<AdvertisingManagerProps> = ({ children }) => {
  const { entitlement, isEntitlementLoading, activeTimer } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [modalShown, setModalShown] = useState(false);

  // Ad eligibility comes from the live, server-verified entitlement (never
  // the raw Firestore subscriptionPlan field, and never true while the
  // entitlement is still loading) — see shouldShowAds in store.ts and
  // admin_subscriptions.md section 7: paid access must hide ads immediately,
  // not only after the next sign-in.
  const showAds = shouldShowAds(entitlement, isEntitlementLoading);

  // Show modal popup for milestone-based advertising (simulate goal completion)
  useEffect(() => {
    if (showAds && !modalShown && !activeTimer.isRunning) {
      // Show modal after 5 seconds for demo purposes. Never interrupt a
      // running timer (admin_subscriptions.md section 3/7) — if a timer
      // starts before this fires, the cleanup below cancels it, and it is
      // not rescheduled until modalShown is reset (i.e. never automatically
      // retried mid-session, so it can't pop up right as a timer starts either).
      const timer = setTimeout(() => {
        setShowModal(true);
        setModalShown(true);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [showAds, modalShown, activeTimer.isRunning]);

  if (!showAds) {
    return <>{children}</>;
  }

  // Never show the modal while a timer is running, even if it was already
  // scheduled to appear in this render pass.
  const modalVisible = showModal && !activeTimer.isRunning;

  return (
    <>
      {/* Banner Advertisement - Top of page */}
      <AdvertisingDisplay
        displayMethod="banner"
        targetLocation="goals-page-header"
        className="sticky top-0 z-40"
      />

      {/* Main content */}
      <div className="relative">
        {children}
        
        {/* Sidebar Widget - Positioned absolutely */}
        <div className="fixed right-4 top-1/2 transform -translate-y-1/2 w-64 z-30">
          <AdvertisingDisplay
            displayMethod="widget"
            targetLocation="sidebar"
            className="mb-4"
          />
        </div>

        {/* Notification - Top right */}
        <div className="fixed top-20 right-4 w-80 z-30">
          <AdvertisingDisplay
            displayMethod="notification"
            targetLocation="notification-center"
            className="mb-2"
          />
        </div>
      </div>

      {/* Modal Advertisement — never rendered while a timer is running */}
      {modalVisible && (
        <AdvertisingDisplay
          displayMethod="modal"
          targetLocation="goal-completion"
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Footer Advertisement */}
      <AdvertisingDisplay
        displayMethod="footer"
        targetLocation="page-footer"
        className="fixed bottom-0 left-0 right-0 z-40"
      />
    </>
  );
};