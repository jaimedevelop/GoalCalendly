import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Star, Target, Gift } from 'lucide-react';
import { getAllAdvertisingWays, getAllCampaigns } from '../services/db';
import { AdvertisingWay, Campaign } from '../types';

interface AdvertisingDisplayProps {
  displayMethod: 'banner' | 'modal' | 'widget' | 'notification' | 'suggestion' | 'footer';
  targetLocation: string;
  onClose?: () => void;
  className?: string;
}

export const AdvertisingDisplay: React.FC<AdvertisingDisplayProps> = ({
  displayMethod,
  targetLocation,
  onClose,
  className = ''
}) => {
  const [advertisingWays, setAdvertisingWays] = useState<AdvertisingWay[]>([]);
  const [currentCampaign, setCurrentCampaign] = useState<Campaign | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdvertisingData();
  }, []);

  const loadAdvertisingData = async () => {
    try {
      setLoading(true);
      const [ways, campaignList] = await Promise.all([
        getAllAdvertisingWays(),
        getAllCampaigns()
      ]);

      // Filter active advertising ways that match the display method and target location
      const activeWays = ways.filter(way =>
        way.isActive &&
        way.displayMethod === displayMethod &&
        way.targetLocation === targetLocation
      );

      // Filter active campaigns
      const activeCampaigns = campaignList.filter(campaign => campaign.status === 'active');

      setAdvertisingWays(activeWays);

      // Select a random campaign to display
      if (activeCampaigns.length > 0) {
        const randomCampaign = activeCampaigns[Math.floor(Math.random() * activeCampaigns.length)];
        setCurrentCampaign(randomCampaign);
      }
    } catch (error) {
      console.error('Error loading advertising data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignClick = () => {
    if (currentCampaign) {
      // Track click (you could implement analytics here)
      console.log('Campaign clicked:', currentCampaign.name);
      window.open(currentCampaign.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  // Don't render if no active advertising ways for this location or no campaigns
  if (loading || !isVisible || advertisingWays.length === 0 || !currentCampaign) {
    return null;
  }

  // Render different display methods
  switch (displayMethod) {
    case 'banner':
      return (
        <div className={`bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 ${className}`}>
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6" />
              <div>
                <h3 className="font-semibold">{currentCampaign.name}</h3>
                <p className="text-sm opacity-90">{currentCampaign.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCampaignClick}
                className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 flex items-center gap-2"
              >
                Learn More
                <ExternalLink className="w-4 h-4" />
              </button>
              <button
                onClick={handleClose}
                className="text-white hover:text-gray-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      );

    case 'modal':
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <Gift className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Special Offer!</h3>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-2">{currentCampaign.name}</h4>
              <p className="text-gray-600 text-sm">{currentCampaign.description}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCampaignClick}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                Check it out
                <ExternalLink className="w-4 h-4" />
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      );

    case 'widget':
      return (
        <div className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm ${className}`}>
          <div className="flex items-start gap-3">
            <Star className="w-5 h-5 text-yellow-500 mt-1" />
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 text-sm mb-1">Recommended</h4>
              <h5 className="font-semibold text-gray-800 mb-2">{currentCampaign.name}</h5>
              <p className="text-xs text-gray-600 mb-3">{currentCampaign.description}</p>
              <button
                onClick={handleCampaignClick}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
              >
                Learn more
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      );

    case 'notification':
      return (
        <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium text-blue-900">{currentCampaign.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCampaignClick}
                className="text-blue-600 hover:text-blue-800 text-xs"
              >
                View
              </button>
              <button
                onClick={handleClose}
                className="text-blue-400 hover:text-blue-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      );

    case 'suggestion':
      return (
        <div className={`bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4 ${className}`}>
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-green-600 mt-1" />
            <div>
              <h4 className="font-medium text-gray-900 mb-1">Suggested for you</h4>
              <h5 className="font-semibold text-green-800 mb-2">{currentCampaign.name}</h5>
              <p className="text-sm text-gray-600 mb-3">{currentCampaign.description}</p>
              <button
                onClick={handleCampaignClick}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center gap-1"
              >
                Explore
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      );

    case 'footer':
      return (
        <div className={`bg-gray-800 text-white p-4 ${className}`}>
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gift className="w-5 h-5 text-yellow-400" />
              <div>
                <span className="font-medium">{currentCampaign.name}</span>
                <span className="text-gray-300 ml-2 text-sm">{currentCampaign.description}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCampaignClick}
                className="bg-yellow-500 text-gray-900 px-4 py-1 rounded font-medium hover:bg-yellow-400 text-sm flex items-center gap-1"
              >
                Check it out
                <ExternalLink className="w-3 h-3" />
              </button>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
};