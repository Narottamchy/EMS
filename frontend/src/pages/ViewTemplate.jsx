import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { templateAPI } from '../lib/api';
import toast from 'react-hot-toast';
import { ViewTemplateSkeleton } from '../components/SkeletonComponents';

const ViewTemplate = () => {
  const navigate = useNavigate();
  const { name } = useParams();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplate();
  }, [name]);

  const loadTemplate = async () => {
    try {
      const response = await templateAPI.getByName(name);
      console.log('Template API response:', response.data);
      
      if (response.data.success && response.data.data && response.data.data.template) {
        const templateData = response.data.data.template;
        console.log('Template data:', templateData);
        setTemplate(templateData);
      } else if (response.data.template) {
        // Handle direct template response structure
        console.log('Template data (direct):', response.data.template);
        setTemplate(response.data.template);
      } else {
        console.error('Response not successful:', response.data);
        toast.error('Failed to load template');
        navigate('/templates');
      }
    } catch (error) {
      console.error('Template loading error:', error);
      toast.error('Failed to load template');
      navigate('/templates');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this template from SES?')) {
      try {
        await templateAPI.delete(name);
        toast.success('Template deleted successfully from SES');
        navigate('/templates');
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to delete template');
      }
    }
  };

  if (loading) {
    return <ViewTemplateSkeleton />;
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <p className="text-muted">Template not found</p>
        <button onClick={() => navigate('/templates')} className="btn btn-primary mt-4">
          Back to Templates
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/templates')} className="p-2 hover:bg-white/5 rounded-lg">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-4xl font-bold text-foreground">{template.name}</h1>
            <p className="text-muted mt-2">AWS SES Email Template</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/templates/${name}/edit`)}
            className="btn btn-primary"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="btn btn-danger"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Template Details */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Template Details</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted">Template Name</label>
              <p className="text-white">{template.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Subject Line</label>
              <p className="text-white">{template.subject}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Status</label>
              <span className={`badge ${template.isActive ? 'badge-success' : 'badge-gray'}`}>
                {template.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Created</label>
              <p className="text-white">{new Date(template.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Last Modified</label>
              <p className="text-white">{new Date(template.lastModified).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Template Preview */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Template Preview</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted">Subject</label>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-white">{template.subject}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">HTML Content</label>
              <div className="p-3 bg-white/5 rounded-lg max-h-64 overflow-y-auto">
                <pre className="text-sm text-muted whitespace-pre-wrap">{template.htmlBody}</pre>
              </div>
            </div>
            {template.textBody && (
              <div>
                <label className="text-sm font-medium text-muted">Text Content</label>
                <div className="p-3 bg-white/5 rounded-lg max-h-32 overflow-y-auto">
                  <pre className="text-sm text-muted whitespace-pre-wrap">{template.textBody}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HTML Preview */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">HTML Preview</h2>
        <div className="border rounded-lg overflow-hidden">
          <iframe
            srcDoc={template.htmlBody}
            className="w-full h-96"
            title="Template Preview"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
};

export default ViewTemplate;
