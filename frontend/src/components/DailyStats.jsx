import { useState, useEffect } from 'react';
import { Calendar, Mail, AlertCircle, RefreshCw, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';
import { campaignAPI } from '../lib/api';

const DailyStats = ({ campaignId }) => {
  const [dailyStats, setDailyStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedDays, setExpandedDays] = useState(new Set());

  useEffect(() => {
    loadDailyStats();
  }, [campaignId]);

  const loadDailyStats = async (start = null, end = null) => {
    try {
      setLoading(true);
      const params = {};
      if (start) params.startDate = start;
      if (end) params.endDate = end;
      
      const response = await campaignAPI.getDailyStats(campaignId, params);
      setDailyStats(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load daily stats:', err);
      setError(err.response?.data?.message || 'Failed to load daily stats');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    loadDailyStats(startDate, endDate);
  };

  const handleClearFilter = () => {
    setStartDate('');
    setEndDate('');
    loadDailyStats();
  };

  const toggleDayExpansion = (dateString) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(dateString)) {
      newExpanded.delete(dateString);
    } else {
      newExpanded.add(dateString);
    }
    setExpandedDays(newExpanded);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-muted animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-6 h-6" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!dailyStats) {
    return null;
  }

  const { summary, dailyStats: stats } = dailyStats;

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="card">
        <h2 className="text-xl font-semibold text-foreground mb-4">Filter by Date Range</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-muted mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-muted mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleFilter}
            className="btn btn-primary"
            disabled={!startDate && !endDate}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Apply Filter
          </button>
          {(startDate || endDate) && (
            <button
              onClick={handleClearFilter}
              className="btn btn-secondary"
            >
              Clear Filter
            </button>
          )}
          <button
            onClick={() => loadDailyStats(startDate, endDate)}
            className="btn btn-secondary"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card card-hover">
          <p className="text-sm font-medium text-muted mb-2">Total Days</p>
          <p className="text-3xl font-bold text-foreground">{summary.totalDays}</p>
          {summary.dateRange.start && summary.dateRange.end && (
            <p className="text-xs text-muted mt-2">
              {summary.dateRange.start} to {summary.dateRange.end}
            </p>
          )}
        </div>
        <div className="card card-hover">
          <p className="text-sm font-medium text-muted mb-2">Total Sent</p>
          <p className="text-3xl font-bold text-green-600">{summary.totalSent.toLocaleString()}</p>
        </div>
        <div className="card card-hover">
          <p className="text-sm font-medium text-muted mb-2">Total Failed</p>
          <p className="text-3xl font-bold text-red-600">{summary.totalFailed.toLocaleString()}</p>
        </div>
        <div className="card card-hover">
          <p className="text-sm font-medium text-muted mb-2">Success Rate</p>
          <p className="text-3xl font-bold text-foreground">
            {summary.totalSent + summary.totalFailed > 0
              ? ((summary.totalSent / (summary.totalSent + summary.totalFailed)) * 100).toFixed(1)
              : 0}%
          </p>
        </div>
      </div>

      {/* Daily Breakdown */}
      <div className="card">
        <h2 className="text-xl font-semibold text-foreground mb-6">Daily Breakdown</h2>
        
        {stats.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No data available for the selected date range</p>
          </div>
        ) : (
          <div className="space-y-4">
            {stats.map((day) => {
              const isExpanded = expandedDays.has(day.dateString);
              const successRate = day.stats.totalSent + day.stats.totalFailed > 0
                ? ((day.stats.totalSent / (day.stats.totalSent + day.stats.totalFailed)) * 100).toFixed(1)
                : 0;

              return (
                <div key={day.dateString} className="border border-white/10 rounded-lg overflow-hidden">
                  {/* Day Header */}
                  <button
                    onClick={() => toggleDayExpansion(day.dateString)}
                    className="w-full px-6 py-4 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <Calendar className="w-5 h-5 text-primary" />
                      <div className="text-left">
                        <p className="font-semibold text-foreground">{day.dateString}</p>
                        <p className="text-sm text-muted">Campaign Day {day.campaignDay}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-muted">Sent</p>
                        <p className="font-semibold text-green-600">{day.stats.totalSent.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted">Failed</p>
                        <p className="font-semibold text-red-600">{day.stats.totalFailed.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted">Success Rate</p>
                        <p className="font-semibold text-foreground">{successRate}%</p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-6 py-4 space-y-6">
                      {/* Sender Breakdown */}
                      {day.senderBreakdown && day.senderBreakdown.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3">By Sender Email</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {day.senderBreakdown.map((sender, idx) => (
                              <div key={idx} className="p-3 bg-white/5 rounded-lg">
                                <p className="text-sm font-medium text-foreground truncate" title={sender.senderEmail}>
                                  {sender.senderEmail}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-xs">
                                  <span className="text-green-600">✓ {sender.sent}</span>
                                  <span className="text-red-600">✗ {sender.failed}</span>
                                  <span className="text-muted">⏳ {sender.queued}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hourly Breakdown */}
                      {day.hourlyBreakdown && day.hourlyBreakdown.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3">By Hour</h4>
                          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
                            {day.hourlyBreakdown
                              .sort((a, b) => a.hour - b.hour)
                              .map((hour) => (
                                <div key={hour.hour} className="p-2 bg-white/5 rounded text-center">
                                  <p className="text-xs font-medium text-muted">{hour.hour}:00</p>
                                  <p className="text-sm font-semibold text-green-600">{hour.sent}</p>
                                  {hour.failed > 0 && (
                                    <p className="text-xs text-red-600">{hour.failed} failed</p>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Recipient Domain Breakdown */}
                      {day.recipientDomainBreakdown && day.recipientDomainBreakdown.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3">By Recipient Domain</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {day.recipientDomainBreakdown
                              .sort((a, b) => b.sent - a.sent)
                              .slice(0, 12)
                              .map((domain, idx) => (
                                <div key={idx} className="p-3 bg-white/5 rounded-lg">
                                  <p className="text-sm font-medium text-foreground truncate" title={domain.domain}>
                                    {domain.domain}
                                  </p>
                                  <div className="flex items-center gap-3 mt-2 text-xs">
                                    <span className="text-green-600">✓ {domain.sent}</span>
                                    {domain.failed > 0 && (
                                      <span className="text-red-600">✗ {domain.failed}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                          {day.recipientDomainBreakdown.length > 12 && (
                            <p className="text-xs text-muted mt-2">
                              Showing top 12 of {day.recipientDomainBreakdown.length} domains
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyStats;
