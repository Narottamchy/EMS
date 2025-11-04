import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import useCampaignStore from '../store/campaignStore';
import { templateAPI, emailAPI, campaignAPI } from '../lib/api';
import { CreateCampaignSkeleton } from '../components/SkeletonComponents';

const EditCampaign = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { updateCampaign, fetchCampaignById, currentCampaign, isLoading } = useCampaignStore();
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [campaignLoading, setCampaignLoading] = useState(true);
  const [verifiedDomains, setVerifiedDomains] = useState([]);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [useCustomDomain, setUseCustomDomain] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    templateName: '',
    templateNames: [],
    configuration: {
      domains: [{ domain: '', emails: [''] }],
      baseDailyTotal: 4000,
      maxEmailPercentage: 35,
      randomizationIntensity: 0.7,
    },
  });

  useEffect(() => {
    loadCampaign();
    loadTemplates();
    loadVerifiedDomains();
  }, [id]);

  // Debug: Watch verified domains changes
  useEffect(() => {
    console.log('🔄 verifiedDomains changed:', verifiedDomains);
  }, [verifiedDomains]);

  const loadCampaign = async () => {
    try {
      setCampaignLoading(true);
      
      // First, fetch the campaign into the store
      const campaign = await fetchCampaignById(id);
      
      console.log('Campaign loaded:', campaign);
      
      // Handle case where campaign might not exist or is malformed
      if (!campaign) {
        console.error('Campaign not found');
        alert('Campaign not found');
        navigate('/campaigns');
        return;
      }
      
      // Transform backend structure to frontend structure
      const domainsConfig = [];
      const domainEmailMap = {};
      
      // Group sender emails by domain
      if (campaign.configuration?.senderEmails) {
        campaign.configuration.senderEmails.forEach(sender => {
          if (!domainEmailMap[sender.domain]) {
            domainEmailMap[sender.domain] = [];
          }
          // Extract email prefix (remove @domain)
          const prefix = sender.email.replace(`@${sender.domain}`, '');
          domainEmailMap[sender.domain].push(prefix);
        });
      }
      
      // Build domains array
      campaign.configuration?.domains?.forEach(domain => {
        domainsConfig.push({
          domain: domain,
          emails: domainEmailMap[domain] || ['']
        });
      });
      
      // If no domains found, add empty one
      if (domainsConfig.length === 0) {
        domainsConfig.push({ domain: '', emails: [''] });
      }
      
      setFormData({
        name: campaign.name || '',
        description: campaign.description || '',
        templateName: campaign.templateName || '',
        templateNames: campaign.templateNames || [],
        configuration: {
          domains: domainsConfig,
          baseDailyTotal: campaign.configuration?.baseDailyTotal || 4000,
          maxEmailPercentage: campaign.configuration?.maxEmailPercentage || 35,
          randomizationIntensity: campaign.configuration?.randomizationIntensity || 0.7,
          enableListUnsubscribe: campaign.configuration?.enableListUnsubscribe || false,
          unsubscribeUrl: campaign.configuration?.unsubscribeUrl || '',
        },
      });
    } catch (error) {
      console.error('Failed to load campaign:', error);
      console.error('Error details:', error.message, error.stack);
      alert('Failed to load campaign: ' + error.message);
      navigate('/campaigns');
    } finally {
      setCampaignLoading(false);
    }
  };

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
      console.log('✅ Verified domains response:', response.data);
      
      // Handle both response formats: {success: true, data: {domains: [...]}} and {domains: [...]}
      let domains = [];
      
      if (response.data.success && response.data.data) {
        // Standard format
        domains = response.data.data.domains || [];
      } else if (response.data.domains) {
        // Direct format
        domains = Array.isArray(response.data.domains) ? response.data.domains : [];
      }
      
      console.log('✅ Extracted domains:', domains);
      console.log('✅ Array check:', Array.isArray(domains), domains.length);
      setVerifiedDomains(domains);
      
    } catch (error) {
      console.error('❌ Failed to load verified domains:', error);
      setVerifiedDomains([]); // Set empty array on error
    } finally {
      setDomainsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent editing running campaigns
    if (currentCampaign?.status === 'running') {
      alert('Cannot edit a running campaign. Please pause it first.');
      navigate(`/campaigns/${id}`);
      return;
    }
    
    // Validate template selection
    if (!formData.templateNames || formData.templateNames.length === 0) {
      alert('Please select at least one email template');
      return;
    }
    
    // Validate domains and emails
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
    
    try {
      // Transform the data structure for backend compatibility
      // Backend expects:
      // - domains: ["example.com", "mysite.com"] (array of domain strings)
      // - senderEmails: [{email: "sender1@example.com", domain: "example.com", isActive: true}]
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

      // Debug log
      console.log('Updating campaign with config:', JSON.stringify(transformedConfig, null, 2));

      await updateCampaign(id, {
        ...formData,
        configuration: transformedConfig
      });

      // Trigger campaign plan regeneration if campaign is running or paused
      if (currentCampaign && (currentCampaign.status === 'running' || currentCampaign.status === 'paused')) {
        try {
          await campaignAPI.regenerateCampaignPlan(id);
          alert('Campaign updated and plan regenerated successfully!');
        } catch (error) {
          console.error('Failed to regenerate plan:', error);
          alert('Campaign updated, but plan regeneration failed. Please regenerate manually.');
        }
      } else {
        alert('Campaign updated successfully!');
      }
      
      navigate(`/campaigns/${id}`);
    } catch (error) {
      console.error('Failed to update campaign:', error);
      const errorMessage = error.response?.data?.message || error.message;
      
      // If the error is about running campaign, redirect to detail page
      if (errorMessage.includes('running campaign')) {
        alert(errorMessage);
        navigate(`/campaigns/${id}`);
      } else {
        alert('Failed to update campaign: ' + errorMessage);
      }
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

  const handleDomainChange = (index, value) => {
    const newDomains = [...formData.configuration.domains];
    newDomains[index] = { ...newDomains[index], domain: value };
    setFormData({
      ...formData,
      configuration: { ...formData.configuration, domains: newDomains },
    });
  };

  const addDomain = () => {
    const newIndex = formData.configuration.domains.length;
    setFormData({
      ...formData,
      configuration: {
        ...formData.configuration,
        domains: [...formData.configuration.domains, { domain: '', emails: [''] }],
      },
    });
    // Reset custom domain state for new domain (use dropdown by default)
    setUseCustomDomain({ ...useCustomDomain, [newIndex]: false });
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

  const addEmailToDomain = (domainIndex) => {
    const newDomains = [...formData.configuration.domains];
    newDomains[domainIndex].emails.push('');
    setFormData({
      ...formData,
      configuration: { ...formData.configuration, domains: newDomains },
    });
  };

  const removeEmailFromDomain = (domainIndex, emailIndex) => {
    const newDomains = [...formData.configuration.domains];
    newDomains[domainIndex].emails = newDomains[domainIndex].emails.filter((_, i) => i !== emailIndex);
    setFormData({
      ...formData,
      configuration: { ...formData.configuration, domains: newDomains },
    });
  };

  const handleRegeneratePlan = async () => {
    if (!window.confirm('This will regenerate the entire campaign plan. Are you sure?')) {
      return;
    }
    
    try {
      await campaignAPI.regenerateCampaignPlan(id);
      alert('Campaign plan regenerated successfully!');
    } catch (error) {
      console.error('Failed to regenerate plan:', error);
      alert('Failed to regenerate plan: ' + (error.response?.data?.message || error.message));
    }
  };

  if (templatesLoading || campaignLoading) {
    return <CreateCampaignSkeleton />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/campaigns/${id}`)} className="p-2 hover:bg-white/5 rounded-lg">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-4xl font-bold text-foreground">Edit Campaign</h1>
            <p className="text-muted mt-2">Update campaign configuration</p>
          </div>
        </div>
        
        {/* Regenerate Plan Button */}
        {currentCampaign && (currentCampaign.status === 'running' || currentCampaign.status === 'paused') && (
          <button onClick={handleRegeneratePlan} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Regenerate Plan
          </button>
        )}
      </div>

      {/* Error Banner - Cannot edit running campaign */}
      {currentCampaign?.status === 'running' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">
            ⛔ <strong>Error:</strong> Cannot edit a running campaign. Please pause the campaign first, then edit its configuration.
          </p>
        </div>
      )}

      {/* Warning Banner - Paused campaign */}
      {currentCampaign?.status === 'paused' && (
        <div className="bg-white/5 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ <strong>Warning:</strong> Updating this campaign will regenerate the plan and affect today's execution schedule.
            All queued emails will be cancelled and rescheduled based on the new configuration.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div className="form-group">
              <label htmlFor="name" className="label label-required">Campaign Name</label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="input"
                placeholder="Summer Promotion 2025"
              />
            </div>
            <div className="form-group">
              <label htmlFor="description" className="label">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="textarea"
                rows="3"
                placeholder="Campaign description..."
              />
            </div>
            <div className="form-group">
              <label htmlFor="templateNames" className="label label-required">
                Email Templates
              </label>
              <p className="text-sm text-muted mb-2">
                Select one or more templates. Recipients will randomly receive one of the selected templates.
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto border border-white/10 rounded-lg p-2">
                {templates.map((template) => (
                  <label key={template.name} className="flex items-start gap-3 p-2 hover:bg-white/5 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.templateNames.includes(template.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            templateNames: [...formData.templateNames, template.name]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            templateNames: formData.templateNames.filter(t => t !== template.name)
                          });
                        }
                      }}
                      className="mt-1 rounded"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-white">{template.name}</div>
                      <div className="text-sm text-muted">{template.subject}</div>
                    </div>
                  </label>
                ))}
              </div>
              {formData.templateNames.length === 0 && (
                <p className="text-sm text-red-600 mt-1">Please select at least one template</p>
              )}
              {formData.templateNames.length > 0 && (
                <p className="text-sm text-white mt-1">
                  {formData.templateNames.length} template{formData.templateNames.length > 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Sender Emails Configuration</h2>
          <div className="space-y-6">
            {/* Debug: Show verified domains count */}
            {verifiedDomains.length > 0 && (
              <div className="mb-4 p-2 bg-white/5 border border-white/10 rounded text-sm text-white">
                ✓ {verifiedDomains.length} verified domains loaded from SES
              </div>
            )}
            {formData.configuration.domains.map((domainData, domainIndex) => (
              <div key={domainIndex} className="p-4 border border-white/10 rounded-lg bg-white/5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <label className="label label-required">Domain {domainIndex + 1}</label>
                    {verifiedDomains.length > 0 ? (
                      !useCustomDomain[domainIndex] ? (
                        <>
                          <select
                            value={domainData.domain}
                            onChange={(e) => {
                              if (e.target.value === '__custom__') {
                                setUseCustomDomain({ ...useCustomDomain, [domainIndex]: true });
                                handleDomainChange(domainIndex, '');
                              } else if (e.target.value) {
                                handleDomainChange(domainIndex, e.target.value);
                              }
                            }}
                            className="input w-full"
                            required
                          >
                            <option value="">Select verified domain from SES</option>
                            {verifiedDomains.map((domain) => (
                              <option key={domain} value={domain}>
                                {domain}
                              </option>
                            ))}
                            <option value="__custom__" className="font-semibold text-white">
                              ➕ Add Custom Domain
                            </option>
                          </select>
                          <p className="text-xs text-muted mt-1">
                            {verifiedDomains.length} verified domain(s) from SES available
                            {domainData.domain && (
                              <span className="ml-2">
                                | <button
                                  type="button"
                                  onClick={() => {
                                    setUseCustomDomain({ ...useCustomDomain, [domainIndex]: true });
                                  }}
                                  className="text-white hover:text-white underline"
                                >
                                  Change to custom domain
                                </button>
                              </span>
                            )}
                          </p>
                        </>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={domainData.domain}
                            onChange={(e) => handleDomainChange(domainIndex, e.target.value)}
                            className="input w-full"
                            placeholder="Enter custom domain (e.g., example.com)"
                            required
                          />
                          <p className="text-xs text-muted mt-1">
                            Enter a custom domain
                            <span className="ml-2">
                              | <button
                                type="button"
                                onClick={() => {
                                  const newCustom = { ...useCustomDomain };
                                  delete newCustom[domainIndex];
                                  setUseCustomDomain(newCustom);
                                  handleDomainChange(domainIndex, '');
                                }}
                                className="text-white hover:text-white underline"
                              >
                                Select from {verifiedDomains.length} verified domain(s)
                              </button>
                            </span>
                          </p>
                        </>
                      )
                    ) : (
                      <>
                        <input
                          type="text"
                          value={domainData.domain}
                          onChange={(e) => handleDomainChange(domainIndex, e.target.value)}
                          className="input w-full"
                          placeholder="Enter domain (e.g., example.com)"
                          required
                        />
                        <p className="text-xs text-muted mt-1">
                          No verified domains found in SES. Enter domain manually.
                        </p>
                      </>
                    )}
                  </div>
                  {formData.configuration.domains.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newCustom = { ...useCustomDomain };
                        delete newCustom[domainIndex];
                        setUseCustomDomain(newCustom);
                        removeDomain(domainIndex);
                      }}
                      className="btn btn-danger ml-2 mt-6 rounded-full"
                    >
                      Remove Domain
                    </button>
                  )}
                </div>

                <div>
                  <label className="label">Email Prefixes for @{domainData.domain || 'domain.com'}</label>
                  <p className="text-xs text-muted mb-2">
                    Enter the email prefix only (before @). The domain will be automatically added.
                  </p>
                  {domainData.emails.map((email, emailIndex) => (
                    <div key={emailIndex} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={email}
                        onChange={(e) => handleEmailChange(domainIndex, emailIndex, e.target.value)}
                        className="input flex-1"
                        placeholder="sender1"
                      />
                      <div className="flex items-center px-3 bg-white/5 border border-white/10 rounded-full">
                        <span className="text-muted">@{domainData.domain || 'domain'}</span>
                      </div>
                      {domainData.emails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEmailFromDomain(domainIndex, emailIndex)}
                          className="btn btn-danger rounded-full"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addEmailToDomain(domainIndex)}
                    className="btn btn-secondary mt-2"
                  >
                    + Add Email
                  </button>
                </div>
              </div>
            ))}

            <button type="button" onClick={addDomain} className="btn btn-secondary w-full">
              + Add Another Domain
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div>
                <label htmlFor="baseDailyTotal" className="label">Base Daily Total *</label>
                <input
                  type="number"
                  id="baseDailyTotal"
                  name="config.baseDailyTotal"
                  required
                  min="1"
                  value={formData.configuration.baseDailyTotal}
                  onChange={handleChange}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="maxEmailPercentage" className="label">Max Email % *</label>
                <input
                  type="number"
                  id="maxEmailPercentage"
                  name="config.maxEmailPercentage"
                  required
                  min="1"
                  max="100"
                  value={formData.configuration.maxEmailPercentage}
                  onChange={handleChange}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="randomizationIntensity" className="label">
                  Randomization Intensity *
                </label>
                <input
                  type="number"
                  id="randomizationIntensity"
                  name="config.randomizationIntensity"
                  required
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.configuration.randomizationIntensity}
                  onChange={handleChange}
                  className="input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* List-Unsubscribe Configuration */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Email Compliance Settings</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
              <input
                type="checkbox"
                id="enableListUnsubscribe"
                checked={formData.configuration.enableListUnsubscribe || false}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    configuration: {
                      ...formData.configuration,
                      enableListUnsubscribe: e.target.checked,
                      unsubscribeUrl: e.target.checked 
                        ? (formData.configuration.unsubscribeUrl || 'https://lpv4lifyk9.execute-api.eu-west-1.amazonaws.com/Unsubscribefunction?email={{recipientEmail}}')
                        : formData.configuration.unsubscribeUrl
                    }
                  });
                }}
                className="mt-1 rounded"
              />
              <div className="flex-1">
                <label htmlFor="enableListUnsubscribe" className="label cursor-pointer">
                  Enable List-Unsubscribe Headers
                </label>
                <p className="text-sm text-muted mt-1">
                  Add List-Unsubscribe headers to emails for better inbox compliance and user experience. 
                  This allows email clients to show an unsubscribe button directly in the email header.
                </p>
              </div>
            </div>

            {formData.configuration.enableListUnsubscribe && (
              <div className="form-group">
                <label htmlFor="unsubscribeUrl" className="label">
                  Unsubscribe URL *
                </label>
                <p className="text-sm text-muted mb-2">
                  Enter the unsubscribe URL. Use <code className="text-white bg-white/10 px-1 rounded">{'{{recipientEmail}}'}</code> to automatically replace with recipient's email.
                </p>
                <input
                  type="url"
                  id="unsubscribeUrl"
                  name="config.unsubscribeUrl"
                  required={formData.configuration.enableListUnsubscribe}
                  value={formData.configuration.unsubscribeUrl || ''}
                  onChange={handleChange}
                  className="input"
                  placeholder="https://lpv4lifyk9.execute-api.eu-west-1.amazonaws.com/Unsubscribefunction?email={{recipientEmail}}"
                />
                
                {/* Quick Suggestions */}
                <div className="mt-3">
                  <label className="label text-sm">Quick Suggestions</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      {
                        value: 'https://lpv4lifyk9.execute-api.eu-west-1.amazonaws.com/Unsubscribefunction?email={{recipientEmail}}',
                        description: 'Default unsubscribe API with dynamic email'
                      },
                      {
                        value: 'https://example.com/unsubscribe?email={{recipientEmail}}',
                        description: 'Custom unsubscribe URL with email parameter'
                      }
                    ].map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            configuration: {
                              ...formData.configuration,
                              unsubscribeUrl: suggestion.value
                            }
                          });
                        }}
                        className={`p-3 text-left border rounded-xl transition-all ${
                          formData.configuration.unsubscribeUrl === suggestion.value
                            ? 'border-white/30 bg-white/10 text-white shadow-soft'
                            : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                        }`}
                      >
                        <div className="text-sm font-mono text-muted mb-1 break-all">
                          {suggestion.value}
                        </div>
                        <div className="text-xs text-muted">
                          {suggestion.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(`/campaigns/${id}`)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={isLoading || currentCampaign?.status === 'running'} 
            className="btn btn-primary"
          >
            {isLoading ? 'Updating...' : currentCampaign?.status === 'running' ? 'Cannot Edit Running Campaign' : 'Update Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditCampaign;
