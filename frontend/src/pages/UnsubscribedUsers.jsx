import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Download, UserX, Mail, Filter } from 'lucide-react';
import { emailAPI } from '../lib/api';
import toast from 'react-hot-toast';
import { UnsubscribedUsersSkeleton } from '../components/SkeletonComponents';

const UnsubscribedUsers = () => {
  const [unsubscribedUsers, setUnsubscribedUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadUnsubscribedUsers(true);
  }, []);

  useEffect(() => {
    // Filter users based on search term
    if (!searchTerm.trim()) {
      setFilteredUsers(unsubscribedUsers);
    } else {
      const filtered = unsubscribedUsers.filter(user => 
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [unsubscribedUsers, searchTerm]);

  const loadUnsubscribedUsers = async (isInitialLoad = true) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setListLoading(true);
      }
      
      const response = await emailAPI.getUnsubscribed();
      
      console.log('Unsubscribed users API response:', response.data);
      
      if (response.data.success) {
        const usersData = response.data.data.unsubscribedUsers || [];
        const cleaned = usersData.length > 0 ? usersData.slice(1) : usersData; // drop header row
        setUnsubscribedUsers(cleaned);
        setFilteredUsers(cleaned);
      } else if (response.data.unsubscribedUsers) {
        const usersData = response.data.unsubscribedUsers || [];
        const cleaned = usersData.length > 0 ? usersData.slice(1) : usersData; // drop header row
        setUnsubscribedUsers(cleaned);
        setFilteredUsers(cleaned);
      } else {
        console.log('API response format not recognized:', response.data);
        setUnsubscribedUsers([]);
        setFilteredUsers([]);
      }
    } catch (error) {
      console.error('Failed to load unsubscribed users:', error);
      toast.error('Failed to load unsubscribed users');
      setUnsubscribedUsers([]);
      setFilteredUsers([]);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setListLoading(false);
      }
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleExport = () => {
    try {
      // Prepare CSV headers
      const headers = ['Email', 'Unsubscribed At', 'Domain'];
      // Build CSV rows from filteredUsers
      const rows = filteredUsers.map(u => {
        const email = u.email || '';
        const unsubAt = u.unsubscribedAt ? formatDate(u.unsubscribedAt) : '';
        const domain = (u.email || '').includes('@') ? u.email.split('@')[1] : '';
        return [email, unsubAt, domain];
      });

      // Convert to CSV string
      const escapeCell = (cell) => {
        if (cell == null) return '';
        const str = String(cell);
        // Escape quotes and wrap if needed
        const needsWrap = str.includes(',') || str.includes('"') || str.includes('\n');
        const escaped = str.replace(/"/g, '""');
        return needsWrap ? `"${escaped}"` : escaped;
      };

      const csvLines = [headers, ...rows].map(line => line.map(escapeCell).join(','));
      const csvContent = '\ufeff' + csvLines.join('\n'); // BOM for Excel compatibility

      // Trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `unsubscribed-users-${ts}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Exported CSV successfully');
    } catch (error) {
      console.error('CSV export failed:', error);
      toast.error('Failed to export CSV');
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  if (loading) {
    return <UnsubscribedUsersSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div>
            <h1 className="text-4xl font-bold text-foreground">Unsubscribed Users</h1>
            <p className="text-muted mt-2">Manage users who have unsubscribed</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleExport}
            className="btn btn-secondary inline-flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card hover-lift relative overflow-hidden">
          <div className="flex items-center">
            <div className="p-3 bg-gradient-to-br from-red-100 to-red-200 rounded-xl relative overflow-hidden">
              <UserX className="w-6 h-6 text-black relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shimmer"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted">Total Unsubscribed</p>
              <p className="text-2xl font-bold text-white">{unsubscribedUsers.length.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="card hover-lift relative overflow-hidden">
          <div className="flex items-center">
            <div className="p-3 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl relative overflow-hidden">
              <Mail className="w-6 h-6 text-black relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shimmer"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted">Showing</p>
              <p className="text-2xl font-bold text-white">{filteredUsers.length}</p>
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
              <p className="text-sm font-medium text-muted">Filtered</p>
              <p className="text-2xl font-bold text-white">
                {searchTerm ? filteredUsers.length : 'All'}
              </p>
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
                placeholder="Search unsubscribed emails..."
                value={searchTerm}
                onChange={handleSearch}
                className="input pl-10 w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Unsubscribed Users List */}
      <div className="card">
        <div className="px-6 py-4">
          <h3 className="text-lg font-medium text-white">Unsubscribed Users</h3>
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
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center">
            <UserX className="w-12 h-12 text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No unsubscribed users found</h3>
            <p className="text-muted">
              {searchTerm ? 'Try adjusting your search terms' : 'No users have unsubscribed yet'}
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
                      Unsubscribed At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Domain
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/5 divide-y divide-gray-800">
                  {filteredUsers.map((user, index) => (
                    <tr key={index} className="hover:bg-white/5">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                        {formatDate(user.unsubscribedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                        {user.email.split('@')[1]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden">
              {filteredUsers.map((user, index) => (
                <div key={index} className="p-4 border-b border-white/10 last:border-b-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {user.email}
                      </p>
                      <p className="text-sm text-muted mt-1">
                        Unsubscribed: {formatDate(user.unsubscribedAt)}
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {user.email.split('@')[1]}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UnsubscribedUsers;
