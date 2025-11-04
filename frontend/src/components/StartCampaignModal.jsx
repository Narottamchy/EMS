import { useState } from 'react';
import { X, Settings, Play, AlertCircle, Mail } from 'lucide-react';
import TemplateDataConfig from './TemplateDataConfig';

const StartCampaignModal = ({ isOpen, onClose, campaignId, onStart, campaignName, campaign }) => {
  const [showTemplateConfig, setShowTemplateConfig] = useState(false);
  const [templateData, setTemplateData] = useState({});
  const [starting, setStarting] = useState(false);
  
  // Get templates from campaign
  const templates = campaign?.templateNames && campaign.templateNames.length > 0 
    ? campaign.templateNames 
    : (campaign?.templateName ? [campaign.templateName] : []);

  const handleStartCampaign = async () => {
    try {
      setStarting(true);
      // Pass template data even if empty
      await onStart(templateData);
      onClose();
    } catch (error) {
      console.error('Failed to start campaign:', error);
      alert(error.response?.data?.message || 'Failed to start campaign');
    } finally {
      setStarting(false);
    }
  };

  const handleTemplateDataSave = (data) => {
    setTemplateData(data);
    setShowTemplateConfig(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between p-8 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent rounded-xl shadow-soft">
              <Play className="w-7 h-7 text-black" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Start Campaign</h2>
              <p className="text-sm text-muted mt-1">{campaignName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-all p-2 hover:bg-white/5 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto max-h-[calc(90vh-220px)] bg-background">
          {!showTemplateConfig ? (
            <div className="space-y-6">
              {/* Show templates being used */}
              {templates.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-6 shadow-soft">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-accent/10 rounded-xl">
                      <Mail className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {templates.length > 1 ? 'Email Templates' : 'Email Template'}
                    </h3>
                  </div>
                  <p className="text-sm text-muted mb-4">
                    {templates.length > 1 
                      ? 'Recipients will randomly receive one of the following templates:'
                      : 'All recipients will receive the following template:'}
                  </p>
                  <div className="space-y-2">
                    {templates.map((template, index) => (
                      <div key={index} className="bg-background rounded-xl px-4 py-3 border border-border hover:border-accent/30 transition-all">
                        <span className="font-medium text-foreground">{template}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="bg-card border border-border rounded-2xl p-6 shadow-soft">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-secondary/10 rounded-xl flex-shrink-0">
                    <Settings className="w-5 h-5 text-secondary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-2">Template Configuration</h3>
                    <p className="text-sm text-muted mb-4">
                      Configure dynamic variables ({"{{variableName}}"}) or add custom data for your templates.
                    </p>
                    <button
                      onClick={() => setShowTemplateConfig(true)}
                      className="btn btn-secondary flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Configure Variables
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <TemplateDataConfig
              campaignId={campaignId}
              onSave={handleTemplateDataSave}
              onCancel={() => setShowTemplateConfig(false)}
            />
          )}
        </div>

        <div className="flex items-center justify-between p-8 border-t border-border bg-card">
          <div className="text-sm">
            {Object.keys(templateData).length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 rounded-xl border border-accent/20">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                <span className="text-accent font-semibold">
                  {Object.keys(templateData).length} variable{Object.keys(templateData).length > 1 ? 's' : ''} configured
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleStartCampaign}
              disabled={starting}
              className="btn btn-primary flex items-center gap-2"
            >
              {starting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Campaign
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StartCampaignModal;
