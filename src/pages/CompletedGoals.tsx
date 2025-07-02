import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useStore } from '../store';
import { format } from 'date-fns';

export function CompletedGoals() {
  const navigate = useNavigate();
  const { goals, updateGoal } = useStore();
  const completedGoals = goals.filter(g => g.completed);
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());

  const toggleGoalSelection = (goalId: string) => {
    const newSelection = new Set(selectedGoals);
    if (newSelection.has(goalId)) {
      newSelection.delete(goalId);
    } else {
      newSelection.add(goalId);
    }
    setSelectedGoals(newSelection);
  };

  const handleRestore = (goalId: string) => {
    if (window.confirm('Are you sure you want to restore this goal?')) {
      updateGoal(goalId, {
        completed: false,
        completedDate: undefined
      });
      // Clear the selected goals when restoring via icon
      setSelectedGoals(new Set());
    }
  };

  const handleRestoreSelected = () => {
    if (window.confirm(`Are you sure you want to restore ${selectedGoals.size} selected goals?`)) {
      selectedGoals.forEach(goalId => {
        updateGoal(goalId, {
          completed: false,
          completedDate: undefined
        });
      });
      setSelectedGoals(new Set());
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={() => navigate('/goals')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Goals
        </button>
        <h1 className="text-2xl font-bold">Completed Goals</h1>
      </div>

      {completedGoals.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">No completed goals yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                    checked={selectedGoals.size === completedGoals.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedGoals(new Set(completedGoals.map(g => g.id)));
                      } else {
                        setSelectedGoals(new Set());
                      }
                    }}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Goal Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Start Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completion Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Time Spent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {completedGoals.map((goal) => (
                <tr key={goal.id} className={selectedGoals.has(goal.id) ? 'bg-blue-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                      checked={selectedGoals.has(goal.id)}
                      onChange={() => toggleGoalSelection(goal.id)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{goal.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {format(new Date(goal.startDate), 'MMM d, yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {goal.completedDate && format(new Date(goal.completedDate), 'MMM d, yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {goal.totalTimeSpent.toFixed(1)} hours
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleRestore(goal.id)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Restore goal"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedGoals.size > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleRestoreSelected}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restore Selected ({selectedGoals.size})</span>
          </button>
        </div>
      )}
    </div>
  );
}