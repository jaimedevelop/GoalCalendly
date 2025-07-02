import React, { useState } from 'react';
import { Goal, GoalSettings, Resource } from '../types';
import { Settings, Plus, Trash2, Book, Video, GraduationCap, Code } from 'lucide-react';

interface SettingsDialogProps {
  goal: Goal;
  onClose: () => void;
  onUpdate: (settings: GoalSettings) => void;
}

export function SettingsDialog({ goal, onClose, onUpdate }: SettingsDialogProps) {
  const [settings, setSettings] = useState<GoalSettings>(goal.settings);
  const [newResource, setNewResource] = useState<Partial<Resource>>({
    type: 'book',
    name: '',
    completed: false
  });

  const handleSettingsChange = (key: keyof GoalSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleTargetChange = (key: keyof typeof settings.target, value: any) => {
    setSettings(prev => ({
      ...prev,
      target: { ...prev.target, [key]: value }
    }));
  };

  const addResource = () => {
    if (!newResource.name) return;
    
    setSettings(prev => ({
      ...prev,
      resources: [...prev.resources, newResource as Resource]
    }));
    setNewResource({ type: 'book', name: '', completed: false });
  };

  const removeResource = (index: number) => {
    setSettings(prev => ({
      ...prev,
      resources: prev.resources.filter((_, i) => i !== index)
    }));
  };

  const toggleResourceComplete = (index: number) => {
    setSettings(prev => ({
      ...prev,
      resources: prev.resources.map((resource, i) => 
        i === index ? { ...resource, completed: !resource.completed } : resource
      )
    }));
  };

  const getResourceIcon = (type: Resource['type']) => {
    switch (type) {
      case 'book': return <Book className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'tutorial': return <GraduationCap className="w-4 h-4" />;
      case 'course': return <GraduationCap className="w-4 h-4" />;
      case 'project': return <Code className="w-4 h-4" />;
      default: return <Book className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Goal Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* Frequency Settings */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Tracking Frequency</h3>
            <select
              value={settings.frequency}
              onChange={(e) => handleSettingsChange('frequency', e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Target Settings */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Target</h3>
            <div className="flex gap-4">
              <select
                value={settings.target.type}
                onChange={(e) => handleTargetChange('type', e.target.value)}
                className="w-1/2 p-2 border rounded-md"
              >
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
                <option value="books">Books</option>
                <option value="tutorials">Tutorials</option>
                <option value="videos">Videos</option>
              </select>
              <input
                type="number"
                value={settings.target.value}
                onChange={(e) => handleTargetChange('value', parseInt(e.target.value))}
                min="1"
                className="w-1/2 p-2 border rounded-md"
              />
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Resources</h3>
            
            {/* Add new resource */}
            <div className="flex gap-2">
              <select
                value={newResource.type}
                onChange={(e) => setNewResource({ ...newResource, type: e.target.value as Resource['type'] })}
                className="w-1/4 p-2 border rounded-md"
              >
                <option value="book">Book</option>
                <option value="tutorial">Tutorial</option>
                <option value="video">Video</option>
                <option value="course">Course</option>
                <option value="project">Project</option>
              </select>
              <input
                type="text"
                value={newResource.name}
                onChange={(e) => setNewResource({ ...newResource, name: e.target.value })}
                placeholder="Resource name"
                className="flex-1 p-2 border rounded-md"
              />
              <button
                onClick={addResource}
                className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Resource list */}
            <div className="space-y-2">
              {settings.resources.map((resource, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-md"
                >
                  <input
                    type="checkbox"
                    checked={resource.completed}
                    onChange={() => toggleResourceComplete(index)}
                    className="w-4 h-4"
                  />
                  <span className="flex items-center gap-2">
                    {getResourceIcon(resource.type)}
                    <span className={resource.completed ? 'line-through text-gray-500' : ''}>
                      {resource.name}
                    </span>
                  </span>
                  <button
                    onClick={() => removeResource(index)}
                    className="ml-auto p-1 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Notifications</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.reminders}
                  onChange={(e) => handleSettingsChange('reminders', e.target.checked)}
                  className="w-4 h-4"
                />
                Enable reminders
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.notifications}
                  onChange={(e) => handleSettingsChange('notifications', e.target.checked)}
                  className="w-4 h-4"
                />
                Enable notifications
              </label>
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end space-x-2 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onUpdate(settings);
                onClose();
              }}
              className="px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}