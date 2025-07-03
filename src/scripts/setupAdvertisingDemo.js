import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, Timestamp } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const advertisingWaysData = [
  {
    name: 'Banner Advertisement',
    description: 'Display banner ads at the top of pages for maximum visibility',
    isActive: true,
    displayMethod: 'banner',
    targetLocation: 'top-of-page',
    frequency: 'always'
  },
  {
    name: 'Modal Pop-up',
    description: 'Show promotional modals after user milestones or time-based triggers',
    isActive: true,
    displayMethod: 'modal',
    targetLocation: 'center-screen',
    frequency: 'milestone-based'
  },
  {
    name: 'Sidebar Widget',
    description: 'Persistent sidebar widgets with relevant offers and promotions',
    isActive: true,
    displayMethod: 'widget',
    targetLocation: 'sidebar-right',
    frequency: 'always'
  },
  {
    name: 'Notification Style',
    description: 'Non-intrusive notification-style ads in the corner',
    isActive: true,
    displayMethod: 'notification',
    targetLocation: 'top-right-corner',
    frequency: 'periodic'
  },
  {
    name: 'In-Context Suggestions',
    description: 'Contextual suggestions within user workflows and forms',
    isActive: true,
    displayMethod: 'suggestion',
    targetLocation: 'inline-content',
    frequency: 'contextual'
  },
  {
    name: 'Footer Promotion',
    description: 'Promotional content in the footer area of pages',
    isActive: true,
    displayMethod: 'footer',
    targetLocation: 'page-footer',
    frequency: 'always'
  }
];

const demoCampaigns = [
  {
    name: 'TaskMaster Pro - Upgrade Now!',
    type: 'internal',
    url: 'https://taskmaster.pro/upgrade',
    description: 'Unlock unlimited goals and advanced features with TaskMaster Pro',
    status: 'active',
    clicks: 0,
    revenue: 0
  },
  {
    name: 'Productivity Books - Amazon',
    type: 'external',
    url: 'https://amazon.com/productivity-books',
    description: 'Discover the best productivity and goal-setting books',
    status: 'active',
    clicks: 0,
    revenue: 0
  },
  {
    name: 'Focus Timer App',
    type: 'external',
    url: 'https://focustimer.app',
    description: 'Advanced Pomodoro timer to boost your productivity',
    status: 'active',
    clicks: 0,
    revenue: 0
  }
];

async function setupAdvertisingDemo() {
  console.log('🚀 Setting up advertising demo...\n');
  
  try {
    // 1. Initialize advertising ways
    console.log('1. Creating advertising ways...');
    const advertisingWaysRef = collection(db, 'advertisingWays');
    const existingWays = await getDocs(advertisingWaysRef);
    
    if (existingWays.size > 0) {
      console.log(`✓ Found ${existingWays.size} existing advertising ways. Skipping initialization.`);
    } else {
      for (const wayData of advertisingWaysData) {
        console.log(`Creating advertising way: ${wayData.name}`);
        const now = Timestamp.now();
        await addDoc(advertisingWaysRef, {
          ...wayData,
          createdAt: now,
          updatedAt: now
        });
        console.log(`✓ Created: ${wayData.name}`);
      }
    }
    
    // 2. Create demo campaigns
    console.log('\n2. Creating demo campaigns...');
    const campaignsRef = collection(db, 'campaigns');
    const existingCampaigns = await getDocs(campaignsRef);
    
    if (existingCampaigns.size > 0) {
      console.log(`✓ Found ${existingCampaigns.size} existing campaigns. Skipping initialization.`);
    } else {
      for (const campaignData of demoCampaigns) {
        console.log(`Creating campaign: ${campaignData.name}`);
        const now = Timestamp.now();
        await addDoc(campaignsRef, {
          ...campaignData,
          createdAt: now,
          updatedAt: now
        });
        console.log(`✓ Created campaign: ${campaignData.name}`);
      }
    }
    
    console.log('\n✅ Advertising demo setup completed successfully!');
    console.log('\n📋 What was created:');
    console.log('• 6 advertising presentation methods (banner, modal, widget, notification, suggestion, footer)');
    console.log('• 3 demo advertising campaigns');
    console.log('\n🎯 How to test:');
    console.log('1. Login as admin (admin@admin.com) to manage advertising in the Admin Dashboard');
    console.log('2. Login as a free user to see the advertisements in action');
    console.log('3. Free users will see:');
    console.log('   - Banner ads at the top of the page');
    console.log('   - Sidebar widgets on the right');
    console.log('   - Notification in the top-right corner');
    console.log('   - Modal popup after 5 seconds');
    console.log('   - Footer ads at the bottom');
    console.log('   - Suggestion ads when creating new goals');
    
  } catch (error) {
    console.error('❌ Error setting up advertising demo:', error);
    throw error;
  }
}

setupAdvertisingDemo()
  .then(() => {
    console.log('\n🎉 Demo setup completed! You can now test the advertising features.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Demo setup failed:', error);
    process.exit(1);
  });