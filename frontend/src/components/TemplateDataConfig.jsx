import { useState, useEffect } from 'react';
import { Settings, Code, Link, User, Mail, Calendar, Info, Check, X, Plus, Trash2, AlertCircle, FileText } from 'lucide-react';
import { campaignAPI } from '../lib/api';

const TemplateDataConfig = ({ campaignId, onSave, onCancel }) => {
  const [templatesData, setTemplatesData] = useState([]);
  const [variables, setVariables] = useState([]);
  const [templateData, setTemplateData] = useState({});
  const [customVariables, setCustomVariables] = useState([]);
  const [newCustomVariable, setNewCustomVariable] = useState({ name: '', value: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [hasVariables, setHasVariables] = useState(false);

  useEffect(() => {
    loadTemplateFields();
  }, [campaignId]);

  const loadTemplateFields = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await campaignAPI.getTemplateFields(campaignId);
      
      if (response.data.templatesData) {
        setTemplatesData(response.data.templatesData);
      }
      
      if (response.data.variables) {
        setVariables(response.data.variables);
        setHasVariables(response.data.hasVariables || false);
        
        // Initialize template data with default values
        const defaultData = {};
        response.data.variables.forEach(variable => {
          if (variable.suggestions && variable.suggestions.length > 0) {
            defaultData[variable.name] = variable.suggestions[0].value;
          }
        });
        setTemplateData(defaultData);
      }
    } catch (err) {
      console.error('Error loading template fields:', err);
      setError(err.response?.data?.message || 'Failed to load template fields');
    } finally {
      setLoading(false);
    }
  };

  const handleVariableChange = (variableName, value) => {
    setTemplateData(prev => ({
      ...prev,
      [variableName]: value
    }));
  };

  const handleAddCustomVariable = () => {
    if (!newCustomVariable.name.trim() || !newCustomVariable.value.trim()) {
      return;
    }

    const customVarName = newCustomVariable.name.trim().replace(/\s+/g, '');
    
    // Check if variable already exists
    if (templateData[customVarName] !== undefined) {
      alert('Variable already exists!');
      return;
    }

    setTemplateData(prev => ({
      ...prev,
      [customVarName]: newCustomVariable.value
    }));

    setCustomVariables(prev => [...prev, {
      name: customVarName,
      originalName: newCustomVariable.name
    }]);

    setNewCustomVariable({ name: '', value: '' });
  };

  const handleRemoveCustomVariable = (variableName) => {
    setCustomVariables(prev => prev.filter(v => v.name !== variableName));
    setTemplateData(prev => {
      const newData = { ...prev };
      delete newData[variableName];
      return newData;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await campaignAPI.saveTemplateData(campaignId, templateData);
      await onSave(templateData);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save template data');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const getVariableIcon = (type) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'url': return <Link className="w-4 h-4" />;
      case 'text': return <User className="w-4 h-4" />;
      case 'number': return <Calendar className="w-4 h-4" />;
      default: return <Code className="w-4 h-4" />;
    }
  };

  const getVariableColor = (type) => {
    switch (type) {
      case 'email': return 'text-white bg-white/5';
      case 'url': return 'text-white bg-white/5';
      case 'text': return 'text-white bg-white/5';
      case 'number': return 'text-orange-600 bg-orange-50';
      default: return 'text-muted bg-white/5';
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 rounded-lg p-6 shadow-sm">
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
      <div className="bg-white rounded-lg p-6 shadow-sm border border-red-200">
        <div className="text-center py-8">
          <div className="text-red-500 mb-2">
            <X className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Error Loading Templates</h3>
          <p className="text-muted mb-4">{error}</p>
          <button
            onClick={loadTemplateFields}
            className="btn btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-glass px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white bg-opacity-20 rounded-lg">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Template Configuration</h2>
            <p className="text-sm text-white text-opacity-90">
              Configure dynamic data for your email templates
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Template Tabs */}
        {templatesData.length > 0 && (
          <div className="mb-6 border-b border-white/10">
            <div className="flex gap-2 overflow-x-auto">
              {templatesData.map((template, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTab(index)}
                  className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTab === index
                      ? 'border-b-2 border-white/20 text-white'
                      : 'text-muted hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {template.name}
                    {template.status === 'found' && (
                      <span className="px-2 py-0.5 bg-white/10 text-white rounded-full text-xs">
                        {template.variables.length} vars
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Template Info */}
        {templatesData[activeTab] && (
          <div className="mb-6 bg-white/5 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                templatesData[activeTab].status === 'found' 
                  ? 'bg-white/10 text-white' 
                  : 'bg-red-100 text-red-600'
              }`}>
                {templatesData[activeTab].status === 'found' ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <X className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-1">
                  {templatesData[activeTab].name}
                </h3>
                {templatesData[activeTab].status === 'found' && (
                  <p className="text-sm text-muted">
                    {templatesData[activeTab].variables.length} dynamic variable(s) found
                  </p>
                )}
                {templatesData[activeTab].status === 'not_found' && (
                  <p className="text-sm text-red-600">
                    Template not found in SES
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Show message when no variables found */}
        {!hasVariables && variables.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-secondary/10 rounded-2xl mb-4">
              <Info className="w-8 h-8 text-secondary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No Dynamic Variables Found
            </h3>
            <p className="text-muted mb-6">
              None of your selected templates contain dynamic variables ({"{{variableName}}"}). 
              You can still add custom variables if needed.
            </p>
          </div>
        ) : (
          <div className="space-y-6 mb-6">
            {/* Template Variables */}
            {variables.map((variable) => (
              <div key={variable.name} className="border border-border rounded-2xl p-6 hover:border-primary/30 hover:shadow-soft transition-all bg-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2.5 rounded-xl ${getVariableColor(variable.type)}`}>
                    {getVariableIcon(variable.type)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{variable.name}</h3>
                    <p className="text-sm text-muted mt-1">{variable.description}</p>
                  </div>
                  {variable.templates && variable.templates.length > 0 && (
                    <div className="text-xs text-muted px-2 py-1 bg-white/5 rounded-lg">
                      {variable.templates.length} template{variable.templates.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="label">
                      Value
                    </label>
                    <input
                      type="text"
                      value={templateData[variable.name] || ''}
                      onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                      placeholder={`Enter value for ${variable.name}`}
                      className="input"
                    />
                  </div>

                  {variable.suggestions && variable.suggestions.length > 0 && (
                    <div>
                      <label className="label">
                        Quick Suggestions
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {variable.suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleVariableChange(variable.name, suggestion.value)}
                            className={`p-3 text-left border rounded-xl transition-all ${
                              templateData[variable.name] === suggestion.value
                                ? 'border-primary bg-primary/5 text-primary shadow-soft'
                                : 'border-border hover:border-primary/30 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-2 py-1 rounded ${
                                suggestion.type === 'static' 
                                  ? 'bg-white/5 text-muted' 
                                  : 'bg-white/10 text-white'
                              }`}>
                                {suggestion.type}
                              </span>
                            </div>
                            <div className="text-sm font-mono text-muted mb-1">
                              {suggestion.value}
                            </div>
                            <div className="text-xs text-muted">
                              {suggestion.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Custom Variables Section */}
            <div className="border-t-2 border-white/10 pt-6 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <Plus className="w-5 h-5 text-white" />
                <h3 className="text-lg font-semibold text-white">Custom Variables</h3>
                <span className="text-sm text-muted">(Optional)</span>
              </div>
              <p className="text-sm text-muted mb-4">
                Add custom variables that will be available to all templates in this campaign.
              </p>

              {/* Add Custom Variable */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Variable name (e.g., customUrl)"
                  value={newCustomVariable.name}
                  onChange={(e) => setNewCustomVariable({ ...newCustomVariable, name: e.target.value })}
                  className="px-3 py-2 input border border-white/10 rounded-md focus:outline-none focus:ring-2"
                />
                <input
                  type="text"
                  placeholder="Variable value"
                  value={newCustomVariable.value}
                  onChange={(e) => setNewCustomVariable({ ...newCustomVariable, value: e.target.value })}
                  className="px-3 py-2 input border border-white/10 rounded-md focus:outline-none focus:ring-2"
                />
                <button
                  onClick={handleAddCustomVariable}
                  className="col-span-2 px-4 py-2 btn btn-secondary text-white rounded-md  transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Custom Variable
                </button>
              </div>

              {/* List Custom Variables */}
              {customVariables.length > 0 && (
                <div className="space-y-2">
                  {customVariables.map((customVar) => (
                    <div key={customVar.name} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{customVar.name}</div>
                        <div className="text-xs text-muted">{templateData[customVar.name]}</div>
                      </div>
                      <button
                        onClick={() => handleRemoveCustomVariable(customVar.name)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-white/10">
          <div className="text-sm text-muted">
            {Object.keys(templateData).length > 0 && (
              <span className="text-white font-medium flex items-center gap-2">
                <Check className="w-4 h-4" />
                {Object.keys(templateData).length} variable{Object.keys(templateData).length > 1 ? 's' : ''} configured
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-white/10 rounded-md text-muted hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 btn btn-primary text-white rounded-md  transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Configuration
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateDataConfig;
