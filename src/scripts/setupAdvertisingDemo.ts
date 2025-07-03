import { initializeAdvertisingWays } from './initializeAdvertisingWays-node';
import { createCampaign } from '../services/db-node';

// Sample campaigns for demo
const demoCampaigns = [
  {
    name: 'TaskMaster Pro - Upgrade Now!',
    type: 'internal' as const,
    url: 'https://taskmaster.pro/upgrade',
    description: 'Unlock unlimited goals and advanced features with TaskMaster Pro',
    status: 'active' as const,
    clicks: 0,
    revenue: 0
  },
  {
    name: 'Productivity Books - Amazon',
    type: 'external' as const,
    url: 'https://amazon.com/productivity-books',
    description: 'Discover the best productivity and goal-setting books',
    status: 'active' as const,
    clicks: 0,
    revenue: 0
  },
  {
    name: 'Focus Timer App',
    type: 'external' as const,
    url: 'https://focustimer.app',
    description: 'Advanced Pomodoro timer to boost your productivity',
    status: 'active' as const,
    clicks: 0,
    revenue: 0
  }
];

async function setupAdvertisingDemo() {
  console.log('🚀 Setting up advertising demo...\n');
  
  try {
    // 1. Initialize advertising ways
    console.log('1. Creating advertising ways...');
    await initializeAdvertisingWays();
    
    // 2. Create demo campaigns
    console.log('\n2. Creating demo campaigns...');
    for (const campaignData of demoCampaigns) {
      console.log(`Creating campaign: ${campaignData.name}`);
      const campaign = await createCampaign(campaignData);
      console.log(`✓ Created campaign: ${campaign.name} (ID: ${campaign.id})`);
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

// Run the setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupAdvertisingDemo()
    .then(() => {
      console.log('\n🎉 Demo setup completed! You can now test the advertising features.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Demo setup failed:', error);
      process.exit(1);
    });
}

export { setupAdvertisingDemo };