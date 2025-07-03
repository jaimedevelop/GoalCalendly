import { createAdvertisingWay } from '../services/db';

// Sample advertising ways data
const sampleAdvertisingWays = [
  {
    name: 'Banner Notifications',
    description: 'Display banner ads at the top of the goals page with rotating campaigns',
    isActive: true,
    displayMethod: 'banner' as const,
    targetLocation: 'goals-page-header',
    frequency: 'every-visit' as const
  },
  {
    name: 'Modal Pop-ups',
    description: 'Show promotional modals when users complete goals or reach milestones',
    isActive: true,
    displayMethod: 'modal' as const,
    targetLocation: 'goal-completion',
    frequency: 'milestone-based' as const
  },
  {
    name: 'Sidebar Widgets',
    description: 'Embed advertising widgets in the sidebar with relevant product recommendations',
    isActive: false,
    displayMethod: 'widget' as const,
    targetLocation: 'sidebar',
    frequency: 'persistent' as const
  },
  {
    name: 'In-App Notifications',
    description: 'Send push-style notifications about premium features and external offers',
    isActive: true,
    displayMethod: 'notification' as const,
    targetLocation: 'notification-center',
    frequency: 'weekly' as const
  },
  {
    name: 'Goal Suggestion Ads',
    description: 'Integrate sponsored goal templates and productivity tool recommendations',
    isActive: false,
    displayMethod: 'suggestion' as const,
    targetLocation: 'new-goal-dialog',
    frequency: 'on-goal-creation' as const
  },
  {
    name: 'Footer Promotions',
    description: 'Display rotating promotional content in the footer area across all pages',
    isActive: true,
    displayMethod: 'footer' as const,
    targetLocation: 'page-footer',
    frequency: 'daily-rotation' as const
  }
];

async function initializeAdvertisingWays() {
  console.log('Starting advertising ways initialization...');
  
  try {
    for (const advertisingWayData of sampleAdvertisingWays) {
      console.log(`Creating advertising way: ${advertisingWayData.name}`);
      const advertisingWay = await createAdvertisingWay(advertisingWayData);
      console.log(`✓ Created advertising way: ${advertisingWay.name} (ID: ${advertisingWay.id})`);
    }
    
    console.log(`\n✅ Successfully initialized ${sampleAdvertisingWays.length} advertising ways!`);
    console.log('\nAdvertising ways created:');
    sampleAdvertisingWays.forEach((aw, index) => {
      console.log(`${index + 1}. ${aw.name} (${aw.displayMethod}) - ${aw.isActive ? 'Active' : 'Inactive'}`);
    });
    
  } catch (error) {
    console.error('❌ Error initializing advertising ways:', error);
    throw error;
  }
}

// Run the initialization if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeAdvertisingWays()
    .then(() => {
      console.log('\n🎉 Advertising ways initialization completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Advertising ways initialization failed:', error);
      process.exit(1);
    });
}

export { initializeAdvertisingWays, sampleAdvertisingWays };