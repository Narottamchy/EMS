import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, RefreshCw, Edit, BarChart3, Clock } from 'lucide-react';
import useCampaignStore from '../store/campaignStore';
import { campaignAPI } from '../lib/api';
import socketService from '../lib/socket';
import { CampaignDetailSkeleton } from '../components/SkeletonComponents';

import TodaysPlan from '../components/TodaysPlan';
import CurrentExecution from '../components/CurrentExecution';
import StartCampaignModal from '../components/StartCampaignModal';
import DailyStats from '../components/DailyStats';

const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentCampaign, fetchCampaignById, startCampaign, pauseCampaign, resumeCampaign } = useCampaignStore();
  const [realtimeStats, setRealtimeStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showStartModal, setShowStartModal] = useState(false);

  useEffect(() => {
    loadCampaignData();

    // Subscribe to real-time updates via WebSocket
    socketService.subscribeToCampaign(id, handleRealtimeUpdate);

    // No polling needed - WebSocket provides real-time updates

    return () => {
      socketService.unsubscribeFromCampaign(id);
    };
  }, [id]);

  const loadCampaignData = async () => {
    setLoading(true);
    await Promise.all([
      fetchCampaignById(id),
      loadRealtimeStats(),
    ]);
    setLoading(false);
  };

  const loadRealtimeStats = async () => {
    try {
      const response = await campaignAPI.getRealtimeStats(id);
      setRealtimeStats(response.data);
    } catch (error) {
      // Silent error handling
    }
  };

  const handleRealtimeUpdate = (data) => {
    // Merge WebSocket updates with existing stats
    if (data.emailStats) {
      setRealtimeStats(prev => ({
        ...prev,
        emailStats: {
          ...prev?.emailStats,
          ...data.emailStats
        }
      }));
    }
    
    // Reload full data on campaign status changes
    if (data.type === 'campaign_started' || data.type === 'campaign_paused' || data.type === 'campaign_resumed') {
      loadCampaignData();
    }
  };

  const handleStart = () => {
    setShowStartModal(true);
  };

  const handleStartCampaign = async (templateData) => {
    try {
      // Save template data first
      if (templateData && Object.keys(templateData).length > 0) {
        await campaignAPI.saveTemplateData(id, templateData);
      }
      
      // Start the campaign
      await startCampaign(id);
      loadRealtimeStats();
    } catch (error) {
      throw error;
    }
  };

  const handlePause = async () => {
    await pauseCampaign(id);
    loadRealtimeStats();
  };

  const handleResume = async () => {
    await resumeCampaign(id);
    loadRealtimeStats();
  };



  if (loading || !currentCampaign) {
    return <CampaignDetailSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/campaigns')}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-muted" />
          </button>
          <div>
            <h1 className="text-4xl font-bold text-foreground">{currentCampaign.name}</h1>
            <p className="text-muted mt-2">{currentCampaign.description}</p>
          </div>
        </div>
        
         <div className="flex items-center gap-2">
           <button onClick={loadRealtimeStats} className="btn btn-secondary">
             <RefreshCw className="w-5 h-5" />
           </button>
           <button
             onClick={() => navigate(`/campaigns/${id}/edit`)}
             className="btn btn-primary"
             disabled={currentCampaign.status === 'running'}
             title={currentCampaign.status === 'running' ? 'Cannot edit running campaign. Pause it first.' : 'Edit campaign configuration'}
           >
             <Edit className="w-5 h-5 mr-2" />
             Edit Campaign
           </button>
          <button
            onClick={() => navigate(`/campaigns/${id}/simulate`)}
            className="btn btn-primary"
          >
            <BarChart3 className="w-5 h-5 mr-2" />
            Simulate Plan
          </button>

          
          {currentCampaign.status === 'draft' && (
            <button onClick={handleStart} className="btn btn-success">
              <Play className="w-5 h-5 mr-2" />
              Start Campaign
            </button>
          )}
          
          {currentCampaign.status === 'running' && (
            <button onClick={handlePause} className="btn btn-warning">
              <Pause className="w-5 h-5 mr-2" />
              Pause Campaign
            </button>
          )}
          
          {currentCampaign.status === 'paused' && (
            <button onClick={handleResume} className="btn btn-success">
              <Play className="w-5 h-5 mr-2" />
              Resume Campaign
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-white/10">
        <nav className="-mb-px flex space-x-8">
        <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-white/20 text-white'
                : 'border-transparent text-muted hover:text-muted hover:border-white/10'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('execution')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'execution'
                ? 'border-white/20 text-white'
                : 'border-transparent text-muted hover:text-muted hover:border-white/10'
            }`}
          >
            <Play className="w-4 h-4" />
            Live Execution
          </button>
          
          <button
            onClick={() => setActiveTab('today')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'today'
                ? 'border-white/20 text-white'
                : 'border-transparent text-muted hover:text-muted hover:border-white/10'
            }`}
          >
            <Clock className="w-4 h-4" />
            Today's Plan
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'border-white/20 text-white'
                : 'border-transparent text-muted hover:text-muted hover:border-white/10'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('daily-stats')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'daily-stats'
                ? 'border-white/20 text-white'
                : 'border-transparent text-muted hover:text-muted hover:border-white/10'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Daily Stats
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'execution' && (
        <div className="mt-6">
          <CurrentExecution campaignId={id} />
        </div>
      )}

      {activeTab === 'overview' && (
        <>
          {/* Real-time Stats */}
      {realtimeStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card card-hover">
            <p className="text-sm font-medium text-muted mb-2">Queued</p>
            <p className="text-3xl font-bold text-secondary">
              {realtimeStats.emailStats?.queued || 0}
            </p>
          </div>
          <div className="card card-hover">
            <p className="text-sm font-medium text-muted mb-2">Sent</p>
            <p className="text-3xl font-bold text-foreground">
              {realtimeStats.emailStats?.sent || 0}
            </p>
          </div>
          {/* <div className="card card-hover">
            <p className="text-sm font-medium text-muted mb-2">Delivered</p>
            <p className="text-3xl font-bold text-accent">
              {realtimeStats.emailStats?.delivered || 0}
            </p>
          </div> */}
          <div className="card card-hover">
            <p className="text-sm font-medium text-muted mb-2">Failed</p>
            <p className="text-3xl font-bold text-red-600">
              {realtimeStats.emailStats?.failed || 0}
            </p>
          </div>
        </div>
      )}

      {/* Campaign Configuration */}
      <div className="card">
        <h2 className="text-xl font-semibold text-foreground mb-6">Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-muted mb-2">Domains</p>
            <p className="text-lg font-medium text-foreground">
              {currentCampaign.configuration?.domains?.join(', ')}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted">Emails Per Domain</p>
            <p className="text-lg font-medium text-white mt-1">
              {currentCampaign.configuration?.senderEmails && currentCampaign.configuration.senderEmails.length > 0
                ? Math.max(...Object.values(
                    currentCampaign.configuration.senderEmails
                      .filter(s => s.isActive)
                      .reduce((acc, sender) => {
                        acc[sender.domain] = (acc[sender.domain] || 0) + 1;
                        return acc;
                      }, {})
                  ), 1)
                : '5 (default)'
              }
            </p>
          </div>
          <div>
            <p className="text-sm text-muted">Base Daily Total</p>
            <p className="text-lg font-medium text-white mt-1">
              {currentCampaign.configuration?.baseDailyTotal}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted">Randomization Intensity</p>
            <p className="text-lg font-medium text-white mt-1">
              {currentCampaign.configuration?.randomizationIntensity}
            </p>
          </div>
        </div>
        
        {/* Sender Emails - Read Only */}
        <div className="mt-6">
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-white">Sender Emails</h3>
            <p className="text-sm text-muted mt-1">
              To add or modify sender emails, use the "Edit Campaign" button above.
            </p>
          </div>
          
          {currentCampaign.configuration?.senderEmails && currentCampaign.configuration.senderEmails.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentCampaign.configuration.senderEmails.map((sender, index) => (
                <div key={index} className={`p-3 rounded-lg border ${sender.isActive ? 'bg-white/5 border-white/10' : 'bg-white/5 border-white/10'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-white">{sender.email}</p>
                      <p className="text-sm text-muted">Domain: {sender.domain}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${sender.isActive ? 'bg-white/10 text-white' : 'bg-white/5 text-white'}`}>
                        {sender.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted">
              <p>No sender emails configured</p>
              <p className="text-sm">System will use generated sender emails (sender1@domain.com, etc.)</p>
            </div>
          )}
        </div>

      </div>

        </>
      )}

      {activeTab === 'today' && (
        <TodaysPlan campaignId={id} />
      )}

      {activeTab === 'analytics' && (
        <>
          {/* Queue Status */}
          {realtimeStats?.queueStats && (
            <div className="card">
              <h2 className="text-xl font-semibold text-white mb-4">Queue Status</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <p className="text-sm text-white font-medium">Waiting</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {realtimeStats.queueStats.waiting}
                  </p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <p className="text-sm text-white font-medium">Active</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {realtimeStats.queueStats.active}
                  </p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <p className="text-sm text-white font-medium">Completed</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {realtimeStats.queueStats.completed}
                  </p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <p className="text-sm text-red-600 font-medium">Failed</p>
                  <p className="text-2xl font-bold text-red-700 mt-1">
                    {realtimeStats.queueStats.failed}
                  </p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <p className="text-sm text-white font-medium">Delayed</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {realtimeStats.queueStats.delayed}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'daily-stats' && (
        <DailyStats campaignId={id} />
      )}

      {/* Start Campaign Modal */}
      <StartCampaignModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        campaignId={id}
        campaignName={currentCampaign?.name}
        campaign={currentCampaign}
        onStart={handleStartCampaign}
      />
    </div>
  );
};

export default CampaignDetail;
