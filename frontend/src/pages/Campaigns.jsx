import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Play, Pause, Trash2, Eye, Search, Clock } from 'lucide-react';
import useCampaignStore from '../store/campaignStore';
import useAuthStore from '../store/authStore';
import StartCampaignModal from '../components/StartCampaignModal';
import { campaignAPI } from '../lib/api';
import { CampaignsSkeleton } from '../components/SkeletonComponents';

const StatusBadge = ({ status }) => {
  const statusConfig = {
    draft: { class: 'badge-gray', label: 'Draft' },
    scheduled: { class: 'badge-info', label: 'Scheduled' },
    running: { class: 'badge-success', label: 'Running' },
    paused: { class: 'badge-warning', label: 'Paused' },
    completed: { class: 'badge-info', label: 'Completed' },
    failed: { class: 'badge-danger', label: 'Failed' },
  };

  const config = statusConfig[status] || statusConfig.draft;

  return <span className={`badge ${config.class}`}>{config.label}</span>;
};

const Campaigns = () => {
  const { campaigns, fetchCampaigns, startCampaign, pauseCampaign, deleteCampaign, isLoading } = useCampaignStore();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStart = (id) => {
    setSelectedCampaignId(id);
    setShowStartModal(true);
  };

  const handleStartCampaign = async (templateData) => {
    try {
      // Save template data first
      if (templateData && Object.keys(templateData).length > 0) {
        await campaignAPI.saveTemplateData(selectedCampaignId, templateData);
      }
      
      // Start the campaign
      await startCampaign(selectedCampaignId);
    } catch (error) {
      console.error('Failed to start campaign:', error);
      throw error;
    }
  };

  const handlePause = async (id) => {
    if (window.confirm('Are you sure you want to pause this campaign?')) {
      await pauseCampaign(id);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      await deleteCampaign(id);
    }
  };

  const canManage = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Campaigns</h1>
          <p className="text-muted mt-2">Manage your email campaigns</p>
        </div>
        {canManage && (
          <div className="flex gap-3">
            <Link to="/campaigns/new" className="btn btn-primary">
              <Plus className="w-5 h-5 mr-2" />
              New Campaign
            </Link>
            <Link to="/campaigns/custom/new" className="btn btn-secondary">
              <Clock className="w-5 h-5 mr-2" />
              Custom Duration
            </Link>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted w-5 h-5" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input md:w-48"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="running">Running</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Campaigns List */}
      {isLoading ? (
        <CampaignsSkeleton />
      ) : filteredCampaigns.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-muted">No campaigns found</p>
          {canManage && (
            <Link to="/campaigns/new" className="btn btn-primary mt-6 inline-flex items-center">
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Campaign
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredCampaigns.map((campaign) => (
            <div key={campaign._id} className="card card-hover">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xl font-semibold text-foreground">
                      {campaign.name}
                    </h3>
                    <StatusBadge status={campaign.status} />
                    {campaign.type === 'custom_duration' && (
                      <span className="badge badge-info flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Custom Duration
                      </span>
                    )}
                  </div>
                  <p className="text-muted mb-6">{campaign.description}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                    <div>
                      <p className="text-sm font-medium text-muted mb-1">Total Sent</p>
                      <p className="text-2xl font-bold text-foreground">
                        {campaign.progress?.totalSent || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted mb-1">Delivered</p>
                      <p className="text-2xl font-bold text-accent">
                        {campaign.progress?.totalDelivered || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted mb-1">Failed</p>
                      <p className="text-2xl font-bold text-red-600">
                        {campaign.progress?.totalFailed || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted mb-1">Current Day</p>
                      <p className="text-2xl font-bold text-foreground">
                        {campaign.progress?.currentDay || 1}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted">
                    <span>Created {new Date(campaign.createdAt).toLocaleDateString()}</span>
                    {campaign.startedAt && (
                      <span>Started {new Date(campaign.startedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Link
                    to={`/campaigns/${campaign._id}`}
                    className="btn btn-ghost btn-sm"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  
                  {canManage && campaign.status === 'draft' && (
                    <button
                      onClick={() => handleStart(campaign._id)}
                      className="btn btn-success btn-sm"
                      title="Start Campaign"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  
                  {canManage && campaign.status === 'running' && (
                    <button
                      onClick={() => handlePause(campaign._id)}
                      className="btn btn-warning btn-sm"
                      title="Pause Campaign"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  )}
                  
                  {canManage && campaign.status !== 'running' && (
                    <button
                      onClick={() => handleDelete(campaign._id)}
                      className="btn btn-danger btn-sm"
                      title="Delete Campaign"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Start Campaign Modal */}
      <StartCampaignModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        campaignId={selectedCampaignId}
        campaignName={campaigns.find(c => c._id === selectedCampaignId)?.name}
        campaign={campaigns.find(c => c._id === selectedCampaignId)}
        onStart={handleStartCampaign}
      />
    </div>
  );
};

export default Campaigns;
