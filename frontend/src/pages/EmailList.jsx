import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Download, Users, Mail, Filter } from 'lucide-react';
import { emailAPI } from '../lib/api';
import toast from 'react-hot-toast';
import { EmailListSkeleton } from '../components/SkeletonComponents';

const EmailList = () => {
  const [emails, setEmails] = useState([]);
  const [filteredEmails, setFilteredEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalEmails: 0,
    limit: 50,
    hasNext: false,
    hasPrev: false
  });
  const [pageInput, setPageInput] = useState('');

  useEffect(() => {
    loadEmails(1, 50, true);
  }, []);

  useEffect(() => {
    // Filter emails based on search term
    if (!searchTerm.trim()) {
      setFilteredEmails(emails);
    } else {
      const filtered = emails.filter(email => 
        email.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.username.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredEmails(filtered);
    }
  }, [emails, searchTerm]);

  const loadEmails = async (page = 1, pageSize = 50, isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setListLoading(true);
      }
      
      const response = await emailAPI.getList({
        page,
        limit: pageSize
      });
      
      console.log('Email list API response:', response.data);
      
      if (response.data.success) {
        const emailsData = response.data.data.emails || [];
        const paginationData = response.data.data.pagination || {};
        setEmails(emailsData);
        setFilteredEmails(emailsData);
        setPagination(paginationData);
      } else if (response.data.emails && response.data.pagination) {
        const emailsData = response.data.emails || [];
        const paginationData = response.data.pagination || {};
        setEmails(emailsData);
        setFilteredEmails(emailsData);
        setPagination(paginationData);
      } else {
        console.log('API response format not recognized:', response.data);
        setEmails([]);
        setFilteredEmails([]);
      }
    } catch (error) {
      console.error('Failed to load emails:', error);
      toast.error('Failed to load email list');
      setEmails([]);
      setFilteredEmails([]);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setListLoading(false);
      }
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadEmails(newPage, pagination.limit, false);
    }
  };

  const handlePageInputChange = (e) => {
    const value = e.target.value;
    if (value === '' || (Number(value) >= 1 && Number(value) <= pagination.totalPages)) {
      setPageInput(value);
    }
  };

  const handlePageInputSubmit = (e) => {
    e.preventDefault();
    const pageNumber = parseInt(pageInput);
    if (pageNumber >= 1 && pageNumber <= pagination.totalPages) {
      handlePageChange(pageNumber);
      setPageInput('');
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  if (loading) {
    return <EmailListSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-foreground">Email List</h1>
              <p className="text-muted mt-2">Manage your email recipients</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card hover-lift relative overflow-hidden">
          <div className="flex items-center">
            <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl relative overflow-hidden">
              <Users className="w-6 h-6 text-black relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shimmer"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted">Total Emails</p>
              <p className="text-2xl font-bold text-white">{pagination.totalEmails.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="card hover-lift relative overflow-hidden">
          <div className="flex items-center">
            <div className="p-3 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl relative overflow-hidden">
              <Mail className="w-6 h-6 text-black relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shimmer"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted">Current Page</p>
              <p className="text-2xl font-bold text-white">{pagination.currentPage}</p>
            </div>
          </div>
        </div>
        
        <div className="card hover-lift relative overflow-hidden">
          <div className="flex items-center">
            <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl relative overflow-hidden">
              <Filter className="w-6 h-6 text-black relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shimmer"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted">Showing</p>
              <p className="text-2xl font-bold text-white">{filteredEmails.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted w-5 h-5" />
              <input
                type="text"
                placeholder="Search emails or usernames..."
                value={searchTerm}
                onChange={handleSearch}
                className="input pl-10 w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="card">
        <div className="px-6 py-4">
          <h3 className="text-lg font-medium text-white">Email Subscribers</h3>
        </div>
        
        {listLoading ? (
          <div className="p-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <div className="h-4 bg-white/10 rounded animate-pulse flex-1"></div>
                  <div className="h-4 bg-white/10 rounded animate-pulse w-24"></div>
                  <div className="h-4 bg-white/10 rounded animate-pulse w-16"></div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="p-8 text-center">
            <Mail className="w-12 h-12 text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No emails found</h3>
            <p className="text-muted">
              {searchTerm ? 'Try adjusting your search terms' : 'No email subscribers available'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto rounded-xl">
              <table className="min-w-full divide-y divide-gray-500">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Username
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Domain
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Received
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/5 divide-y divide-gray-800">
                  {filteredEmails.map((email, index) => (
                    <tr key={index} className="hover:bg-white/5">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {email.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                        {email.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                        {email.email.split('@')[1]}
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
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden">
              {filteredEmails.map((email, index) => (
                <div key={index} className="p-4 border-b border-white/10 last:border-b-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {email.email}
                      </p>
                      <p className="text-sm text-muted truncate">
                        @{email.username}
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {email.email.split('@')[1]}
                      </p>
                      {email.hasReceivedEmail ? (
                        <div className="mt-2 flex flex-col">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-white/10 text-white w-fit mb-1">
                            Received
                          </span>
                          {email.firstReceivedAt && (
                            <span className="text-xs text-muted">
                              {new Date(email.firstReceivedAt).toLocaleDateString()}
                            </span>
                          )}
                          {email.campaignsReceived > 0 && (
                            <span className="text-xs text-muted">
                              {email.campaignsReceived} campaign(s)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-white/5 text-white mt-2 w-fit">
                          Not Received
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Enhanced Pagination */}
      {pagination.totalPages > 1 && (
        <div className="card">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Page Info */}
            <div className="flex items-center text-sm text-muted">
              <span>
                Page {pagination.currentPage} of {pagination.totalPages} 
                <span className="text-muted ml-1">
                  ({pagination.totalEmails.toLocaleString()} total emails)
                </span>
              </span>
            </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center gap-3">
              {/* Previous Button */}
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={!pagination.hasPrev}
                className="btn btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              {/* Page Numbers */}
              <div className="flex items-center gap-2">
                {/* First Page */}
                {pagination.currentPage > 3 && (
                  <>
                    <button
                      onClick={() => handlePageChange(1)}
                      className="btn btn-ghost btn-sm"
                    >
                      1
                    </button>
                    {pagination.currentPage > 4 && <span className="text-muted">...</span>}
                  </>
                )}
                
                {/* Previous Page */}
                {pagination.currentPage > 1 && (
                  <button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    className="btn btn-ghost btn-sm"
                  >
                    {pagination.currentPage - 1}
                  </button>
                )}
                
                {/* Current Page */}
                <span className="px-3 py-1 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-sm">
                  {pagination.currentPage}
                </span>
                
                {/* Next Page */}
                {pagination.currentPage < pagination.totalPages && (
                  <button
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    className="btn btn-ghost btn-sm"
                  >
                    {pagination.currentPage + 1}
                  </button>
                )}
                
                {/* Last Page */}
                {pagination.currentPage < pagination.totalPages - 2 && (
                  <>
                    {pagination.currentPage < pagination.totalPages - 3 && <span className="text-muted">...</span>}
                    <button
                      onClick={() => handlePageChange(pagination.totalPages)}
                      className="btn btn-ghost btn-sm"
                    >
                      {pagination.totalPages}
                    </button>
                  </>
                )}
              </div>
              
              {/* Next Button */}
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={!pagination.hasNext}
                className="btn btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            
            {/* Go to Page Input */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">Go to:</span>
              <form onSubmit={handlePageInputSubmit} className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={pagination.totalPages}
                  value={pageInput}
                  onChange={handlePageInputChange}
                  placeholder="Page"
                  className="w-16 px-2 py-1 text-sm bg-white/5 border border-white/10 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-white/20"
                />
                <button
                  type="submit"
                  disabled={!pageInput || pageInput < 1 || pageInput > pagination.totalPages}
                  className="btn btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Go
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailList;
