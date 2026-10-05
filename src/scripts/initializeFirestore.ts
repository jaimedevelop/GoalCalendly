import { Goal } from '../types';
import { importGoals } from '../services/goals';

// Function to initialize Firestore with sample data
export async function initializeFirestore(jsonFilePath?: string): Promise<void> {
  try {
    console.log('Initializing Firestore database...');
    
    if (jsonFilePath) {
      // Load data from JSON file
      try {
        const response = await fetch(jsonFilePath);
        if (!response.ok) {
          throw new Error(`Failed to fetch JSON file: ${response.statusText}`);
        }
        
        const jsonData = await response.json();
        
        if (!jsonData.goals || !Array.isArray(jsonData.goals)) {
          throw new Error('Invalid file format. File must contain a "goals" array.');
        }
        
        console.log(`Found ${jsonData.goals.length} goals in JSON file. Importing...`);
        
        const result = await importGoals(jsonData.goals);
        
        if (result.ok) {
          console.log(`Successfully imported ${jsonData.goals.length} goals to Firestore!`);
        } else {
          throw new Error(result.error?.message ?? 'Import failed');
        }
        
      } catch (error) {
        console.error('Error reading/parsing JSON file:', error);
        throw error;
      }
    } else {
      // Create sample data if no file provided
      const sampleGoals: Goal[] = [
        {
          id: 'sample-goal-1',
          name: 'Learn React',
          targetHours: 100,
          currentLevel: 1,
          startDate: new Date().toISOString(),
          totalTimeSpent: 15,
          weeklyTimeSpent: 5,
          weeklyGoal: 10,
          medals: ['first-week'],
          trophies: 1,
          practiceDays: [new Date().toISOString().split('T')[0]],
          settings: {
            frequency: 'weekly',
            target: {
              type: 'hours',
              value: 10
            },
            resources: [
              {
                type: 'tutorial',
                name: 'React Official Tutorial',
                url: 'https://react.dev/learn',
                completed: false
              }
            ],
            reminders: true,
            notifications: true
          },
          note: 'Sample goal for learning React',
          completed: false,
          weeklyTrophies: []
        },
        {
          id: 'sample-goal-2',
          name: 'Master TypeScript',
          targetHours: 80,
          currentLevel: 0,
          startDate: new Date().toISOString(),
          totalTimeSpent: 0,
          weeklyTimeSpent: 0,
          weeklyGoal: 8,
          medals: [],
          trophies: 0,
          practiceDays: [],
          settings: {
            frequency: 'weekly',
            target: {
              type: 'hours',
              value: 8
            },
            resources: [
              {
                type: 'book',
                name: 'TypeScript Handbook',
                url: 'https://www.typescriptlang.org/docs/',
                completed: false
              }
            ],
            reminders: false,
            notifications: false
          },
          note: 'Sample goal for mastering TypeScript',
          completed: false,
          weeklyTrophies: []
        }
      ];
      
      console.log('Creating sample goals...');
      const result = await importGoals(sampleGoals);
      
      if (result.ok) {
        console.log('Sample goals created successfully in Firestore!');
      } else {
        throw new Error(result.error?.message ?? 'Failed to create sample goals');
      }
    }
    
    console.log('Firestore initialization completed successfully!');
    
  } catch (error) {
    console.error('Error initializing Firestore:', error);
    throw error;
  }
}

// Browser-compatible initialization function
export async function initializeFirestoreInBrowser(jsonData?: { goals: Goal[] }): Promise<{ success: boolean; message: string }> {
  try {
    if (jsonData) {
      const result = await importGoals(jsonData.goals);
      
      if (result.ok) {
        return {
          success: true,
          message: `Successfully imported ${jsonData.goals.length} goals to Firestore!`
        };
      } else {
        return {
          success: false,
          message: `Import failed: ${result.error?.message ?? 'Unknown error'}`
        };
      }
    } else {
      // Initialize with empty state - let user add goals manually
      return {
        success: true,
        message: 'Firestore initialized successfully. You can now add goals manually.'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Initialization failed: ${error}`
    };
  }
}

// Run initialization if this file is executed directly
if (typeof window === 'undefined') {
  // This is running in Node.js environment
  const jsonFilePath = process.argv[2];
  
  initializeFirestore(jsonFilePath).then(() => {
    console.log('Initialization completed successfully!');
    process.exit(0);
  }).catch((error) => {
    console.error('Initialization failed:', error);
    process.exit(1);
  });
}
