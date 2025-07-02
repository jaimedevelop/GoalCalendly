import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useStore } from '../store';

export function Settings() {
  const navigate = useNavigate();
  const { defaultSettings, updateDefaultSettings } = useStore();

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <button
          onClick={() => navigate('/goals')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Goals
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6">Global Settings</h1>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Default Goal Settings</h3>
            <p className="text-gray-600 text-sm">
              These settings will be applied to all new goals you create.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Tracking Frequency
              </label>
              <select
                value={defaultSettings.frequency}
                onChange={(e) => updateDefaultSettings({ frequency: e.target.value })}
                className="w-full p-2 border rounded-md"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Target Type
              </label>
              <select
                value={defaultSettings.target.type}
                onChange={(e) => updateDefaultSettings({ target: { ...defaultSettings.target, type: e.target.value } })}
                className="w-full p-2 border rounded-md"
              >
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
                <option value="books">Books</option>
                <option value="tutorials">Tutorials</option>
                <option value="videos">Videos</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Target Value
              </label>
              <input
                type="number"
                value={defaultSettings.target.value}
                onChange={(e) => updateDefaultSettings({ target: { ...defaultSettings.target, value: parseInt(e.target.value) } })}
                min="1"
                className="w-full p-2 border rounded-md"
              />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Notifications</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={defaultSettings.reminders}
                  onChange={(e) => updateDefaultSettings({ reminders: e.target.checked })}
                  className="w-4 h-4"
                />
                Enable reminders by default
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={defaultSettings.notifications}
                  onChange={(e) => updateDefaultSettings({ notifications: e.target.checked })}
                  className="w-4 h-4"
                />
                Enable notifications by default
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}