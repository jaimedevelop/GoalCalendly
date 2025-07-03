import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  Crown,
  Star,
  ArrowLeft,
  Settings,
  ExternalLink,
  Globe,
  Target,
  Plus,
  Edit,
  Save,
  X
} from 'lucide-react';
import { UserProfile, SubscriptionPlan, SUBSCRIPTION_PLANS, Campaign, AdvertisingWay } from '../types.js';
import {
  getAllUsers,
  deleteUser,
  toggleUserStatus,
  updateUserSubscription
} from '../services/user.js';
import {
  getGoalsCountByUser,
  getAllCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getAllAdvertisingWays,
  createAdvertisingWay,
  updateAdvertisingWay,
  deleteAdvertisingWay
} from '../services/db.js';

// Sample campaigns data for initialization
const sampleCampaigns = [
  {
    name: 'Google Ads - Productivity Tools',
    type: 'external' as const,
    url: 'https://ads.google.com/productivity-tools',
    description: 'Targeted ads for productivity and goal-setting tools',
    status: 'active' as const,
    clicks: 1250,
    revenue: 125.50
  },
  {
    name: 'TaskMaster Pro - Our Premium Tool',
    type: 'internal' as const,
    url: 'https://taskmaster.pro',
    description: 'Promote our advanced task management software',
    status: 'active' as const,
    clicks: 890,
    revenue: 445.00
  },
  {
    name: 'Amazon Affiliate - Books',
    type: 'external' as const,
    url: 'https://amazon.com/productivity-books',
    description: 'Productivity and self-help book recommendations',
    status: 'active' as const,
    clicks: 567,
    revenue: 89.30
  },
  {
    name: 'FocusFlow - Our Time Tracking App',
    type: 'internal' as const,
    url: 'https://focusflow.app',
    description: 'Advanced time tracking and analytics platform',
    status: 'paused' as const,
    clicks: 234,
    revenue: 156.80
  },
  {
    name: 'Udemy Courses - Goal Setting',
    type: 'external' as const,
    url: 'https://udemy.com/goal-setting-courses',
    description: 'Online courses for personal development',
    status: 'active' as const,
    clicks: 789,
    revenue: 234.50
  }
];

// Sample advertising ways data for initialization
const sampleAdvertisingWays = [
  {
    name: 'Banner Notifications',
    description: 'Display banner ads at the top of the goals page with rotating campaigns',
    isActive: true,
    displayMethod: 'banner',
    targetLocation: 'goals-page-header',
    frequency: 'every-visit'
  },
  {
    name: 'Modal Pop-ups',
    description: 'Show promotional modals when users complete goals or reach milestones',
    isActive: true,
    displayMethod: 'modal',
    targetLocation: 'goal-completion',
    frequency: 'milestone-based'
  },
  {
    name: 'Sidebar Widgets',
    description: 'Embed advertising widgets in the sidebar with relevant product recommendations',
    isActive: false,
    displayMethod: 'widget',
    targetLocation: 'sidebar',
    frequency: 'persistent'
  },
  {
    name: 'In-App Notifications',
    description: 'Send push-style notifications about premium features and external offers',
    isActive: true,
    displayMethod: 'notification',
    targetLocation: 'notification-center',
    frequency: 'weekly'
  },
  {
    name: 'Goal Suggestion Ads',
    description: 'Integrate sponsored goal templates and productivity tool recommendations',
    isActive: false,
    displayMethod: 'suggestion',
    targetLocation: 'new-goal-dialog',
    frequency: 'on-goal-creation'
  },
  {
    name: 'Footer Promotions',
    description: 'Display rotating promotional content in the footer area across all pages',
    isActive: true,
    displayMethod: 'footer',
    targetLocation: 'page-footer',
    frequency: 'daily-rotation'
  }
];

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [advertisingWays, setAdvertisingWays] = useState<AdvertisingWay[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [advertisingWaysLoading, setAdvertisingWaysLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goalsByUser, setGoalsByUser] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'users' | 'advertising' | 'advertisingWays'>('users');
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [showAdvertisingWayForm, setShowAdvertisingWayForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editingAdvertisingWay, setEditingAdvertisingWay] = useState<AdvertisingWay | null>(null);
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    type: 'external' as 'internal' | 'external',
    url: '',
    description: '',
    status: 'active' as 'active' | 'paused',
    clicks: 0,
    revenue: 0
  });

  const [advertisingWayForm, setAdvertisingWayForm] = useState({
    name: '',
    description: '',
    isActive: true,
    displayMethod: 'banner' as 'banner' | 'modal' | 'widget' | 'notification' | 'suggestion' | 'footer',
    targetLocation: '',
    frequency: 'every-visit' as 'every-visit' | 'daily-rotation' | 'weekly' | 'milestone-based' | 'on-goal-creation' | 'persistent'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'advertising') {
      loadCampaigns();
    } else if (activeTab === 'advertisingWays') {
      loadAdvertisingWays();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const allUsers = await getAllUsers();
      setUsers(allUsers);
      
      try {
        const goalsCount = await getGoalsCountByUser();
        setGoalsByUser(goalsCount);
        console.log('[DEBUG] AdminDashboard: Successfully loaded goal counts');
      } catch (goalError) {
        console.warn('[DEBUG] AdminDashboard: Failed to load goal counts, continuing without them:', goalError);
        setGoalsByUser({});
      }
    } catch (err) {
      setError('Failed to load users');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = async () => {
    try {
      setCampaignsLoading(true);
      setError(null);
      console.log('[DEBUG] AdminDashboard: Loading campaigns from Firestore');
      
      const allCampaigns = await getAllCampaigns();
      setCampaigns(allCampaigns);
      console.log('[DEBUG] AdminDashboard: Loaded', allCampaigns.length, 'campaigns');
    } catch (err) {
      console.error('Error loading campaigns:', err);
      setError('Failed to load campaigns');
      setCampaigns([]);
    } finally {
      setCampaignsLoading(false);
    }
  };

  const loadAdvertisingWays = async () => {
    try {
      setAdvertisingWaysLoading(true);
      setError(null);
      console.log('[DEBUG] AdminDashboard: Loading advertising ways from Firestore');
      
      const allAdvertisingWays = await getAllAdvertisingWays();
      setAdvertisingWays(allAdvertisingWays);
      console.log('[DEBUG] AdminDashboard: Loaded', allAdvertisingWays.length, 'advertising ways');
    } catch (err) {
      console.error('Error loading advertising ways:', err);
      setError('Failed to load advertising ways');
      setAdvertisingWays([]);
    } finally {
      setAdvertisingWaysLoading(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteUser(uid);
      setUsers(users.filter(user => user.uid !== uid));
    } catch (err) {
      setError('Failed to delete user');
      console.error('Error deleting user:', err);
    }
  };

  const handleToggleUserStatus = async (uid: string, currentStatus: boolean) => {
    try {
      await toggleUserStatus(uid, !currentStatus);
      setUsers(users.map(user => 
        user.uid === uid ? { ...user, isActive: !currentStatus } : user
      ));
    } catch (err) {
      setError('Failed to update user status');
      console.error('Error updating user status:', err);
    }
  };

  const handleUpdateSubscription = async (uid: string, plan: SubscriptionPlan) => {
    try {
      await updateUserSubscription(uid, plan);
      setUsers(users.map(user => 
        user.uid === uid ? { ...user, subscriptionPlan: plan } : user
      ));
    } catch (err) {
      setError('Failed to update subscription');
      console.error('Error updating subscription:', err);
    }
  };

  const resetCampaignForm = () => {
    setCampaignForm({
      name: '',
      type: 'external',
      url: '',
      description: '',
      status: 'active',
      clicks: 0,
      revenue: 0
    });
    setEditingCampaign(null);
    setShowCampaignForm(false);
  };

  const handleCreateCampaign = async () => {
    try {
      console.log('[DEBUG] AdminDashboard: Creating new campaign');
      const newCampaign = await createCampaign(campaignForm);
      setCampaigns([...campaigns, newCampaign]);
      resetCampaignForm();
      console.log('[DEBUG] AdminDashboard: Campaign created successfully');
    } catch (err) {
      console.error('Error creating campaign:', err);
      setError('Failed to create campaign');
    }
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setCampaignForm({
      name: campaign.name,
      type: campaign.type,
      url: campaign.url,
      description: campaign.description,
      status: campaign.status,
      clicks: campaign.clicks,
      revenue: campaign.revenue
    });
    setShowCampaignForm(true);
  };

  const handleUpdateCampaign = async () => {
    if (!editingCampaign) return;

    try {
      console.log('[DEBUG] AdminDashboard: Updating campaign', editingCampaign.id);
      await updateCampaign(editingCampaign.id, campaignForm);
      setCampaigns(campaigns.map(c => 
        c.id === editingCampaign.id 
          ? { ...c, ...campaignForm, updatedAt: new Date().toISOString() }
          : c
      ));
      resetCampaignForm();
      console.log('[DEBUG] AdminDashboard: Campaign updated successfully');
    } catch (err) {
      console.error('Error updating campaign:', err);
      setError('Failed to update campaign');
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return;
    }

    try {
      console.log('[DEBUG] AdminDashboard: Deleting campaign', campaignId);
      await deleteCampaign(campaignId);
      setCampaigns(campaigns.filter(c => c.id !== campaignId));
      console.log('[DEBUG] AdminDashboard: Campaign deleted successfully');
    } catch (err) {
      console.error('Error deleting campaign:', err);
      setError('Failed to delete campaign');
    }
  };

  const handleInitializeSampleCampaigns = async () => {
    if (!confirm('This will create sample campaigns. Continue?')) {
      return;
    }

    try {
      console.log('[DEBUG] AdminDashboard: Initializing sample campaigns');
      setCampaignsLoading(true);
      
      const newCampaigns: Campaign[] = [];
      for (const sampleCampaign of sampleCampaigns) {
        const campaign = await createCampaign(sampleCampaign);
        newCampaigns.push(campaign);
      }
      
      setCampaigns([...campaigns, ...newCampaigns]);
      console.log('[DEBUG] AdminDashboard: Successfully created', newCampaigns.length, 'sample campaigns');
    } catch (err) {
      console.error('Error creating sample campaigns:', err);
      setError('Failed to create sample campaigns');
    } finally {
      setCampaignsLoading(false);
    }
  };

  // Advertising Ways handlers
  const resetAdvertisingWayForm = () => {
    setAdvertisingWayForm({
      name: '',
      description: '',
      isActive: true,
      displayMethod: 'banner',
      targetLocation: '',
      frequency: 'every-visit'
    });
    setEditingAdvertisingWay(null);
    setShowAdvertisingWayForm(false);
  };

  const handleCreateAdvertisingWay = async () => {
    try {
      console.log('[DEBUG] AdminDashboard: Creating new advertising way');
      const newAdvertisingWay = await createAdvertisingWay(advertisingWayForm);
      setAdvertisingWays([...advertisingWays, newAdvertisingWay]);
      resetAdvertisingWayForm();
      console.log('[DEBUG] AdminDashboard: Advertising way created successfully');
    } catch (err) {
      console.error('Error creating advertising way:', err);
      setError('Failed to create advertising way');
    }
  };

  const handleEditAdvertisingWay = (advertisingWay: AdvertisingWay) => {
    setEditingAdvertisingWay(advertisingWay);
    setAdvertisingWayForm({
      name: advertisingWay.name,
      description: advertisingWay.description,
      isActive: advertisingWay.isActive,
      displayMethod: advertisingWay.displayMethod as 'banner' | 'modal' | 'widget' | 'notification' | 'suggestion' | 'footer',
      targetLocation: advertisingWay.targetLocation,
      frequency: advertisingWay.frequency as 'every-visit' | 'daily-rotation' | 'weekly' | 'milestone-based' | 'on-goal-creation' | 'persistent'
    });
    setShowAdvertisingWayForm(true);
  };

  const handleUpdateAdvertisingWay = async () => {
    if (!editingAdvertisingWay) return;

    try {
      console.log('[DEBUG] AdminDashboard: Updating advertising way', editingAdvertisingWay.id);
      await updateAdvertisingWay(editingAdvertisingWay.id, advertisingWayForm);
      setAdvertisingWays(advertisingWays.map(aw =>
        aw.id === editingAdvertisingWay.id
          ? { ...aw, ...advertisingWayForm, updatedAt: new Date().toISOString() }
          : aw
      ));
      resetAdvertisingWayForm();
      console.log('[DEBUG] AdminDashboard: Advertising way updated successfully');
    } catch (err) {
      console.error('Error updating advertising way:', err);
      setError('Failed to update advertising way');
    }
  };

  const handleDeleteAdvertisingWay = async (advertisingWayId: string) => {
    if (!confirm('Are you sure you want to delete this advertising way? This action cannot be undone.')) {
      return;
    }

    try {
      console.log('[DEBUG] AdminDashboard: Deleting advertising way', advertisingWayId);
      await deleteAdvertisingWay(advertisingWayId);
      setAdvertisingWays(advertisingWays.filter(aw => aw.id !== advertisingWayId));
      console.log('[DEBUG] AdminDashboard: Advertising way deleted successfully');
    } catch (err) {
      console.error('Error deleting advertising way:', err);
      setError('Failed to delete advertising way');
    }
  };

  const handleToggleAdvertisingWayStatus = async (advertisingWayId: string, currentStatus: boolean) => {
    try {
      console.log('[DEBUG] AdminDashboard: Toggling advertising way status', advertisingWayId);
      await updateAdvertisingWay(advertisingWayId, { isActive: !currentStatus });
      setAdvertisingWays(advertisingWays.map(aw =>
        aw.id === advertisingWayId
          ? { ...aw, isActive: !currentStatus, updatedAt: new Date().toISOString() }
          : aw
      ));
      console.log('[DEBUG] AdminDashboard: Advertising way status updated successfully');
    } catch (err) {
      console.error('Error updating advertising way status:', err);
      setError('Failed to update advertising way status');
    }
  };

  const handleInitializeSampleAdvertisingWays = async () => {
    if (!confirm('This will create sample advertising ways. Continue?')) {
      return;
    }

    try {
      console.log('[DEBUG] AdminDashboard: Initializing sample advertising ways');
      setAdvertisingWaysLoading(true);
      
      const newAdvertisingWays: AdvertisingWay[] = [];
      for (const sampleAdvertisingWay of sampleAdvertisingWays) {
        const advertisingWay = await createAdvertisingWay(sampleAdvertisingWay);
        newAdvertisingWays.push(advertisingWay);
      }
      
      setAdvertisingWays([...advertisingWays, ...newAdvertisingWays]);
      console.log('[DEBUG] AdminDashboard: Successfully created', newAdvertisingWays.length, 'sample advertising ways');
    } catch (err) {
      console.error('Error creating sample advertising ways:', err);
      setError('Failed to create sample advertising ways');
    } finally {
      setAdvertisingWaysLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="mb-8">
        <button
          onClick={() => navigate('/goals')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Goals
        </button>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                User Management
              </div>
            </button>
            <button
              onClick={() => setActiveTab('advertising')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'advertising'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Advertising Campaigns
              </div>
            </button>
            <button
              onClick={() => setActiveTab('advertisingWays')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'advertisingWays'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Advertising Ways
              </div>
            </button>
          </nav>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">User Management</h2>
                <p className="text-sm text-gray-500">Manage all registered users</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subscription
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Goals
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Limit Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Login
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => {
                      const userGoalCount = goalsByUser[user.uid] || 0;
                      const userPlan = SUBSCRIPTION_PLANS[user.subscriptionPlan];
                      const isAdmin = user.email === 'admin@admin.com';
                      const maxGoals = isAdmin ? -1 : userPlan.maxGoals;
                      const isAtLimit = !isAdmin && maxGoals !== -1 && userGoalCount >= maxGoals;
                      const goalsRemaining = isAdmin || maxGoals === -1 ? '∞' : Math.max(0, maxGoals - userGoalCount);

                      return (
                        <tr key={user.uid} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {user.displayName || 'No name'}
                              </div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.role === 'admin' 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {user.role === 'admin' && <Crown className="w-3 h-3 mr-1" />}
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={user.subscriptionPlan}
                              onChange={(e) => handleUpdateSubscription(user.uid, e.target.value as SubscriptionPlan)}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                              disabled={user.email === 'admin@admin.com'}
                            >
                              <option value="free">Free</option>
                              <option value="pro">Pro</option>
                              <option value="platinum">Platinum</option>
                              <option value="enterprise">Enterprise</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {Object.keys(goalsByUser).length > 0 ? (
                                `${userGoalCount} / ${maxGoals === -1 ? '∞' : maxGoals}`
                              ) : (
                                <span className="text-gray-400">N/A</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {Object.keys(goalsByUser).length > 0 ? (
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  isAtLimit 
                                    ? 'bg-red-100 text-red-800' 
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {isAtLimit ? 'At Limit' : 'Available'}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {goalsRemaining} left
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.isActive 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {user.isActive ? <UserCheck className="w-3 h-3 mr-1" /> : <UserX className="w-3 h-3 mr-1" />}
                              {user.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(user.lastLoginAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              {user.email !== 'admin@admin.com' && (
                                <>
                                  <button
                                    onClick={() => handleToggleUserStatus(user.uid, user.isActive)}
                                    className={`p-1 rounded ${
                                      user.isActive 
                                        ? 'text-red-600 hover:bg-red-50' 
                                        : 'text-green-600 hover:bg-green-50'
                                    }`}
                                    title={user.isActive ? 'Deactivate user' : 'Activate user'}
                                  >
                                    {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(user.uid)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="Delete user"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {users.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No users found
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-blue-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Total Users</p>
                    <p className="text-2xl font-semibold text-gray-900">{users.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center">
                  <UserCheck className="w-8 h-8 text-green-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Active Users</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {users.filter(u => u.isActive).length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center">
                  <Crown className="w-8 h-8 text-red-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Admins</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {users.filter(u => u.role === 'admin').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center">
                  <Star className="w-8 h-8 text-purple-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Premium Users</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {users.filter(u => u.subscriptionPlan !== 'free').length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Advertising Campaigns Tab */}
        {activeTab === 'advertising' && (
          <div className="space-y-6">
            {/* Add Campaign Button */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Advertising Campaigns</h2>
                <p className="text-sm text-gray-500">Manage campaigns shown to free users</p>
              </div>
              <div className="flex gap-3">
                {campaigns.length === 0 && (
                  <button
                    onClick={handleInitializeSampleCampaigns}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                    disabled={campaignsLoading}
                  >
                    <Settings className="w-4 h-4" />
                    Initialize Sample Data
                  </button>
                )}
                <button
                  onClick={() => setShowCampaignForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Campaign
                </button>
              </div>
            </div>

            {/* Campaign Form Modal */}
            {showCampaignForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">
                      {editingCampaign ? 'Edit Campaign' : 'Add New Campaign'}
                    </h3>
                    <button
                      onClick={resetCampaignForm}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Campaign Name
                      </label>
                      <input
                        type="text"
                        value={campaignForm.name}
                        onChange={(e) => setCampaignForm({...campaignForm, name: e.target.value})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Enter campaign name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type
                      </label>
                      <select
                        value={campaignForm.type}
                        onChange={(e) => setCampaignForm({...campaignForm, type: e.target.value as 'internal' | 'external'})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="external">External</option>
                        <option value="internal">Internal</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL
                      </label>
                      <input
                        type="url"
                        value={campaignForm.url}
                        onChange={(e) => setCampaignForm({...campaignForm, url: e.target.value})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="https://example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={campaignForm.description}
                        onChange={(e) => setCampaignForm({...campaignForm, description: e.target.value})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        rows={3}
                        placeholder="Campaign description"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        value={campaignForm.status}
                        onChange={(e) => setCampaignForm({...campaignForm, status: e.target.value as 'active' | 'paused'})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Clicks
                        </label>
                        <input
                          type="number"
                          value={campaignForm.clicks}
                          onChange={(e) => setCampaignForm({...campaignForm, clicks: parseInt(e.target.value) || 0})}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Revenue ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={campaignForm.revenue}
                          onChange={(e) => setCampaignForm({...campaignForm, revenue: parseFloat(e.target.value) || 0})}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={editingCampaign ? handleUpdateCampaign : handleCreateCampaign}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {editingCampaign ? 'Update' : 'Create'}
                    </button>
                    <button
                      onClick={resetCampaignForm}
                      className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Campaigns Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {campaignsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading campaigns...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Campaign
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          URL
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Clicks
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Revenue
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {campaigns.map((campaign) => (
                        <tr key={campaign.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {campaign.name}
                              </div>
                              <div className="text-sm text-gray-500">{campaign.description}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              campaign.type === 'internal' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {campaign.type === 'internal' && <Settings className="w-3 h-3 mr-1" />}
                              {campaign.type === 'external' && <Globe className="w-3 h-3 mr-1" />}
                              {campaign.type === 'internal' ? 'Internal' : 'External'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <a
                              href={campaign.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                            >
                              <span className="truncate max-w-xs">{campaign.url}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              campaign.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {campaign.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {campaign.clicks.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${campaign.revenue.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditCampaign(campaign)}
                                className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                              >
                                <Edit className="w-4 h-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteCampaign(campaign.id)}
                                className="text-red-600 hover:text-red-900 flex items-center gap-1"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {campaigns.length === 0 && !campaignsLoading && (
                <div className="text-center py-8 text-gray-500">
                  No advertising campaigns found. Click "Add Campaign" to create your first campaign.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Advertising Ways Tab */}
        {activeTab === 'advertisingWays' && (
          <div className="space-y-6">
            {/* Add Advertising Way Button */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Advertising Ways</h2>
                <p className="text-sm text-gray-500">Manage how advertising campaigns are presented to free users</p>
              </div>
              <div className="flex gap-3">
                {advertisingWays.length === 0 && (
                  <button
                    onClick={handleInitializeSampleAdvertisingWays}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                    disabled={advertisingWaysLoading}
                  >
                    <Settings className="w-4 h-4" />
                    Initialize Sample Data
                  </button>
                )}
                <button
                  onClick={() => setShowAdvertisingWayForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Advertising Way
                </button>
              </div>
            </div>

            {/* Advertising Way Form Modal */}
            {showAdvertisingWayForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">
                      {editingAdvertisingWay ? 'Edit Advertising Way' : 'Add New Advertising Way'}
                    </h3>
                    <button
                      onClick={resetAdvertisingWayForm}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={advertisingWayForm.name}
                        onChange={(e) => setAdvertisingWayForm({...advertisingWayForm, name: e.target.value})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Enter advertising way name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={advertisingWayForm.description}
                        onChange={(e) => setAdvertisingWayForm({...advertisingWayForm, description: e.target.value})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        rows={3}
                        placeholder="Describe how this advertising method works"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Method
                      </label>
                      <select
                        value={advertisingWayForm.displayMethod}
                        onChange={(e) => setAdvertisingWayForm({...advertisingWayForm, displayMethod: e.target.value as 'banner' | 'modal' | 'widget' | 'notification' | 'suggestion' | 'footer'})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="banner">Banner</option>
                        <option value="modal">Modal</option>
                        <option value="widget">Widget</option>
                        <option value="notification">Notification</option>
                        <option value="suggestion">Suggestion</option>
                        <option value="footer">Footer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Target Location
                      </label>
                      <input
                        type="text"
                        value={advertisingWayForm.targetLocation}
                        onChange={(e) => setAdvertisingWayForm({...advertisingWayForm, targetLocation: e.target.value})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="e.g., goals-page-header, sidebar"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Frequency
                      </label>
                      <select
                        value={advertisingWayForm.frequency}
                        onChange={(e) => setAdvertisingWayForm({...advertisingWayForm, frequency: e.target.value as 'every-visit' | 'daily-rotation' | 'weekly' | 'milestone-based' | 'on-goal-creation' | 'persistent'})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="every-visit">Every Visit</option>
                        <option value="daily-rotation">Daily Rotation</option>
                        <option value="weekly">Weekly</option>
                        <option value="milestone-based">Milestone Based</option>
                        <option value="on-goal-creation">On Goal Creation</option>
                        <option value="persistent">Persistent</option>
                      </select>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={advertisingWayForm.isActive}
                        onChange={(e) => setAdvertisingWayForm({...advertisingWayForm, isActive: e.target.checked})}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                        Active
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={editingAdvertisingWay ? handleUpdateAdvertisingWay : handleCreateAdvertisingWay}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {editingAdvertisingWay ? 'Update' : 'Create'}
                    </button>
                    <button
                      onClick={resetAdvertisingWayForm}
                      className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Advertising Ways Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {advertisingWaysLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading advertising ways...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Display Method
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Target Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Frequency
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {advertisingWays.map((advertisingWay) => (
                        <tr key={advertisingWay.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {advertisingWay.name}
                              </div>
                              <div className="text-sm text-gray-500">{advertisingWay.description}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              advertisingWay.displayMethod === 'banner' ? 'bg-blue-100 text-blue-800' :
                              advertisingWay.displayMethod === 'modal' ? 'bg-purple-100 text-purple-800' :
                              advertisingWay.displayMethod === 'widget' ? 'bg-green-100 text-green-800' :
                              advertisingWay.displayMethod === 'notification' ? 'bg-yellow-100 text-yellow-800' :
                              advertisingWay.displayMethod === 'suggestion' ? 'bg-indigo-100 text-indigo-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {advertisingWay.displayMethod}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {advertisingWay.targetLocation}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {advertisingWay.frequency}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleToggleAdvertisingWayStatus(advertisingWay.id, advertisingWay.isActive)}
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                advertisingWay.isActive
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-red-100 text-red-800 hover:bg-red-200'
                              }`}
                            >
                              {advertisingWay.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditAdvertisingWay(advertisingWay)}
                                className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                              >
                                <Edit className="w-4 h-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteAdvertisingWay(advertisingWay.id)}
                                className="text-red-600 hover:text-red-900 flex items-center gap-1"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {advertisingWays.length === 0 && !advertisingWaysLoading && (
                <div className="text-center py-8 text-gray-500">
                  No advertising ways found. Click "Add Advertising Way" to create your first advertising presentation method.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;