import React, { useEffect, useState } from 'react';
import { AdvertisingDisplay } from './AdvertisingDisplay';
import { useStore } from '../store';

interface AdvertisingManagerProps {
  children: React.ReactNode;
}

export const AdvertisingManager: React.FC<AdvertisingManagerProps> = ({ children }) => {
  const { user } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [modalShown, setModalShown] = useState(false);

  // Check if user is free tier (not admin and has free subscription)
  const isFreeUser = user && user.subscriptionPlan === 'free' && user.email !== 'admin@admin.com';

  // Show modal popup for milestone-based advertising (simulate goal completion)
  useEffect(() => {
    if (isFreeUser && !modalShown) {
      // Show modal after 5 seconds for demo purposes
      const timer = setTimeout(() => {
        setShowModal(true);
        setModalShown(true);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isFreeUser, modalShown]);

  if (!isFreeUser) {
    return <>{children}</>;
  }

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

      {/* Modal Advertisement */}
      {showModal && (
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