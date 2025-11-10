import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import useCampaignStore from '../store/campaignStore';
import { templateAPI, emailAPI, emailListAPI } from '../lib/api';
import { CreateCampaignSkeleton } from '../components/SkeletonComponents';

const CreateCampaign = () => {
  const navigate = useNavigate();
  const { createCampaign, isLoading } = useCampaignStore();
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [verifiedDomains, setVerifiedDomains] = useState([]);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [emailLists, setEmailLists] = useState([]);
  const [emailListsLoading, setEmailListsLoading] = useState(true);
  const [useCustomDomain, setUseCustomDomain] = useState({}); // Track which domain uses custom input
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
      enableListUnsubscribe: false,
      unsubscribeUrl: '',
      emailListSource: 'global',
      customEmailListId: '',
      warmupMode: {
        enabled: false,
        currentIndex: 0
      }
    },
  });

  useEffect(() => {
    loadTemplates();
    loadVerifiedDomains();
    loadEmailLists();
  }, []);

  // Debug: Watch verified domains changes
  useEffect(() => {
    console.log('🔄 verifiedDomains changed:', verifiedDomains);
  }, [verifiedDomains]);

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
      console.log('Submitting campaign with config:', JSON.stringify(transformedConfig, null, 2));

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



  if (templatesLoading) {
    return <CreateCampaignSkeleton />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/campaigns')} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
          <ArrowLeft className="w-6 h-6 text-muted" />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-foreground">Create New Campaign</h1>
          <p className="text-muted mt-2">Set up a new email campaign</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="card">
          <h2 className="text-xl font-semibold text-foreground mb-6">Basic Information</h2>
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
              <p className="text-sm text-muted mb-3">
                Select one or more templates. Recipients will randomly receive one of the selected templates.
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto border border-border rounded-xl p-3">
                {templates.map((template) => (
                  <label key={template.name} className="flex items-start gap-3 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors">
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
                      <div className="font-medium text-foreground">{template.name}</div>
                      <div className="text-sm text-muted mt-1">{template.subject}</div>
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
                    {/* Debug: verifiedDomains.length = {verifiedDomains.length}, useCustomDomain[{domainIndex}] = {String(useCustomDomain[domainIndex])} */}
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

        {/* Email List Selection */}
        <div className="card">
          <h2 className="text-xl font-semibold text-foreground mb-4">Email List Configuration</h2>
          <div className="space-y-4">
            <div className="form-group">
              <label className="label">Email List Source *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    configuration: {
                      ...formData.configuration,
                      emailListSource: 'global',
                      customEmailListId: ''
                    }
                  })}
                  className={`p-4 text-left border rounded-xl transition-all ${
                    formData.configuration.emailListSource === 'global'
                      ? 'border-white/30 bg-white/10 text-white shadow-soft'
                      : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <div className="font-medium mb-1">Global Email List</div>
                  <div className="text-sm text-muted">Use the default global email list from S3</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    configuration: {
                      ...formData.configuration,
                      emailListSource: 'custom'
                    }
                  })}
                  className={`p-4 text-left border rounded-xl transition-all ${
                    formData.configuration.emailListSource === 'custom'
                      ? 'border-white/30 bg-white/10 text-white shadow-soft'
                      : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <div className="font-medium mb-1">Custom Email List</div>
                  <div className="text-sm text-muted">Select from your uploaded email lists</div>
                </button>
              </div>
            </div>

            {formData.configuration.emailListSource === 'custom' && (
              <div className="form-group">
                <label htmlFor="customEmailListId" className="label">Select Email List *</label>
                {emailListsLoading ? (
                  <div className="text-sm text-muted">Loading email lists...</div>
                ) : emailLists.length === 0 ? (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm text-yellow-200">
                      No custom email lists available. Please upload an email list first.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/email-lists')}
                      className="mt-2 text-sm text-yellow-200 underline hover:text-yellow-100"
                    >
                      Go to Email Lists
                    </button>
                  </div>
                ) : (
                  <select
                    id="customEmailListId"
                    value={formData.configuration.customEmailListId}
                    onChange={(e) => setFormData({
                      ...formData,
                      configuration: {
                        ...formData.configuration,
                        customEmailListId: e.target.value
                      }
                    })}
                    className="input"
                    required={formData.configuration.emailListSource === 'custom'}
                  >
                    <option value="">Select an email list</option>
                    {emailLists.map((list) => (
                      <option key={list._id} value={list._id}>
                        {list.name} ({list.emailCount.toLocaleString()} emails)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Warmup Mode */}
            <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
              <input
                type="checkbox"
                id="warmupMode"
                checked={formData.configuration.warmupMode?.enabled || false}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    configuration: {
                      ...formData.configuration,
                      warmupMode: {
                        enabled: e.target.checked,
                        currentIndex: 0
                      }
                    }
                  });
                }}
                className="mt-1 rounded"
              />
              <div className="flex-1">
                <label htmlFor="warmupMode" className="label cursor-pointer">
                  Enable Warmup Mode
                </label>
                <p className="text-sm text-muted mt-1">
                  Cycle through the email list continuously. When the campaign reaches the end of the list, 
                  it will automatically restart from the beginning. Perfect for warming up domains with a limited email list.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* List-Unsubscribe Configuration */}
        <div className="card">
          <h2 className="text-xl font-semibold text-foreground mb-4">Email Compliance Settings</h2>
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
            onClick={() => navigate('/campaigns')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button type="submit" disabled={isLoading} className="btn btn-primary">
            {isLoading ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateCampaign;
