import { useState, useEffect } from 'react';
import { Upload, Trash2, Eye, Plus, FileText, Calendar, Users } from 'lucide-react';
import { emailListAPI } from '../lib/api';

export default function EmailLists() {
  const [emailLists, setEmailLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    file: null
  });
  const [previewData, setPreviewData] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    fetchEmailLists();
  }, []);

  const fetchEmailLists = async () => {
    try {
      setLoading(true);
      const response = await emailListAPI.getAll();
      setEmailLists(response.data.emailLists);
    } catch (error) {
      console.error('Failed to fetch email lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadForm({ ...uploadForm, file });
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!uploadForm.file || !uploadForm.name) {
      alert('Please provide a name and select a file');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('name', uploadForm.name);
      formData.append('description', uploadForm.description);

      await emailListAPI.upload(formData);
      
      setShowUploadModal(false);
      setUploadForm({ name: '', description: '', file: null });
      fetchEmailLists();
      alert('Email list uploaded successfully!');
    } catch (error) {
      console.error('Upload failed:', error);
      alert(error.response?.data?.message || 'Failed to upload email list');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      await emailListAPI.delete(id);
      fetchEmailLists();
      alert('Email list deleted successfully');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete email list');
    }
  };

  const handlePreview = async (id, name) => {
    try {
      const response = await emailListAPI.getPreview(id, { limit: 50 });
      setPreviewData({ ...response.data, name });
      setShowPreviewModal(true);
    } catch (error) {
      console.error('Preview failed:', error);
      alert('Failed to load preview');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Email Lists</h1>
          <p className="text-muted mt-2">Manage your custom email lists for campaigns</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-soft hover:shadow-glow"
        >
          <Plus className="w-5 h-5" />
          Upload Email List
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : emailLists.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-16 h-16 text-muted mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No Email Lists</h3>
          <p className="text-muted mb-6">Upload your first email list to get started</p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-soft"
          >
            <Plus className="w-5 h-5" />
            Upload Email List
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {emailLists.map((list) => (
            <div key={list._id} className="card p-6 hover:shadow-glow transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-1">{list.name}</h3>
                  {list.description && (
                    <p className="text-sm text-muted line-clamp-2">{list.description}</p>
                  )}
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-lg ${
                  list.type === 'global' 
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}>
                  {list.type}
                </span>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Users className="w-4 h-4" />
                  <span>{list.emailCount.toLocaleString()} emails</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted">
                  <FileText className="w-4 h-4" />
                  <span className="truncate">{list.fileName} ({formatFileSize(list.fileSize)})</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(list.createdAt)}</span>
                </div>
                {list.metadata?.usageCount > 0 && (
                  <div className="text-sm text-muted">
                    Used in {list.metadata.usageCount} campaign{list.metadata.usageCount !== 1 ? 's' : ''}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-glass-border">
                <button
                  onClick={() => handlePreview(list._id, list.name)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-white/5 text-foreground rounded-lg hover:bg-white/10 transition-all border border-white/10"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                {list.type !== 'global' && (
                  <button
                    onClick={() => handleDelete(list._id, list.name)}
                    className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all border border-red-500/30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card max-w-md w-full mx-4">
            <div className="p-6 border-b border-glass-border">
              <h2 className="text-xl font-semibold text-foreground">Upload Email List</h2>
            </div>
            
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="label">
                  List Name *
                </label>
                <input
                  type="text"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  className="input"
                  placeholder="e.g., Q4 2024 Prospects"
                  required
                />
              </div>

              <div>
                <label className="label">
                  Description
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  className="input resize-none"
                  placeholder="Optional description"
                  rows="3"
                />
              </div>

              <div>
                <label className="label">
                  CSV File *
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-white/10 border-dashed rounded-xl hover:border-white/20 transition-colors bg-white/5">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-muted" />
                    <div className="flex text-sm text-muted">
                      <label className="relative cursor-pointer rounded-md font-medium text-blue-400 hover:text-blue-300">
                        <span>Upload a file</span>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleFileChange}
                          className="sr-only"
                          required
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-muted">CSV file with "email" column</p>
                    {uploadForm.file && (
                      <p className="text-sm text-green-400 font-medium mt-2">{uploadForm.file.name}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadForm({ name: '', description: '', file: null });
                  }}
                  className="flex-1 px-4 py-2 border border-white/10 text-muted rounded-xl hover:bg-white/5 transition-all"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-soft"
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-glass-border">
              <h2 className="text-xl font-semibold text-foreground">Preview: {previewData.name}</h2>
              <p className="text-sm text-muted mt-1">
                Showing {previewData.previewCount} of {previewData.emailList.totalCount} emails
              </p>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              <div className="space-y-2">
                {previewData.emails.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                    <div className="w-8 h-8 bg-blue-500/20 text-blue-300 rounded-full flex items-center justify-center text-sm font-medium border border-blue-500/30">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{item.email}</div>
                      <div className="text-sm text-muted truncate">{item.username}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-glass-border">
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewData(null);
                }}
                className="w-full px-4 py-3 bg-white/5 text-foreground rounded-xl hover:bg-white/10 transition-all border border-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
