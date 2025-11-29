import { useState, useEffect } from 'react';
import { Clock, Play, Pause, CheckCircle, Calendar, Mail, Users, BarChart3, RefreshCw, AlertCircle } from 'lucide-react';
import { campaignAPI } from '../lib/api';

const CurrentExecution = ({ campaignId , realtimeStats }) => {
  const [executionData, setExecutionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);

  useEffect(() => {
    loadExecutionData();
    
    // No polling needed - data loads once and user can manually refresh
    // Real-time updates come via WebSocket in parent component
  }, [campaignId]);

  const loadExecutionData = async () => {
    try {
      setLoading(true);
      const response = await campaignAPI.getCurrentExecutionPlan(campaignId);
      setExecutionData(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load current execution plan');
    } finally {
      setLoading(false);
    }
  };

  const loadDebugInfo = async () => {
    try {
      const response = await campaignAPI.testCampaignStatus(campaignId);
      setDebugInfo(response.data);
    } catch (err) {
      console.error('Failed to load debug info:', err);
    }
  };

  const regeneratePlan = async () => {
    try {
      setRegenerating(true);
      await campaignAPI.regenerateCampaignPlan(campaignId);
      // Reload execution data after regeneration
      await loadExecutionData();
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to regenerate campaign plan');
    } finally {
      setRegenerating(false);
    }
  };

  const testEmailSending = async () => {
    if (!testEmail) {
      alert('Please enter a test email address');
      return;
    }

    try {
      setTestingEmail(true);
      const response = await campaignAPI.testEmailSending(campaignId, testEmail);
      alert(`Test email queued successfully! Job ID: ${response.data.jobId}`);
      setTestEmail('');
    } catch (err) {
      alert(`Failed to send test email: ${err.response?.data?.message || err.message}`);
    } finally {
      setTestingEmail(false);
    }
  };

  const formatTime = (hour) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  const formatMinute = (minute) => {
    return `${minute.toString().padStart(2, '0')}`;
  };

  const getCurrentMinuteEmails = () => {
    if (!executionData?.execution?.currentHourPlan) return 0;
    
    // Use UTC time to match backend
    const currentMinute = new Date().getUTCMinutes();
    let totalEmails = 0;
    
    executionData.execution.currentHourPlan.domains.forEach(domain => {
      if (domain.minuteDistribution && domain.minuteDistribution[currentMinute]) {
        totalEmails += domain.minuteDistribution[currentMinute];
      }
    });
    
    return totalEmails;
  };

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-white/10 rounded"></div>
            <div className="h-4 bg-white/10 rounded w-3/4"></div>
            <div className="h-4 bg-white/10 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <div className="text-red-400 mb-2">
            <AlertCircle className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Execution Plan Not Available</h3>
          <p className="text-muted mb-4">{error}</p>
        </div>
      </div>
    );
  }

  if (!executionData) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <div className="text-muted mb-2">
            <Clock className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Execution Plan</h3>
          <p className="text-muted">Execution plan will be available when the campaign starts.</p>
        </div>
      </div>
    );
  }

  const { campaign, execution, emailListStats } = executionData;
  const currentMinuteEmails = getCurrentMinuteEmails();

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-white" />
          <div>
            <h2 className="text-xl font-semibold text-white">Current Execution</h2>
            <p className="text-sm text-muted">
              Day {campaign.currentDay} - {execution.currentTime.hour.toString().padStart(2, '0')}:{execution.currentTime.minute.toString().padStart(2, '0')}
            </p>
          </div>
        </div>
        <button
          onClick={loadExecutionData}
          className="btn btn-secondary btn-sm flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-lg">
          <Mail className="w-6 h-6 text-white mx-auto mb-2" />
          <p className="text-sm text-muted font-medium">Total Scheduled</p>
          <p className="text-2xl font-bold text-white">
            {realtimeStats?.queueStats?.total?.toLocaleString() || 0}
          </p>
        </div>
        <div className="text-center p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-lg">
          <CheckCircle className="w-6 h-6 text-white mx-auto mb-2" />
          <p className="text-sm text-muted font-medium">Completed</p>
          <p className="text-2xl font-bold text-white">
            {realtimeStats?.queueStats?.completed?.toLocaleString() || 0}
          </p>
        </div>
        <div className="text-center p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-lg">
          <Clock className="w-6 h-6 text-white mx-auto mb-2" />
          <p className="text-sm text-muted font-medium">Remaining</p>
          <p className="text-2xl font-bold text-white">
            {realtimeStats?.queueStats?.delayed?.toLocaleString() || 0}
          </p>
        </div>
        <div className="text-center p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-lg">
          <Mail className="w-6 h-6 text-white mx-auto mb-2" />
          <p className="text-sm text-muted font-medium">This Minute</p>
          <p className="text-2xl font-bold text-white">
            {currentMinuteEmails}
          </p>
        </div>
      </div>

      {/* Current Hour Plan */}
      {execution.currentHourPlan && (
        <div className="mb-6">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-white" />
                <h3 className="font-semibold text-white">
                  Current Hour: {formatTime(execution.currentHourPlan.hour)}
                </h3>
              </div>
              <div className="text-right">
                <p className="text-sm text-white">Total Emails This Hour</p>
                <p className="text-2xl font-bold text-white">
                  {execution.currentHourPlan.totalEmails}
                </p>
              </div>
            </div>
            
            {execution.currentHourPlan.domains.map((domain, index) => (
              <div key={index} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">{domain.sender}</p>
                  <span className="text-sm text-white">{domain.count} emails</span>
                </div>
                
                {domain.minuteDistribution && domain.minuteDistribution.length > 0 && (
                  <div className="grid grid-cols-6 md:grid-cols-12 gap-1">
                    {domain.minuteDistribution.slice(0, 60).map((count, minute) => (
                      <div 
                        key={minute} 
                        className={`text-center p-1 rounded text-xs ${
                          minute === new Date().getUTCMinutes() 
                            ? 'bg-green-600 text-white font-bold' 
                            : count > 0 
                              ? 'bg-green-800 text-white' 
                              : 'bg-white/5 text-muted'
                        }`}
                        title={`${formatMinute(minute)}: ${count} emails`}
                      >
                        {count > 0 ? count : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Hours */}
      {execution.upcomingHours && execution.upcomingHours.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Upcoming Hours</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {execution.upcomingHours.slice(0, 6).map((hour, index) => (
              <div key={index} className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-white" />
                    <span className="font-medium text-white">
                      {formatTime(hour.hour)}
                    </span>
                  </div>
                  <span className="text-sm text-white">{hour.count} emails</span>
                </div>
                <div className="text-xs text-white">
                  {hour.domain} • {hour.sender}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Hours */}
      {execution.completedHours && execution.completedHours.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Completed Hours</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {execution.completedHours.slice(-6).map((hour, index) => (
              <div key={index} className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-muted" />
                    <span className="font-medium text-white">
                      {formatTime(hour.hour)}
                    </span>
                  </div>
                  <span className="text-sm text-muted">{hour.count} emails</span>
                </div>
                <div className="text-xs text-muted">
                  {hour.domain} • {hour.sender}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CurrentExecution;
