import React, { useState } from 'react';
import { Goal } from '../types';
import { CheckCircle2, Circle } from 'lucide-react';

interface ImportTimeDialogProps {
  goals: Goal[];
  onConfirm: (goals: Goal[]) => void;
  onClose: () => void;
}

export function ImportTimeDialog({ goals, onConfirm, onClose }: ImportTimeDialogProps) {
  const [updatedGoals, setUpdatedGoals] = useState(goals.map(goal => ({
    ...goal,
    showCustomTime: false,
    newTotalTime: goal.totalTimeSpent.toString(),
    newWeeklyTime: goal.weeklyTimeSpent.toString()
  })));

  const handleConfirm = () => {
    const finalGoals = updatedGoals.map(goal => ({
      ...goal,
      totalTimeSpent: goal.showCustomTime ? parseFloat(goal.newTotalTime) : goal.totalTimeSpent,
      weeklyTimeSpent: goal.showCustomTime ? parseFloat(goal.newWeeklyTime) : goal.weeklyTimeSpent
    }));
    onConfirm(finalGoals);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Import Time Settings</h2>
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex items-center space-x-2">
            <Circle className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-600">Active</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-600">Completed</span>
          </div>
        </div>

        <div className="space-y-4">
          {updatedGoals.map((goal, index) => (
            <div 
              key={goal.id} 
              className={`border rounded-lg p-4 ${
                goal.completed 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {goal.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-blue-500" />
                  )}
                  <h3 className="font-semibold">{goal.name}</h3>
                </div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={goal.showCustomTime}
                    onChange={(e) => {
                      const newGoals = [...updatedGoals];
                      newGoals[index] = {
                        ...goal,
                        showCustomTime: e.target.checked
                      };
                      setUpdatedGoals(newGoals);
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Customize time</span>
                </label>
              </div>

              {goal.showCustomTime ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Total Time Spent (hours)
                    </label>
                    <input
                      type="number"
                      value={goal.newTotalTime}
                      onChange={(e) => {
                        const newGoals = [...updatedGoals];
                        newGoals[index] = {
                          ...goal,
                          newTotalTime: e.target.value
                        };
                        setUpdatedGoals(newGoals);
                      }}
                      step="0.1"
                      min="0"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Weekly Time Spent (hours)
                    </label>
                    <input
                      type="number"
                      value={goal.newWeeklyTime}
                      onChange={(e) => {
                        const newGoals = [...updatedGoals];
                        newGoals[index] = {
                          ...goal,
                          newWeeklyTime: e.target.value
                        };
                        setUpdatedGoals(newGoals);
                      }}
                      step="0.1"
                      min="0"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  <p>Total Time: {goal.totalTimeSpent.toFixed(1)} hours</p>
                  <p>Weekly Time: {goal.weeklyTimeSpent.toFixed(1)} hours</p>
                  {goal.completed && goal.completedDate && (
                    <p>Completed: {new Date(goal.completedDate).toLocaleDateString()}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600"
          >
            Import Goals
          </button>
        </div>
      </div>
    </div>
  );
}