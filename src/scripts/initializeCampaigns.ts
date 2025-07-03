import { db } from '../config/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Campaign } from '../types';

const CAMPAIGNS_COLLECTION = 'campaigns';

// Initial sample campaigns
const initialCampaigns = [
  {
    id: 'campaign_google_ads_productivity',
    name: 'Google Ads - Productivity Tools',
    type: 'external' as const,
    url: 'https://ads.google.com/productivity-tools',
    description: 'Targeted ads for productivity and goal-setting tools',
    status: 'active' as const,
    clicks: 1250,
    revenue: 125.50
  },
  {
    id: 'campaign_taskmaster_pro',
    name: 'TaskMaster Pro - Our Premium Tool',
    type: 'internal' as const,
    url: 'https://taskmaster.pro',
    description: 'Promote our advanced task management software',
    status: 'active' as const,
    clicks: 890,
    revenue: 445.00
  },
  {
    id: 'campaign_amazon_books',
    name: 'Amazon Affiliate - Books',
    type: 'external' as const,
    url: 'https://amazon.com/productivity-books',
    description: 'Productivity and self-help book recommendations',
    status: 'active' as const,
    clicks: 567,
    revenue: 89.30
  },
  {
    id: 'campaign_focusflow_app',
    name: 'FocusFlow - Our Time Tracking App',
    type: 'internal' as const,
    url: 'https://focusflow.app',
    description: 'Advanced time tracking and analytics platform',
    status: 'paused' as const,
    clicks: 234,
    revenue: 156.80
  },
  {
    id: 'campaign_udemy_courses',
    name: 'Udemy Courses - Goal Setting',
    type: 'external' as const,
    url: 'https://udemy.com/goal-setting-courses',
    description: 'Online courses for personal development',
    status: 'active' as const,
    clicks: 789,
    revenue: 234.50
  }
];

export async function initializeCampaigns(): Promise<void> {
  try {
    console.log('🚀 [DEBUG] Initializing campaigns collection...');
    
    const campaignsCollection = collection(db, CAMPAIGNS_COLLECTION);
    
    for (const campaignData of initialCampaigns) {
      const now = new Date().toISOString();
      
      const campaign: Omit<Campaign, 'createdAt' | 'updatedAt'> & {
        createdAt: string;
        updatedAt: ReturnType<typeof serverTimestamp>;
      } = {
        ...campaignData,
        createdAt: now,
        updatedAt: serverTimestamp()
      };

      const campaignDoc = doc(campaignsCollection, campaignData.id);
      await setDoc(campaignDoc, campaign);
      
      console.log(`✅ [DEBUG] Created campaign: ${campaignData.name}`);
    }
    
    console.log('🎉 [DEBUG] Successfully initialized', initialCampaigns.length, 'campaigns');
  } catch (error) {
    console.error('❌ [DEBUG] Error initializing campaigns:', error);
    throw error;
  }
}

// Run the initialization if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeCampaigns()
    .then(() => {
      console.log('Campaign initialization completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Campaign initialization failed:', error);
      process.exit(1);
    });
}