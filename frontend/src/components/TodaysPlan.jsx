import { useState, useEffect } from 'react';
import { Calendar, Clock, Mail, Users, BarChart3, RefreshCw, AlertCircle } from 'lucide-react';
import { campaignAPI } from '../lib/api';

const TodaysPlan = ({ campaignId }) => {
  const [todaysData, setTodaysData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedDomain, setExpandedDomain] = useState(null);

  useEffect(() => {
    loadTodaysPlan();
  }, [campaignId]);

  const loadTodaysPlan = async () => {
    try {
      setLoading(true);
      const response = await campaignAPI.getTodaysPlan(campaignId);
      setTodaysData(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load today\'s plan');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (hour) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  const formatMinute = (minute) => {
    return `${minute.toString().padStart(2, '0')}`;
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
          <div className="text-red-500 mb-2">
            <AlertCircle className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Today's Plan Not Available</h3>
          <p className="text-muted mb-4">{error}</p>
          <button
            onClick={loadTodaysPlan}
            className="btn btn-primary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!todaysData) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <div className="text-muted mb-2">
            <Calendar className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Plan for Today</h3>
          <p className="text-muted">Today's plan will be available when the campaign starts.</p>
        </div>
      </div>
    );
  }

  const { campaign, todaysPlan, emailListStats, totalRecipients ,todaysQueued} = todaysData;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-white" />
          <div>
            <h2 className="text-xl font-semibold text-white">Today's Plan</h2>
            <p className="text-sm text-muted">Day {campaign.currentDay} - {campaign.status}</p>
          </div>
        </div>
        <button
          onClick={loadTodaysPlan}
          className="btn btn-secondary btn-sm flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Today's Plan Details */}
      {todaysPlan ? (
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-white" />
                <h3 className="font-semibold text-white">Day {todaysPlan.day} Schedule</h3>
              </div>
              <div className="text-right">
                <p className="text-sm text-white">Total Emails Today</p>
                <p className="text-2xl font-bold text-white">
                  {todaysPlan.totalEmails?.toLocaleString() || 0}
                </p>
              </div>
            </div>
            <p className="text-sm text-white">
              Scheduled at: {new Date(todaysPlan.scheduledAt).toLocaleString()}
            </p>
          </div>

          {/* Domain Distribution */}
          {todaysPlan.domains && todaysPlan.domains.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-white">Domain Distribution</h4>
              {todaysPlan.domains.map((domainPlan, domainIndex) => (
                <div key={domainIndex} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-white">{domainPlan.domain}</h5>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted">
                        {domainPlan.totalEmails} emails
                      </span>
                      <button
                        onClick={() => setExpandedDomain(expandedDomain === domainIndex ? null : domainIndex)}
                        className="btn btn-secondary btn-sm"
                      >
                        {expandedDomain === domainIndex ? 'Collapse' : 'Expand'}
                      </button>
                    </div>
                  </div>
                  
                  {expandedDomain === domainIndex && domainPlan.emails && (
                    <div className="space-y-3">
                      {domainPlan.emails.map((emailPlan, emailIndex) => (
                        <div key={emailIndex} className="bg-white/5 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-muted">{emailPlan.email}</p>
                            <span className="text-sm text-muted">
                              {emailPlan.totalEmails} emails
                            </span>
                          </div>
                          
                          {emailPlan.hours && emailPlan.hours.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                              {emailPlan.hours.map((hourPlan, hourIndex) => (
                                <div key={hourIndex} className="bg-white/5 rounded p-2 text-center border">
                                  <div className="text-xs text-muted mb-1">
                                    {formatTime(hourPlan.hour)}
                                  </div>
                                  <div className="text-sm font-semibold text-white">
                                    {hourPlan.count}
                                  </div>
                                  {hourPlan.minutes && (
                                    <div className="mt-1 text-xs text-muted">
                                      {hourPlan.minutes.filter(count => count > 0).length} min slots
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-muted mb-2">
            <Calendar className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Plan for Today</h3>
          <p className="text-muted">Today's plan has not been generated yet.</p>
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 p-4 bg-white/5 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-white" />
          <h4 className="font-semibold text-white">Today's Summary</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-white font-medium">Current Day</p>
            <p className="text-white font-semibold">Day {campaign.currentDay}</p>
          </div>
          <div>
            <p className="text-white font-medium">Emails Today</p>
            <p className="text-white font-semibold">
              {todaysPlan?.totalEmails?.toLocaleString() || 0}
            </p>
          </div>
          <div>
            <p className="text-white font-medium">Available Recipients</p>
            <p className="text-white font-semibold">
              {todaysQueued?.toLocaleString() || 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TodaysPlan;
