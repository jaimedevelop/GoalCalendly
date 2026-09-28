import React, { useState, useRef, useEffect } from 'react';
import { Plus, Download, Upload, Share2, Settings, CheckSquare, Layout, Crown, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { GoalCard } from '../components/GoalCard';
import { ActiveTimer } from '../components/ActiveTimer';
import { NewGoalDialog } from '../components/NewGoalDialog';
import { ShareDialog } from '../components/ShareDialog';
import { ImportTimeDialog } from '../components/ImportTimeDialog';
import { getSharedGoals } from '../services/db';
import { importGoals } from '../services/goals.js';
import { Goal, SUBSCRIPTION_PLANS } from '../types';

type ViewType = 'top' | 'double' | 'all';

export function Goals() {
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [importedGoals, setImportedGoals] = useState<Goal[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const { saveGoals, lastGoalError } = useStore();
  const [viewType, setViewType] = useState<ViewType>('top');
  const { goals, setGoals, defaultSettings, user, activeTimer } = useStore();
  const activeGoals = goals
    .filter(g => !g.completed)
    .sort((a, b) => {
      if (activeTimer.isRunning && activeTimer.goalId) {
        if (a.id === activeTimer.goalId) return -1;
        if (b.id === activeTimer.goalId) return 1;
      }
      return (b.lastTimerStartedAt ?? 0) - (a.lastTimerStartedAt ?? 0);
    });
  const importFileRef = useRef<HTMLInputElement>(null);
  const activeGoalRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const firstGoalId = activeGoals[0]?.id;

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      if (await saveGoals()) setSaveMessage('Goals saved.');
    } finally {
      setSaving(false);
    }
  };
  useEffect(() => { setSaveMessage(null); }, [goals]);

  useEffect(() => {
    if (activeTimer.isRunning && activeTimer.goalId) {
      const frame = requestAnimationFrame(() => {
        activeGoalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [activeTimer.isRunning, activeTimer.goalId, activeTimer.startTime, viewType, firstGoalId]);

  // Check subscription limits from the live, server-verified entitlement
  // rather than the raw Firestore subscriptionPlan field, so a plan change
  // (upgrade or admin grant) is reflected immediately, not just after the
  // next sign-in. Falls back to the legacy field's limit only while the
  // entitlement hasn't loaded yet, to avoid flashing "at limit" incorrectly.
  const { entitlement, isEntitlementLoading } = useStore();
  const fallbackPlan = user ? SUBSCRIPTION_PLANS[user.subscriptionPlan] : null;
  const maxGoals = !isEntitlementLoading && entitlement ? entitlement.maxActiveGoals : fallbackPlan?.maxGoals ?? -1;
  const planLabel = !isEntitlementLoading && entitlement ? entitlement.plan : user?.subscriptionPlan;
  // Admin users have unlimited goals
  const isAdmin = user?.isTrustedAdmin ?? false;
  const canAddGoal = isAdmin || maxGoals === -1 || activeGoals.length < maxGoals;
  const isAtLimit = !isAdmin && maxGoals !== -1 && activeGoals.length >= maxGoals;

  // Goals are loaded once app-wide on sign-in (see App.tsx) so every route
  // sees an accurate active-goal count; this effect only handles the
  // share-link download flow.
  useEffect(() => {
    // Handle share URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    
    if (shareId) {
      getSharedGoals(shareId).then((sharedGoals) => {
        if (sharedGoals) {
          const fileName = `goal-calendly-export-${new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')}.json`;
          const jsonString = JSON.stringify({ goals: sharedGoals, exportDate: new Date().toISOString(), version: '1.0' }, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          window.history.replaceState({}, '', window.location.pathname);
        }
      });
    }
  }, []);

  const handleExport = () => {
    const exportData = {
      goals,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    const fileName = `goal-calendly-export-${new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')}.json`;
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);
        if (importedData.goals && Array.isArray(importedData.goals)) {
          const shouldApplyDefaults = window.confirm(
            'Would you like to apply your current default settings to the imported goals?'
          );

          const goalsWithDefaults = importedData.goals.map((goal: Goal) => ({
            ...goal,
            settings: shouldApplyDefaults ? {
              ...goal.settings,
              ...defaultSettings,
            } : goal.settings,
            weeklyGoal: shouldApplyDefaults ? defaultSettings.target.value : goal.weeklyGoal,
          }));

          setImportedGoals(goalsWithDefaults);
        }
      } catch (error) {
        console.error('Error importing goals:', error);
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
    if (importFileRef.current) {
      importFileRef.current.value = '';
    }
  };

  const handleImportConfirm = async (finalGoals: Goal[]) => {
    setImportError(null);
    // The server validates the whole batch against the active-goal limit
    // atomically; an import that would exceed it is rejected outright rather
    // than silently dropping goals or letting the client's count decide.
    const result = await importGoals(finalGoals);
    if (result.ok) {
      setGoals([...goals, ...finalGoals]);
      setImportedGoals(null);
    } else {
      setImportError(result.error?.message ?? 'Could not import these goals. You may be at your active goal limit.');
    }
  };

  const getLayoutClassName = () => {
    switch (viewType) {
      case 'double':
        return 'grid grid-cols-1 md:grid-cols-2 gap-6';
      case 'all':
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
      default:
        return 'space-y-6';
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">Goal Calendly</h1>
        
        {/* Top row: Views dropdown and Add Goal button */}
        <div className="flex justify-center items-center gap-4 mb-4">
          <div className="relative">
            <select
              value={viewType}
              onChange={(e) => setViewType(e.target.value as ViewType)}
              className="appearance-none bg-blue-500 text-white px-4 py-2 pr-8 rounded-md hover:bg-blue-600 cursor-pointer"
            >
              <option value="top">Views</option>
              <option value="double">Double View</option>
              <option value="all">Three View</option>
            </select>
            <Layout className="w-4 h-4 text-white absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
          </div>
          <button
            onClick={() => {
              if (canAddGoal) {
                setShowNewGoal(true);
              } else {
                alert(`You've reached your goal limit (${maxGoals}). Upgrade your plan to create more goals.`);
                navigate('/subscription');
              }
            }}
            className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-md ${
              canAddGoal
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-400 text-white cursor-not-allowed'
            }`}
            title={isAtLimit ? `Goal limit reached (${maxGoals})` : 'Add new goal'}
          >
            <Plus className="w-5 h-5" />
            <span>Goal</span>
          </button>
        </div>

        {/* Bottom row: All other action buttons */}
        <div className="flex flex-wrap justify-center items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || goals.length === 0}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            title="Save Goals"
          >
            <Save className="w-5 h-5" />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
          <input
            type="file"
            ref={importFileRef}
            onChange={handleImport}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => importFileRef.current?.click()}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            title="Import Goals"
          >
            <Upload className="w-5 h-5" />
            <span>Import</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            title="Export Goals"
          >
            <Download className="w-5 h-5" />
            <span>Export</span>
          </button>
          <button
            onClick={() => setShowShareDialog(true)}
            disabled={goals.length === 0}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
            title="Share Goals"
          >
            <Share2 className="w-5 h-5" />
            <span>Share</span>
          </button>
          <button
            onClick={() => navigate('/completed')}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
            title="Completed Goals"
          >
            <CheckSquare className="w-5 h-5" />
            <span>Completed</span>
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>
          <button
            onClick={() => navigate('/subscription')}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
            title="Subscription Plan"
          >
            <Crown className="w-5 h-5" />
            <span>Plan</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              title="Admin Dashboard"
            >
              <Crown className="w-5 h-5" />
              <span>Admin</span>
            </button>
          )}
        </div>
      </div>

      <p className="mb-4 text-center text-sm text-gray-500">
        Changes save automatically. Timer progress saves when you stop. Use Save to save again.
      </p>
      {saveMessage && <p role="status" className="mb-4 text-center text-sm text-green-700">{saveMessage}</p>}
      {lastGoalError && <p role="alert" className="mb-4 text-center text-sm text-red-700">{lastGoalError}</p>}
      {importError && (
        <div className="max-w-4xl mx-auto mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {importError}
          </div>
        </div>
      )}

      {/* Subscription limit warning */}
      {isAtLimit && (
        <div className="max-w-4xl mx-auto mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <Crown className="w-5 h-5 text-yellow-600 mr-2" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-800">
                  Goal Limit Reached
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  You've reached your {planLabel} plan limit of {maxGoals} goals.
                  <button
                    onClick={() => navigate('/subscription')}
                    className="ml-1 underline hover:no-underline font-medium"
                  >
                    Upgrade your plan
                  </button> to create more goals.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={getLayoutClassName()}>
        {activeGoals.map((goal) => (
          <div
            key={goal.id}
            ref={goal.id === activeTimer.goalId && activeTimer.isRunning ? activeGoalRef : undefined}
          >
            <GoalCard goal={goal} viewType={viewType} />
          </div>
        ))}
      </div>

      {activeGoals.length === 0 && (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-600">
            No active goals yet. Create your first goal to get started!
          </h2>
        </div>
      )}

      {showNewGoal && <NewGoalDialog onClose={() => setShowNewGoal(false)} />}
      {showShareDialog && <ShareDialog onClose={() => setShowShareDialog(false)} goals={goals} />}
      {importedGoals && (
        <ImportTimeDialog
          goals={importedGoals}
          onConfirm={handleImportConfirm}
          onClose={() => setImportedGoals(null)}
        />
      )}
      <ActiveTimer />
    </div>
  );
}
