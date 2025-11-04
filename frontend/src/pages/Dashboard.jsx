import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Mail, 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  Clock,
  TrendingUp,
  Users,
  Activity
} from 'lucide-react';
import useCampaignStore from '../store/campaignStore';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DashboardSkeleton } from '../components/SkeletonComponents';

const StatCard = ({ title, value, icon: Icon, trend, color = 'primary' }) => {
  const colorClasses = {
    primary: 'bg-primary/5 text-primary',
    success: 'bg-accent/10 text-accent',
    warning: 'bg-amber-500/10 text-amber-600',
    danger: 'bg-red-500/10 text-red-600',
    info: 'bg-secondary/10 text-secondary',
  };

  return (
    <div className="card card-hover">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted mb-2">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {trend && (
            <p className="text-sm text-muted mt-2 flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              {trend}
            </p>
          )}
        </div>
        <div className={`p-4 rounded-xl ${colorClasses[color]}`}>
          <Icon className="w-7 h-7" />
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { dashboard, fetchDashboard } = useCampaignStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      await fetchDashboard();
      setLoading(false);
    };
    loadDashboard();
    // Dashboard loads once on mount - no need for constant polling
    // User can manually refresh if needed
  }, [fetchDashboard]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const stats = [
    {
      title: 'Total Campaigns',
      value: dashboard?.campaigns?.total || 0,
      icon: Mail,
      color: 'primary',
    },
    {
      title: 'Active Campaigns',
      value: dashboard?.campaigns?.active || 0,
      icon: Play,
      color: 'success',
    },
    {
      title: 'Completed',
      value: dashboard?.campaigns?.completed || 0,
      icon: CheckCircle,
      color: 'info',
    },
    {
      title: 'Queue Size',
      value: dashboard?.queue?.waiting || 0,
      icon: Clock,
      color: 'warning',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted mt-2">
            Overview of your email campaign performance
          </p>
        </div>
        <Link to="/campaigns/new" className="btn btn-primary">
          <Mail className="w-5 h-5 mr-2" />
          New Campaign
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Campaign Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campaign Status */}
        <div className="card">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Campaign Status
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-accent/5 rounded-xl border border-accent/20 hover-lift">
              <div className="flex items-center">
                <Play className="w-5 h-5 text-accent mr-3" />
                <span className="font-medium text-foreground">Running</span>
              </div>
              <span className="text-xl font-bold text-accent">
                {dashboard?.campaigns?.active || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-amber-500/5 rounded-xl border border-amber-500/20 hover-lift">
              <div className="flex items-center">
                <Pause className="w-5 h-5 text-amber-600 mr-3" />
                <span className="font-medium text-foreground">Paused</span>
              </div>
              <span className="text-xl font-bold text-amber-600">
                {dashboard?.campaigns?.paused || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-border hover-lift">
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-muted mr-3" />
                <span className="font-medium text-foreground">Draft</span>
              </div>
              <span className="text-xl font-bold text-muted">
                {dashboard?.campaigns?.draft || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-red-500/5 rounded-xl border border-red-500/20 hover-lift">
              <div className="flex items-center">
                <XCircle className="w-5 h-5 text-red-600 mr-3" />
                <span className="font-medium text-foreground">Failed</span>
              </div>
              <span className="text-xl font-bold text-red-600">
                {dashboard?.campaigns?.failed || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Queue Status */}
        <div className="card">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Queue Status
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-secondary/5 rounded-xl border border-secondary/20 hover-lift">
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-secondary mr-3" />
                <span className="font-medium text-foreground">Waiting</span>
              </div>
              <span className="text-xl font-bold text-secondary">
                {dashboard?.queue?.waiting || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-accent/5 rounded-xl border border-accent/20 hover-lift">
              <div className="flex items-center">
                <Activity className="w-5 h-5 text-accent mr-3" />
                <span className="font-medium text-foreground">Active</span>
              </div>
              <span className="text-xl font-bold text-accent">
                {dashboard?.queue?.active || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/50/5 rounded-xl border border-purple-500/20 hover-lift">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-white mr-3" />
                <span className="font-medium text-foreground">Completed</span>
              </div>
              <span className="text-xl font-bold text-white">
                {dashboard?.queue?.completed || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-red-500/5 rounded-xl border border-red-500/20 hover-lift">
              <div className="flex items-center">
                <XCircle className="w-5 h-5 text-red-600 mr-3" />
                <span className="font-medium text-foreground">Failed</span>
              </div>
              <span className="text-xl font-bold text-red-600">
                {dashboard?.queue?.failed || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Campaigns */}
      {dashboard?.activeCampaigns && dashboard.activeCampaigns.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Active Campaigns
          </h2>
          <div className="space-y-3">
            {dashboard.activeCampaigns.map((campaign) => (
              <Link
                key={campaign.id}
                to={`/campaigns/${campaign.id}`}
                className="block p-4 border border-border rounded-xl hover:border-accent/30 hover:bg-accent/5 transition-all duration-200 hover-lift"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Campaign {campaign.id}</p>
                    <p className="text-sm text-muted mt-1">
                      Started {new Date(campaign.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="badge badge-success">Running</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/campaigns/new"
            className="flex items-center p-6 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all duration-200 hover-lift"
          >
            <Mail className="w-8 h-8 text-primary mr-4" />
            <div>
              <p className="font-medium text-foreground">Create Campaign</p>
              <p className="text-sm text-muted mt-1">Start a new email campaign</p>
            </div>
          </Link>
          <Link
            to="/templates/new"
            className="flex items-center p-6 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all duration-200 hover-lift"
          >
            <Users className="w-8 h-8 text-primary mr-4" />
            <div>
              <p className="font-medium text-foreground">New Template</p>
              <p className="text-sm text-muted mt-1">Create email template</p>
            </div>
          </Link>
          <Link
            to="/emails"
            className="flex items-center p-6 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all duration-200 hover-lift"
          >
            <Activity className="w-8 h-8 text-primary mr-4" />
            <div>
              <p className="font-medium text-foreground">Email Management</p>
              <p className="text-sm text-muted mt-1">Manage email lists</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
