import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import socketService from './lib/socket';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import CampaignSimulation from './pages/CampaignSimulation';
import CreateCampaign from './pages/CreateCampaign';
import EditCampaign from './pages/EditCampaign';
import Templates from './pages/Templates';
import CreateTemplate from './pages/CreateTemplate';
import ViewTemplate from './pages/ViewTemplate';
import EditTemplate from './pages/EditTemplate';
import EmailList from './pages/EmailList';
import UnsubscribedUsers from './pages/UnsubscribedUsers';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Initialize WebSocket connection when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      socketService.connect();
    } else {
      socketService.disconnect();
    }
  }, [isAuthenticated]);

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="campaigns/new" element={<CreateCampaign />} />
          <Route path="campaigns/:id" element={<CampaignDetail />} />
          <Route path="campaigns/:id/edit" element={<EditCampaign />} />
          <Route path="campaigns/:id/simulate" element={<CampaignSimulation />} />
              <Route path="templates" element={<Templates />} />
              <Route path="templates/new" element={<CreateTemplate />} />
              <Route path="templates/:name" element={<ViewTemplate />} />
              <Route path="templates/:name/edit" element={<EditTemplate />} />
              <Route path="emails" element={<EmailList />} />
              <Route path="unsubscribed" element={<UnsubscribedUsers />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
