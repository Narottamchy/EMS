import { useState, useEffect } from 'react';
import { Calendar, Clock, Mail, Users, BarChart3, Eye, EyeOff } from 'lucide-react';
import { campaignAPI } from '../lib/api';

const CampaignPlan = ({ campaignId }) => {
  const [campaignPlan, setCampaignPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadCampaignPlan();
  }, [campaignId]);

  const loadCampaignPlan = async () => {
    try {
      setLoading(true);
      const response = await campaignAPI.getCampaignPlan(campaignId);
      setCampaignPlan(response.data.campaignPlan);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load campaign plan');
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
            <BarChart3 className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Campaign Plan Not Available</h3>
          <p className="text-muted mb-4">{error}</p>
          <button
            onClick={loadCampaignPlan}
            className="btn btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!campaignPlan) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <div className="text-muted mb-2">
            <Calendar className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Campaign Plan</h3>
          <p className="text-muted">Campaign plan will be generated when the campaign starts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-white" />
          <h2 className="text-xl font-semibold text-white">Campaign Plan</h2>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="btn btn-secondary btn-sm flex items-center gap-2"
        >
          {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Email List Statistics */}
      {campaignPlan.emailListStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <Users className="w-6 h-6 text-white mx-auto mb-2" />
            <p className="text-sm text-white font-medium">Total Emails</p>
            <p className="text-2xl font-bold text-white">
              {campaignPlan.emailListStats.totalEmails?.toLocaleString() || 0}
            </p>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <Mail className="w-6 h-6 text-white mx-auto mb-2" />
            <p className="text-sm text-white font-medium">Available</p>
            <p className="text-2xl font-bold text-white">
              {campaignPlan.emailListStats.availableToSend?.toLocaleString() || 0}
            </p>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <Mail className="w-6 h-6 text-white mx-auto mb-2" />
            <p className="text-sm text-white font-medium">Already Sent</p>
            <p className="text-2xl font-bold text-white">
              {campaignPlan.emailListStats.alreadySent?.toLocaleString() || 0}
            </p>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <Mail className="w-6 h-6 text-red-600 mx-auto mb-2" />
            <p className="text-sm text-red-600 font-medium">Unsubscribed</p>
            <p className="text-2xl font-bold text-red-700">
              {campaignPlan.emailListStats.unsubscribed?.toLocaleString() || 0}
            </p>
          </div>
        </div>
      )}

      {/* Daily Plans */}
      {campaignPlan.dailyPlans && campaignPlan.dailyPlans.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Daily Schedule</h3>
          {campaignPlan.dailyPlans.map((dayPlan, dayIndex) => (
            <div key={dayIndex} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold">{dayPlan.day}</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Day {dayPlan.day}</h4>
                    <p className="text-sm text-muted">
                      {dayPlan.totalEmails?.toLocaleString()} emails scheduled
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedDay(expandedDay === dayIndex ? null : dayIndex)}
                  className="btn btn-secondary btn-sm"
                >
                  {expandedDay === dayIndex ? 'Collapse' : 'Expand'}
                </button>
              </div>

              {expandedDay === dayIndex && showDetails && (
                <div className="space-y-4">
                  {dayPlan.domains?.map((domainPlan, domainIndex) => (
                    <div key={domainIndex} className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-white">{domainPlan.domain}</h5>
                        <span className="text-sm text-muted">
                          {domainPlan.totalEmails} emails
                        </span>
                      </div>
                      
                      {domainPlan.emails?.map((emailPlan, emailIndex) => (
                        <div key={emailIndex} className="mb-4 last:mb-0">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-muted">{emailPlan.email}</p>
                            <span className="text-sm text-muted">
                              {emailPlan.totalEmails} emails
                            </span>
                          </div>
                          
                          {emailPlan.hours && emailPlan.hours.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                              {emailPlan.hours.map((hourPlan, hourIndex) => (
                                <div key={hourIndex} className="bg-white rounded p-2 text-center">
                                  <div className="text-xs text-muted mb-1">
                                    {formatTime(hourPlan.hour)}
                                  </div>
                                  <div className="text-sm font-semibold text-white">
                                    {hourPlan.count}
                                  </div>
                                  {showDetails && hourPlan.minutes && (
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
                  ))}
                </div>
              )}

              {expandedDay === dayIndex && !showDetails && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {dayPlan.domains?.map((domainPlan, domainIndex) => (
                    <div key={domainIndex} className="bg-white/5 rounded-lg p-3">
                      <h5 className="font-medium text-white mb-2">{domainPlan.domain}</h5>
                      <p className="text-sm text-muted">
                        {domainPlan.totalEmails} emails across {domainPlan.emails?.length || 0} senders
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 p-4 bg-white/5 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-white" />
          <h4 className="font-semibold text-white">Campaign Summary</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-white font-medium">Total Recipients</p>
            <p className="text-white font-semibold">
              {campaignPlan.totalRecipients?.toLocaleString() || 0}
            </p>
          </div>
          <div>
            <p className="text-white font-medium">Total Days</p>
            <p className="text-white font-semibold">
              {campaignPlan.dailyPlans?.length || 0}
            </p>
          </div>
          <div>
            <p className="text-white font-medium">Total Emails</p>
            <p className="text-white font-semibold">
              {campaignPlan.dailyPlans?.reduce((sum, day) => sum + (day.totalEmails || 0), 0).toLocaleString() || 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignPlan;
