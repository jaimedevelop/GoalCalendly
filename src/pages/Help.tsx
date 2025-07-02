import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Download, Upload, Share2, Settings, CheckSquare, Save, Crown, Layout } from 'lucide-react';

export function Help() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <button
          onClick={() => navigate('/goals')}
          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Goals</span>
        </button>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Help & Guide</h1>
        <p className="text-gray-600">Learn how to use Goal Calendly effectively</p>
      </div>

      <div className="space-y-8">
        {/* Goals Overview */}
        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
            <Plus className="w-6 h-6 mr-2 text-blue-500" />
            Goals
          </h2>
          <p className="text-gray-700 mb-4">
            Goals are the core of Goal Calendly. Each goal represents a task or objective you want to accomplish with time tracking capabilities.
          </p>
          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="font-medium text-gray-900 mb-2">Creating Goals:</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              <li>Click the "+ Goal" button to create a new goal</li>
              <li>Set a title, description, and weekly time target</li>
              <li>Choose colors and customize settings</li>
              <li>Start tracking time immediately</li>
            </ul>
          </div>
        </section>

        {/* Views Section */}
        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
            <Layout className="w-6 h-6 mr-2 text-blue-500" />
            Views
          </h2>
          <p className="text-gray-700 mb-4">
            Choose how you want to display your goals with different view options:
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="font-medium text-gray-900 mb-2">Views (Top View)</h3>
              <p className="text-gray-700 text-sm">Single column layout showing goals vertically, perfect for focused work.</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="font-medium text-gray-900 mb-2">Double View</h3>
              <p className="text-gray-700 text-sm">Two-column grid layout for better space utilization on larger screens.</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="font-medium text-gray-900 mb-2">Three View</h3>
              <p className="text-gray-700 text-sm">Three-column grid layout for maximum goal visibility at once.</p>
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Action Buttons</h2>
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Import/Export */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Upload className="w-5 h-5 text-green-500 mt-1" />
                <div>
                  <h3 className="font-medium text-gray-900">Import</h3>
                  <p className="text-gray-700 text-sm">Upload a JSON file to import goals from another device or backup.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Download className="w-5 h-5 text-green-500 mt-1" />
                <div>
                  <h3 className="font-medium text-gray-900">Export</h3>
                  <p className="text-gray-700 text-sm">Download your goals as a JSON file for backup or transfer to another device.</p>
                </div>
              </div>
            </div>

            {/* Save/Share */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Save className="w-5 h-5 text-yellow-500 mt-1" />
                <div>
                  <h3 className="font-medium text-gray-900">Save</h3>
                  <p className="text-gray-700 text-sm">Manually save your goals to Firestore cloud database (auto-saves are also enabled).</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Share2 className="w-5 h-5 text-purple-500 mt-1" />
                <div>
                  <h3 className="font-medium text-gray-900">Share</h3>
                  <p className="text-gray-700 text-sm">Generate a shareable link to let others view your goals (read-only).</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <CheckSquare className="w-5 h-5 text-orange-500 mt-1" />
                <div>
                  <h3 className="font-medium text-gray-900">Completed</h3>
                  <p className="text-gray-700 text-sm">View all your completed goals and their achievement history.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Settings className="w-5 h-5 text-gray-500 mt-1" />
                <div>
                  <h3 className="font-medium text-gray-900">Settings</h3>
                  <p className="text-gray-700 text-sm">Configure default settings for new goals, including time targets and preferences.</p>
                </div>
              </div>
            </div>

            {/* Subscription */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Crown className="w-5 h-5 text-purple-500 mt-1" />
                <div>
                  <h3 className="font-medium text-gray-900">Plan</h3>
                  <p className="text-gray-700 text-sm">View and manage your subscription plan. Upgrade for more goals and features.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Subscription Plans */}
        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
            <Crown className="w-6 h-6 mr-2 text-purple-500" />
            Subscription Plans
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="font-medium text-gray-900 mb-2">Free</h3>
              <p className="text-gray-700 text-sm mb-2">Perfect for getting started</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Up to 3 goals</li>
                <li>• Basic time tracking</li>
                <li>• Cloud sync</li>
              </ul>
            </div>
            <div className="bg-blue-50 p-4 rounded-md">
              <h3 className="font-medium text-gray-900 mb-2">Pro - $3.50</h3>
              <p className="text-gray-700 text-sm mb-2">For serious goal achievers</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Up to 15 goals</li>
                <li>• Advanced features</li>
                <li>• Priority support</li>
              </ul>
            </div>
            <div className="bg-purple-50 p-4 rounded-md">
              <h3 className="font-medium text-gray-900 mb-2">Platinum - $9.50</h3>
              <p className="text-gray-700 text-sm mb-2">For power users</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Up to 30 goals</li>
                <li>• Premium features</li>
                <li>• Premium support</li>
              </ul>
            </div>
            <div className="bg-yellow-50 p-4 rounded-md">
              <h3 className="font-medium text-gray-900 mb-2">Enterprise</h3>
              <p className="text-gray-700 text-sm mb-2">For teams and organizations</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Unlimited goals</li>
                <li>• Custom features</li>
                <li>• Contact us for pricing</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Time Tracking */}
        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Time Tracking</h2>
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="font-medium text-gray-900 mb-2">How it works:</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Click the play button on any goal to start tracking time</li>
                <li>The timer will run in the background even if you navigate away</li>
                <li>Click stop to end the session and log the time</li>
                <li>View your progress towards weekly targets</li>
                <li>All time data is automatically saved to the cloud</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Tips & Best Practices */}
        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Tips & Best Practices</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Goal Setting:</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1 text-sm">
                <li>Set realistic weekly time targets</li>
                <li>Use descriptive titles and descriptions</li>
                <li>Break large goals into smaller ones</li>
                <li>Review and adjust targets regularly</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Time Management:</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1 text-sm">
                <li>Track time consistently for accurate data</li>
                <li>Use the timer for focused work sessions</li>
                <li>Review completed goals for insights</li>
                <li>Export data regularly for backup</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}