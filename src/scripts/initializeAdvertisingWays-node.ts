import { createAdvertisingWay, getAllAdvertisingWays } from '../services/db-node';

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

export async function initializeAdvertisingWays(): Promise<void> {
  try {
    console.log('🎯 Initializing advertising ways...');
    
    // Check if advertising ways already exist
    const existingWays = await getAllAdvertisingWays();
    
    if (existingWays.length > 0) {
      console.log(`✓ Found ${existingWays.length} existing advertising ways. Skipping initialization.`);
      return;
    }
    
    // Create advertising ways
    for (const wayData of advertisingWaysData) {
      console.log(`Creating advertising way: ${wayData.name}`);
      const way = await createAdvertisingWay(wayData);
      console.log(`✓ Created: ${way.name} (ID: ${way.id})`);
    }
    
    console.log('✅ Advertising ways initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Error initializing advertising ways:', error);
    throw error;
  }
}