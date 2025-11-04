import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { templateAPI } from '../lib/api';
import toast from 'react-hot-toast';
import { TemplatesSkeleton } from '../components/SkeletonComponents';

const Templates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await templateAPI.getAll();
      if (response.data.success) {
        setTemplates(response.data.data.templates);
      } else {
        setTemplates(response.data.templates || []);
      }
    } catch (error) {
      toast.error('Failed to load templates');
      console.error('Template loading error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateName) => {
    if (window.confirm('Are you sure you want to delete this template from SES?')) {
      try {
        await templateAPI.delete(templateName);
        setTemplates(templates.filter((t) => t.name !== templateName));
        toast.success('Template deleted successfully from SES');
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to delete template');
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Email Templates</h1>
          <p className="text-muted mt-2">Manage your email templates</p>
        </div>
        <Link to="/templates/new" className="btn btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          New Template
        </Link>
      </div>

      {loading ? (
        <TemplatesSkeleton />
      ) : templates.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-muted">No templates found</p>
          <Link to="/templates/new" className="btn btn-primary mt-6 inline-flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            Create Your First Template
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div key={template.name} className="card card-hover">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{template.name}</h3>
                  <span className="badge badge-info mt-2">SES Template</span>
                </div>
                <span className={`badge ${template.isActive ? 'badge-success' : 'badge-gray'}`}>
                  {template.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="text-sm text-muted mb-4 space-y-2">
                <p><span className="font-medium text-foreground">Subject:</span> {template.subject}</p>
                <p><span className="font-medium text-foreground">Created:</span> {new Date(template.createdAt).toLocaleDateString()}</p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="text-xs text-muted font-medium">
                  AWS SES
                </div>
                <div className="btn-group">
                  <Link
                    to={`/templates/${template.name}`}
                    className="btn btn-ghost btn-sm"
                    title="View"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  <Link
                    to={`/templates/${template.name}/edit`}
                    className="btn btn-primary btn-sm"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(template.name)}
                    className="btn btn-danger btn-sm"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Templates;
