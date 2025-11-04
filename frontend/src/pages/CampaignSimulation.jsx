import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, Clock, Mail, TrendingUp, BarChart3, X } from 'lucide-react';
import useCampaignStore from '../store/campaignStore';
import { campaignAPI } from '../lib/api';
import { CampaignSimulationSkeleton } from '../components/SkeletonComponents';

const CampaignSimulation = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentCampaign, fetchCampaignById } = useCampaignStore();
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [day, setDay] = useState(1);
  const [selectedHour, setSelectedHour] = useState(null);
  const [showMinuteDialog, setShowMinuteDialog] = useState(false);

  useEffect(() => {
    if (currentCampaign) {
      runSimulation();
    } else {
      fetchCampaignById(id);
    }
  }, [id, currentCampaign]);

  const runSimulation = async () => {
    setLoading(true);
    try {
      const response = await campaignAPI.simulateDailyPlan(id, day);
      setSimulation(response.data.simulation);
    } catch (error) {
      console.error('Failed to run simulation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDayChange = (e) => {
    const newDay = parseInt(e.target.value);
    if (newDay >= 1) {
      setDay(newDay);
    }
  };

  const handleHourClick = (hour) => {
    setSelectedHour(hour);
    setShowMinuteDialog(true);
  };

  const closeMinuteDialog = () => {
    setShowMinuteDialog(false);
    setSelectedHour(null);
  };

  if (!currentCampaign) {
    return <CampaignSimulationSkeleton />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(`/campaigns/${id}`)} 
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-foreground">Campaign Simulation</h1>
          <p className="text-muted mt-2">
            Simulate daily email sending plans for "{currentCampaign.name}"
          </p>
        </div>
      </div>

      {/* Simulation Controls */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Simulation Parameters
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex-1">
            <label className="label">Day Number</label>
            <input
              type="number"
              value={day}
              onChange={handleDayChange}
              className="input"
              min="1"
              placeholder="Enter day number"
            />
            <p className="text-sm text-muted mt-1">
              Which day of the campaign to simulate
            </p>
          </div>
          <div className="w-full sm:w-auto">
            <button
              onClick={runSimulation}
              disabled={loading}
              className="btn btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Simulating...
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4" />
                  Run Simulation
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Simulation Results */}
      {simulation && (
        <>
          {/* Growth Metrics */}
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Growth Metrics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <p className="text-sm text-white font-medium">Day {simulation.growthMetrics.day}</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {simulation.dailyPlan.totalEmails.toLocaleString()}
                </p>
                <p className="text-xs text-white">Emails to Send</p>
              </div>
            </div>
          </div>

          {/* Daily Plan Details */}
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Daily Plan - Day {simulation.dailyPlan.day}
            </h2>
            <div className="mb-4">
              <p className="text-sm text-muted">
                <strong>Date:</strong> {simulation.dailyPlan.date} | 
                <strong> Total Emails:</strong> {simulation.dailyPlan.totalEmails.toLocaleString()}
              </p>
            </div>

            {/* Domains Breakdown */}
            <div className="space-y-6">
              {simulation.dailyPlan.domains.map((domainPlan, domainIndex) => (
                <div key={domainIndex} className="border border-white/10 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">
                      {domainPlan.domain}
                    </h3>
                    <span className="badge badge-primary">
                      {domainPlan.totalEmails.toLocaleString()} emails
                    </span>
                  </div>

                  {/* Senders for this domain */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {domainPlan.senders.map((sender, senderIndex) => (
                      <div key={senderIndex} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-white">{sender.email}</p>
                          <span className="text-sm text-muted">
                            {sender.totalEmails.toLocaleString()} emails
                          </span>
                        </div>
                        
                        {/* Hourly Distribution Grid */}
                        <div className="space-y-2">
                          <p className="text-xs text-muted font-medium">Hourly Distribution:</p>
                          <div className="grid grid-cols-6 gap-1">
                            {Array.from({ length: 24 }, (_, hourIndex) => {
                              const hour = sender.hours.find(h => h.hour === hourIndex);
                              const count = hour ? hour.count : 0;
                              const hasEmails = count > 0;
                              
                              return (
                                <button
                                  key={hourIndex}
                                  onClick={() => hour && handleHourClick(hour)}
                                  disabled={!hasEmails}
                                  className={`
                                    p-2 rounded text-xs font-medium transition-all duration-200
                                    ${hasEmails 
                                      ? 'bg-white/10 hover:bg-blue-200 text-white cursor-pointer border border-white/20' 
                                      : 'bg-white/5 text-muted cursor-not-allowed'
                                    }
                                    ${hasEmails ? 'hover:shadow-md' : ''}
                                  `}
                                >
                                  <div className="text-center">
                                    <div className="font-bold">{hourIndex.toString().padStart(2, '0')}</div>
                                    <div className="text-xs">{count}</div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          {sender.hours.length > 0 && (
                            <p className="text-xs text-muted mt-1">
                              Click on any hour to see minute breakdown
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Configuration Summary */}
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4">Configuration Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted">Base Daily Total</p>
                <p className="text-lg font-semibold text-white">
                  {simulation.dailyPlan.configuration.baseDailyTotal.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">Max Email %</p>
                <p className="text-lg font-semibold text-white">
                  {simulation.dailyPlan.configuration.maxEmailPercentage}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">Randomization</p>
                <p className="text-lg font-semibold text-white">
                  {simulation.dailyPlan.configuration.randomizationIntensity}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">Domains</p>
                <p className="text-lg font-semibold text-white">
                  {simulation.dailyPlan.configuration.domains.length}
                </p>
              </div>
            </div>

            {/* Sender Emails */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-white mb-3">Sender Emails</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {simulation.dailyPlan.senderEmails.map((email, index) => (
                  <div key={index} className="bg-white/5 rounded px-3 py-2 text-sm">
                    {email}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* No Simulation State */}
      {!simulation && !loading && (
        <div className="card text-center py-12">
          <BarChart3 className="w-16 h-16 text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Ready to Simulate</h3>
          <p className="text-muted mb-4">
            Enter a day number and total recipients to see the exact email sending plan
          </p>
          <button
            onClick={runSimulation}
            className="btn btn-primary"
          >
            Run First Simulation
          </button>
        </div>
      )}

      {/* Minute Breakdown Dialog */}
      {showMinuteDialog && selectedHour && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Minute Breakdown - {selectedHour.timeLabel}
              </h3>
              <button
                onClick={closeMinuteDialog}
                className="p-2 hover:bg-white/5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-muted">
                <strong>Total Emails:</strong> {selectedHour.count} emails
              </p>
            </div>

            {selectedHour.minuteDistribution && selectedHour.minuteDistribution.length > 0 ? (
              <div className="space-y-4">
                <h4 className="text-md font-medium text-white">Minute Distribution</h4>
                <div className="grid grid-cols-12 gap-1">
                  {selectedHour.minuteDistribution.map((minute, index) => (
                    <div
                      key={index}
                      className={`
                        p-2 rounded text-xs text-center border
                        ${minute.count > 0 
                          ? 'bg-white/10 border-white/20 text-white' 
                          : 'bg-white/5 border-white/10 text-muted'
                        }
                      `}
                    >
                      <div className="font-bold">{minute.minute.toString().padStart(2, '0')}</div>
                      <div className="text-xs">{minute.count}</div>
                    </div>
                  ))}
                </div>
                
                {/* Summary */}
                <div className="bg-white/5 p-4 rounded-lg">
                  <h5 className="text-sm font-medium text-white mb-2">Summary</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted">Total Minutes:</span>
                      <span className="font-medium ml-1">{selectedHour.minuteDistribution.length}</span>
                    </div>
                    <div>
                      <span className="text-muted">Active Minutes:</span>
                      <span className="font-medium ml-1">
                        {selectedHour.minuteDistribution.filter(m => m.count > 0).length}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">Max per Minute:</span>
                      <span className="font-medium ml-1">
                        {Math.max(...selectedHour.minuteDistribution.map(m => m.count))}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">Avg per Minute:</span>
                      <span className="font-medium ml-1">
                        {(selectedHour.count / selectedHour.minuteDistribution.length).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted">
                <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No minute-level distribution available</p>
                <p className="text-sm">This hour has {selectedHour.count} emails but no minute breakdown</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignSimulation;
