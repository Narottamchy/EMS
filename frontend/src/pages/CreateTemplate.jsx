import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertCircle, Wand2 } from 'lucide-react';
import { templateAPI } from '../lib/api';
import { validateHTML, generateTextFromHTML, minifyHTML } from '../utils/htmlProcessor';
import toast from 'react-hot-toast';
import { TemplateFormSkeleton } from '../components/SkeletonComponents';

const CreateTemplate = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    htmlBody: '',
    textBody: '',
  });
  const [validation, setValidation] = useState(null);
  const [isGeneratingText, setIsGeneratingText] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Minify HTML before sending to backend
      const minifiedHtml = minifyHTML(formData.htmlBody);
      const templateData = {
        ...formData,
        htmlBody: minifiedHtml,
        textBody: formData.textBody.trim()
      };
      
      await templateAPI.create(templateData);
      toast.success('Template created successfully in AWS SES!');
      navigate('/templates');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create template in SES');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    
    // Auto-validate HTML when content changes (client-side)
    if (e.target.name === 'htmlBody' && e.target.value.trim()) {
      const validationResult = validateHTML(e.target.value);
      setValidation(validationResult);
    } else if (e.target.name === 'htmlBody' && !e.target.value.trim()) {
      setValidation(null);
    }
  };

  // Generate text from HTML (client-side)
  const handleGenerateText = () => {
    if (!formData.htmlBody.trim()) {
      toast.error('Please enter HTML content first');
      return;
    }

    setIsGeneratingText(true);
    try {
      const textBody = generateTextFromHTML(formData.htmlBody);
      setFormData({ ...formData, textBody });
      toast.success('Text content generated successfully!');
    } catch (error) {
      console.error('Text generation error:', error);
      toast.error('Failed to generate text from HTML');
    } finally {
      setIsGeneratingText(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/templates')} className="p-2 hover:bg-white/5 rounded-lg">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-foreground">Create Email Template</h1>
          <p className="text-muted mt-2">Design a new email template</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <div className="space-y-4">
            <div className="form-group">
              <label htmlFor="name" className="label label-required">Template Name</label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="input"
                placeholder="e.g., welcome-email, newsletter-template"
              />
              <p className="text-sm text-muted mt-1">Template name for AWS SES (letters, numbers, hyphens, underscores only)</p>
            </div>
            <div className="form-group">
              <label htmlFor="subject" className="label label-required">Subject Line</label>
              <input
                type="text"
                id="subject"
                name="subject"
                required
                value={formData.subject}
                onChange={handleChange}
                className="input"
                placeholder="e.g., Welcome {{recipientName}}!"
              />
              <p className="text-sm text-muted mt-1">Use {'{{variableName}}'}{'}'} for dynamic content</p>
            </div>
            <div className="form-group">
              <label htmlFor="htmlBody" className="label label-required">HTML Body</label>
              <div className="relative">
                <textarea
                  id="htmlBody"
                  name="htmlBody"
                  required
                  value={formData.htmlBody}
                  onChange={handleChange}
                  className={`textarea font-mono ${
                    validation && !validation.isValid 
                      ? 'border-red-500 focus:border-red-500' 
                      : validation && validation.isValid 
                      ? 'border-green-500 focus:border-green-500' 
                      : ''
                  }`}
                  rows="10"
                  placeholder="<h1>Hello {{recipientName}}!</h1><p>Welcome to our service...</p>"
                />
              </div>
              
              {/* Validation Results */}
              {validation && (
                <div className="mt-2 space-y-1">
                  {validation.isValid ? (
                    <div className="flex items-center text-white text-sm">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      HTML is valid
                    </div>
                  ) : (
                    <div className="flex items-center text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      HTML has errors
                    </div>
                  )}
                  
                  {validation.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-2">
                      <p className="text-red-800 font-medium text-sm mb-1">Errors:</p>
                      <ul className="text-red-700 text-sm space-y-1">
                        {validation.errors.map((error, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-red-500 mr-1">•</span>
                            {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {validation.warnings.length > 0 && (
                    <div className="bg-white/5 border border-yellow-200 rounded p-2">
                      <p className="text-yellow-800 font-medium text-sm mb-1">Warnings:</p>
                      <ul className="text-white text-sm space-y-1">
                        {validation.warnings.map((warning, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-yellow-500 mr-1">•</span>
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              <p className="text-sm text-muted mt-1">HTML content with {'{{variableName}}'}{'}'} placeholders</p>
            </div>
            <div className="form-group">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="textBody" className="label">Plain Text Body</label>
                <button
                  type="button"
                  onClick={handleGenerateText}
                  disabled={!formData.htmlBody.trim() || isGeneratingText}
                  className="btn btn-secondary btn-sm"
                >
                  <Wand2 className="w-4 h-4 mr-1" />
                  {isGeneratingText ? 'Generating...' : 'Auto-Generate from HTML'}
                </button>
              </div>
              <textarea
                id="textBody"
                name="textBody"
                value={formData.textBody}
                onChange={handleChange}
                className="textarea"
                rows="5"
                placeholder="Hello {{recipientName}}! Welcome to our service..."
              />
              <p className="text-sm text-muted mt-1">Plain text version with {'{{variableName}}'}{'}'} placeholders</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button type="button" onClick={() => navigate('/templates')} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create Template
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateTemplate;
