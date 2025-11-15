import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import useCampaignStore from '../store/campaignStore';
import { templateAPI, emailAPI, emailListAPI } from '../lib/api';
import { CreateCampaignSkeleton } from '../components/SkeletonComponents';

const CreateCustomCampaign = () => {
  const navigate = useNavigate();
  const { createCampaign, isLoading } = useCampaignStore();
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [verifiedDomains, setVerifiedDomains] = useState([]);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [emailLists, setEmailLists] = useState([]);
  const [emailListsLoading, setEmailListsLoading] = useState(true);
  const [useCustomDomain, setUseCustomDomain] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'custom_duration',
    templateName: '',
    templateNames: [],
    configuration: {
      domains: [{ domain: '', emails: [''] }],
      baseDailyTotal: 500,
      maxEmailPercentage: 35,
      randomizationIntensity: 0.7,
      enableListUnsubscribe: false,
      unsubscribeUrl: '',
      emailListSource: 'global',
      customEmailListId: '',
      customDuration: {
        enabled: true,
        startHour: 9,
        endHour: 12,
        totalEmails: 500
      }
    },
  });

  useEffect(() => {
    loadTemplates();
    loadVerifiedDomains();
    loadEmailLists();
  }, []);

  const loadTemplates = async () => {
    try {
      setTemplatesLoading(true);
      const response = await templateAPI.getAll();
      if (response.data.success) {
        setTemplates(response.data.data.templates);
      } else {
        setTemplates(response.data.templates || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const loadVerifiedDomains = async () => {
    try {
      setDomainsLoading(true);
      const response = await emailAPI.getVerifiedDomains();
      let domains = [];
      if (response.data.success && response.data.data) {
        domains = response.data.data.domains || [];
      } else if (response.data.domains) {
        domains = Array.isArray(response.data.domains) ? response.data.domains : [];
      }
      setVerifiedDomains(domains);
    } catch (error) {
      console.error('❌ Failed to load verified domains:', error);
      setVerifiedDomains([]);
    } finally {
      setDomainsLoading(false);
    }
  };

  const loadEmailLists = async () => {
    try {
      setEmailListsLoading(true);
      const response = await emailListAPI.getAll();
      setEmailLists(response.data.emailLists || []);
    } catch (error) {
      console.error('Failed to load email lists:', error);
      setEmailLists([]);
    } finally {
      setEmailListsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.templateNames || formData.templateNames.length === 0) {
      alert('Please select at least one email template');
      return;
    }
    
    if (!formData.configuration.domains || formData.configuration.domains.length === 0) {
      alert('Please add at least one domain');
      return;
    }
    
    for (const domainData of formData.configuration.domains) {
      if (!domainData.domain.trim()) {
        alert('Please enter all domain names');
        return;
      }
      if (!domainData.emails || domainData.emails.length === 0 || !domainData.emails.some(e => e.trim())) {
        alert(`Please add at least one email address for domain ${domainData.domain}`);
        return;
      }
    }

    // Validate time duration
    const { startHour, endHour, totalEmails } = formData.configuration.customDuration;
    if (startHour === endHour) {
      alert('Start hour and end hour cannot be the same');
      return;
    }
    if (totalEmails < 1) {
      alert('Total emails must be at least 1');
      return;
    }
    
    try {
      const transformedConfig = {
        ...formData.configuration,
        domains: formData.configuration.domains.map(domainData => domainData.domain.trim()),
        senderEmails: formData.configuration.domains.flatMap(domainData => {
          const domain = domainData.domain.trim();
          return domainData.emails
            .filter(e => e && e.trim())
            .map(e => ({
              email: `${e.trim()}@${domain}`,
              domain: domain,
              isActive: true
            }));
        })
      };

      const campaign = await createCampaign({
        ...formData,
        configuration: transformedConfig
      });
      
      navigate(`/campaigns/${campaign._id}`);
    } catch (error) {
      console.error('Failed to create campaign:', error);
      alert('Failed to create campaign: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('config.')) {
      const configKey = name.split('.')[1];
      setFormData({
        ...formData,
        configuration: {
          ...formData.configuration,
          [configKey]: type === 'checkbox' ? checked : value,
        },
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleCustomDurationChange = (field, value) => {
    setFormData({
      ...formData,
      configuration: {
        ...formData.configuration,
        customDuration: {
          ...formData.configuration.customDuration,
          [field]: parseInt(value)
        }
      }
    });
  };

  const handleDomainChange = (index, value) => {
    const newDomains = [...formData.configuration.domains];
    newDomains[index] = { ...newDomains[index], domain: value };
    setFormData({
      ...formData,
      configuration: { ...formData.configuration, domains: newDomains },
    });
  };

  const addDomain = () => {
    setFormData({
      ...formData,
      configuration: {
        ...formData.configuration,
        domains: [...formData.configuration.domains, { domain: '', emails: [''] }],
      },
    });
  };

  const removeDomain = (index) => {
    const newDomains = formData.configuration.domains.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      configuration: { ...formData.configuration, domains: newDomains },
    });
  };

  const handleEmailChange = (domainIndex, emailIndex, value) => {
    const newDomains = [...formData.configuration.domains];
    newDomains[domainIndex].emails[emailIndex] = value;
    setFormData({
      ...formData,
      configuration: { ...formData.configuration, domains: newDomains },
    });
  };

  const addEmail = (domainIndex) => {
    const newDomains = [...formData.configuration.domains];
    newDomains[domainIndex].emails.push('');
    setFormData({
      ...formData,
      configuration: { ...formData.configuration, domains: newDomains },
    });
  };

  const removeEmail = (domainIndex, emailIndex) => {
    const newDomains = [...formData.configuration.domains];
    newDomains[domainIndex].emails = newDomains[domainIndex].emails.filter((_, i) => i !== emailIndex);
    setFormData({
      ...formData,
      configuration: { ...formData.configuration, domains: newDomains },
    });
  };

  const handleTemplateToggle = (templateName) => {
    const currentTemplates = formData.templateNames || [];
    const newTemplates = currentTemplates.includes(templateName)
      ? currentTemplates.filter(t => t !== templateName)
      : [...currentTemplates, templateName];
    
    setFormData({
      ...formData,
      templateNames: newTemplates,
      templateName: newTemplates[0] || ''
    });
  };

  if (templatesLoading || domainsLoading || emailListsLoading) {
    return <CreateCampaignSkeleton />;
  }

  const durationHours = formData.configuration.customDuration.endHour >= formData.configuration.customDuration.startHour
    ? formData.configuration.customDuration.endHour - formData.configuration.customDuration.startHour
    : (24 - formData.configuration.customDuration.startHour) + formData.configuration.customDuration.endHour;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/campaigns')}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Clock className="w-8 h-8" />
              Create Custom Duration Campaign
            </h1>
            <p className="text-muted mt-1">Send emails within a specific time window</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Campaign Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="input w-full"
                placeholder="e.g., Product Launch - Morning Blast"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="input w-full"
                placeholder="Brief description of this campaign"
              />
            </div>
          </div>
        </div>

        {/* Time Duration Settings */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Time Duration Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Start Hour (0-23) *
              </label>
              <input
                type="number"
                min="0"
                max="23"
                value={formData.configuration.customDuration.startHour}
                onChange={(e) => handleCustomDurationChange('startHour', e.target.value)}
                required
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                End Hour (0-23) *
              </label>
              <input
                type="number"
                min="0"
                max="23"
                value={formData.configuration.customDuration.endHour}
                onChange={(e) => handleCustomDurationChange('endHour', e.target.value)}
                required
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Total Emails *
              </label>
              <input
                type="number"
                min="1"
                value={formData.configuration.customDuration.totalEmails}
                onChange={(e) => handleCustomDurationChange('totalEmails', e.target.value)}
                required
                className="input w-full"
              />
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-400">
              <Clock className="w-4 h-4 inline mr-2" />
              Duration: {durationHours} hour{durationHours !== 1 ? 's' : ''} | 
              Approx. {Math.round(formData.configuration.customDuration.totalEmails / Math.max(1, durationHours))} emails/hour
            </p>
          </div>
        </div>

        {/* Email Templates */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Email Templates *</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((template) => (
              <label
                key={template.name}
                className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  formData.templateNames?.includes(template.name)
                    ? 'border-primary bg-primary/10'
                    : 'border-glass-border hover:border-primary/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={formData.templateNames?.includes(template.name)}
                  onChange={() => handleTemplateToggle(template.name)}
                  className="mr-3"
                />
                <span className="text-white font-medium">{template.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Email List Source */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Email List Source</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="config.emailListSource"
                  value="global"
                  checked={formData.configuration.emailListSource === 'global'}
                  onChange={handleChange}
                  className="mr-2"
                />
                <span className="text-white">Global Email List</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="config.emailListSource"
                  value="custom"
                  checked={formData.configuration.emailListSource === 'custom'}
                  onChange={handleChange}
                  className="mr-2"
                />
                <span className="text-white">Custom Email List</span>
              </label>
            </div>

            {formData.configuration.emailListSource === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Select Email List *
                </label>
                <select
                  name="config.customEmailListId"
                  value={formData.configuration.customEmailListId}
                  onChange={handleChange}
                  required
                  className="input w-full"
                >
                  <option value="">Choose an email list...</option>
                  {emailLists.filter(list => list.isActive).map((list) => (
                    <option key={list._id} value={list._id}>
                      {list.name} ({list.emailCount} emails)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Domains and Sender Emails */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Domains & Sender Emails *</h2>
          <div className="space-y-4">
            {formData.configuration.domains.map((domainData, domainIndex) => (
              <div key={domainIndex} className="p-4 bg-white/5 rounded-lg space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-muted mb-2">
                      Domain {domainIndex + 1}
                    </label>
                    {useCustomDomain[domainIndex] ? (
                      <input
                        type="text"
                        value={domainData.domain}
                        onChange={(e) => handleDomainChange(domainIndex, e.target.value)}
                        className="input w-full"
                        placeholder="example.com"
                      />
                    ) : (
                      <select
                        value={domainData.domain}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setUseCustomDomain({ ...useCustomDomain, [domainIndex]: true });
                            handleDomainChange(domainIndex, '');
                          } else {
                            handleDomainChange(domainIndex, e.target.value);
                          }
                        }}
                        className="input w-full"
                      >
                        <option value="">Select verified domain...</option>
                        {verifiedDomains.map((domain) => (
                          <option key={domain} value={domain}>
                            {domain}
                          </option>
                        ))}
                        <option value="__custom__">+ Enter custom domain</option>
                      </select>
                    )}
                  </div>
                  {formData.configuration.domains.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDomain(domainIndex)}
                      className="btn-secondary px-3 self-end"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted">
                    Sender Email Addresses (without @domain)
                  </label>
                  {domainData.emails.map((email, emailIndex) => (
                    <div key={emailIndex} className="flex gap-2">
                      <input
                        type="text"
                        value={email}
                        onChange={(e) => handleEmailChange(domainIndex, emailIndex, e.target.value)}
                        className="input flex-1"
                        placeholder="sender"
                      />
                      <span className="flex items-center text-muted px-2">
                        @{domainData.domain || 'domain.com'}
                      </span>
                      {domainData.emails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEmail(domainIndex, emailIndex)}
                          className="btn-secondary px-3"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addEmail(domainIndex)}
                    className="btn-secondary text-sm"
                  >
                    + Add Email
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addDomain}
              className="btn-secondary"
            >
              + Add Domain
            </button>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Advanced Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Max Email Percentage (%)
              </label>
              <input
                type="number"
                name="config.maxEmailPercentage"
                value={formData.configuration.maxEmailPercentage}
                onChange={handleChange}
                min="1"
                max="100"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Randomization Intensity (0-1)
              </label>
              <input
                type="number"
                name="config.randomizationIntensity"
                value={formData.configuration.randomizationIntensity}
                onChange={handleChange}
                min="0"
                max="1"
                step="0.1"
                className="input w-full"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/campaigns')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? 'Creating...' : 'Create Custom Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateCustomCampaign;
