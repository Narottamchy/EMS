import { useState, useEffect } from 'react';
import { 
  Mail, 
  Users, 
  UserX, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Download,
  RefreshCw,
  BarChart3,
  Calendar,
  Filter
} from 'lucide-react';
import { emailAPI } from '../lib/api';
import toast from 'react-hot-toast';

const EmailManagement = () => {
  const [activeTab, setActiveTab] = useState('emails');
  const [emails, setEmails] = useState([]);
  const [unsubscribedUsers, setUnsubscribedUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    loadStats();
    loadUnsubscribedUsers();
    if (activeTab === 'emails') {
      loadEmails();
    }
  }, [activeTab, currentPage, pageSize]);


  const loadStats = async () => {
    try {
      const response = await emailAPI.getStats();
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      // Set default stats instead of showing error
      setStats({
        totalEmails: 0,
        unsubscribedCount: 0,
        activeEmails: 0,
        unsubscribedPercentage: 0
      });
    }
  };

  const loadEmails = async () => {
    setLoading(true);
    try {
      const response = await emailAPI.getList({
        page: currentPage,
        limit: pageSize
      });
      
      // Check if response has success field or direct data
      if (response.data.success) {
        // Backend returns success wrapper
        const emailsData = response.data.data.emails || [];
        const paginationData = response.data.data.pagination || {};
        
        setEmails(emailsData);
        setPagination(paginationData);
      } else if (response.data.emails && response.data.pagination) {
        // Backend returns data directly
        const emailsData = response.data.emails || [];
        const paginationData = response.data.pagination || {};
        
        setEmails(emailsData);
        setPagination(paginationData);
      }
    } catch (error) {
      // Set empty data instead of showing error
      setEmails([]);
      setPagination({
        currentPage: 1,
        totalPages: 0,
        totalEmails: 0,
        limit: pageSize,
        hasNext: false,
        hasPrev: false
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUnsubscribedUsers = async () => {
    try {
      const response = await emailAPI.getUnsubscribed();
      
      if (response.data.success) {
        // Backend returns success wrapper
        const unsubscribedData = response.data.data.unsubscribedUsers || [];
        setUnsubscribedUsers(unsubscribedData);
      } else if (response.data.unsubscribedUsers) {
        // Backend returns data directly
        const unsubscribedData = response.data.unsubscribedUsers || [];
        setUnsubscribedUsers(unsubscribedData);
      }
    } catch (error) {
      // Set empty data instead of showing error
      setUnsubscribedUsers([]);
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const filteredEmails = emails.filter(email => 
    email.email && email.username && (
      email.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.username.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const filteredUnsubscribed = unsubscribedUsers.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex h-screen bg-white/5">
      {/* Sidebar - Unsubscribed Users */}
      <div className="w-80 bg-white border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <UserX className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-white">Unsubscribed Users</h2>
          </div>
          <p className="text-sm text-muted">
            {unsubscribedUsers.length} users have unsubscribed
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted w-4 h-4" />
              <input
                type="text"
                placeholder="Search unsubscribed users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="space-y-2 px-4">
            {filteredUnsubscribed.map((user, index) => (
              <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-white text-sm">{user.email}</p>
                    <p className="text-xs text-muted mt-1">
                      Unsubscribed: {formatDate(user.timestamp)}
                    </p>
                  </div>
                  <div className="ml-2">
                    <UserX className="w-4 h-4 text-red-500" />
                  </div>
                </div>
              </div>
            ))}
            
            {filteredUnsubscribed.length === 0 && (
              <div className="text-center py-8 text-muted">
                <UserX className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No unsubscribed users found</p>
                <p className="text-sm text-muted mt-1">
                  {searchTerm ? 'Try adjusting your search terms' : 'All users are currently subscribed'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-white/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Email Management</h1>
              <p className="text-muted mt-1">Manage your email lists and unsubscribed users</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  try {
                    await Promise.all([
                      loadStats(),
                      loadUnsubscribedUsers(),
                      activeTab === 'emails' ? loadEmails() : Promise.resolve()
                    ]);
                    toast.success('Data refreshed successfully');
                  } catch (error) {
                    // Silent error handling
                  }
                }}
                className="btn btn-secondary"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
              <button
                onClick={loadEmails}
                className="btn btn-primary"
              >
                Load Emails
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="bg-white border-b border-white/10 p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center">
                  <Mail className="w-8 h-8 text-white" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-white">Total Emails</p>
                    <p className="text-2xl font-bold text-white">{stats.totalEmails.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-white" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-white">Active Emails</p>
                    <p className="text-2xl font-bold text-white">{stats.activeEmails.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center">
                  <UserX className="w-8 h-8 text-red-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-600">Unsubscribed</p>
                    <p className="text-2xl font-bold text-red-700">{stats.unsubscribedCount.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center">
                  <BarChart3 className="w-8 h-8 text-white" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-white">Unsubscribe Rate</p>
                    <p className="text-2xl font-bold text-white">{stats.unsubscribedPercentage}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white border-b border-white/10">
          <div className="flex">
            <button
              onClick={() => setActiveTab('emails')}
              className={`px-6 py-3 font-medium text-sm border-b-2 ${
                activeTab === 'emails'
                  ? 'border-white/20 text-white'
                  : 'border-transparent text-muted hover:text-muted'
              }`}
            >
              <Mail className="w-4 h-4 mr-2 inline" />
              Email List
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'emails' && (
            <div className="h-full flex flex-col">
              {/* Search and Controls */}
              <div className="bg-white border-b border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search emails..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                      />
                    </div>
                    
                    <select
                      value={pageSize}
                      onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                      className="px-3 py-2 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={25}>25 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                    </select>
                  </div>
                  
                  <div className="text-sm text-muted">
                    {pagination && (
                      <>
                        Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to{' '}
                        {Math.min(pagination.currentPage * pagination.limit, pagination.totalEmails)} of{' '}
                        {pagination.totalEmails.toLocaleString()} emails
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Email List */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : filteredEmails.length === 0 ? (
                  <div className="bg-white">
                    <div className="text-center py-12">
                      <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">No emails found</h3>
                      <p className="text-muted mb-4">
                        {searchTerm ? 'Try adjusting your search terms' : 'No email list available'}
                      </p>
                      {!searchTerm && (
                        <p className="text-sm text-muted">
                          Make sure your S3 bucket contains the email list file
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white" key={`emails-${emails.length}-${loading}`}>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-white/5">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                              Email
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                              Username
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                              Email Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                              Received
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredEmails.length > 0 ? (
                            filteredEmails.map((email, index) => (
                              <tr key={`${email.email}-${index}`} className="hover:bg-white/5">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <Mail className="w-4 h-4 text-muted mr-2" />
                                    <span className="text-sm font-medium text-white">{email.email}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm text-white">{email.username}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-white/10 text-white">
                                    Active
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {email.hasReceivedEmail ? (
                                    <div className="flex flex-col">
                                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-white/10 text-white mb-1">
                                        Received
                                      </span>
                                      <span className="text-xs text-muted">
                                        {email.firstReceivedAt ? new Date(email.firstReceivedAt).toLocaleDateString() : 'N/A'}
                                      </span>
                                      {email.campaignsReceived > 0 && (
                                        <span className="text-xs text-muted">
                                          {email.campaignsReceived} campaign(s)
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-white/5 text-white">
                                      Not Received
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          ) : emails.length > 0 ? (
                            <tr>
                              <td colSpan="4" className="px-6 py-4 text-center text-muted">
                                <div className="p-4 bg-white/5 border border-yellow-200 rounded">
                                  <p className="text-sm text-yellow-800">
                                    <strong>Data Issue:</strong> {emails.length} emails loaded but {filteredEmails.length} filtered
                                  </p>
                                  <p className="text-xs text-white mt-1">
                                    Search term: "{searchTerm}" | First email: {emails[0]?.email}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr>
                              <td colSpan="4" className="px-6 py-4 text-center text-muted">
                                No emails to display
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {pagination && (
                <div className="bg-white border-t border-white/10 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!pagination.hasPrev}
                        className="relative inline-flex items-center px-4 py-2 border border-white/10 text-sm font-medium rounded-md text-muted bg-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Previous
                      </button>
                      
                      <div className="flex items-center mx-4">
                        <span className="text-sm text-muted">
                          Page {pagination.currentPage} of {pagination.totalPages}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!pagination.hasNext}
                        className="relative inline-flex items-center px-4 py-2 border border-white/10 text-sm font-medium rounded-md text-muted bg-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailManagement;
