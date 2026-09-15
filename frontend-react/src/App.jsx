import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { auth, clearAuth } from './lib/api';
import { Spinner } from './components/UI';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OnboardingPage from './pages/OnboardingPage';
import DiscoverPage from './pages/DiscoverPage';
import RoommatesPage from './pages/RoommatesPage';
import RoommateDetailPage from './pages/RoommateDetailPage';
import MatchesPage from './pages/MatchesPage';
import CommunitiesPage from './pages/CommunitiesPage';
import CommunityDetailPage from './pages/CommunityDetailPage';
import EventsPage from './pages/EventsPage';
import SettleInPage from './pages/SettleInPage';
import MessagesPage from './pages/MessagesPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import ShortlistPage from './pages/ShortlistPage';

const PrivateRoute = ({ children }) => {
  const isAuthenticated = auth.isAuthenticated();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const { session, user: u } = await auth.restoreSession();
      if (!session) clearAuth();
      if (isMounted) {
        setUser(u || null);
        setAuthReady(true);
      }
    };
    init();
    return () => { isMounted = false; };
  }, []);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-bg">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-text-muted text-sm font-medium">Loading Hey Nomads...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/onboarding" element={<PrivateRoute><OnboardingPage /></PrivateRoute>} />
          <Route path="/discover" element={<PrivateRoute><DiscoverPage /></PrivateRoute>} />
          <Route path="/roommates" element={<PrivateRoute><RoommatesPage /></PrivateRoute>} />
          <Route path="/roommates/:userId" element={<PrivateRoute><RoommateDetailPage /></PrivateRoute>} />
          <Route path="/matches" element={<PrivateRoute><MatchesPage /></PrivateRoute>} />
          <Route path="/communities" element={<PrivateRoute><CommunitiesPage /></PrivateRoute>} />
          <Route path="/communities/:id" element={<PrivateRoute><CommunityDetailPage /></PrivateRoute>} />
          <Route path="/events" element={<PrivateRoute><EventsPage /></PrivateRoute>} />
          <Route path="/settle" element={<PrivateRoute><SettleInPage /></PrivateRoute>} />
          <Route path="/messages" element={<PrivateRoute><MessagesPage /></PrivateRoute>} />
          <Route path="/messages/:userId" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          <Route path="/profile/:id" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          <Route path="/edit-profile" element={<PrivateRoute><EditProfilePage /></PrivateRoute>} />
          <Route path="/shortlist" element={<PrivateRoute><ShortlistPage /></PrivateRoute>} />
          <Route path="/" element={<Navigate to="/discover" replace />} />
          <Route path="*" element={<Navigate to="/discover" replace />} />
        </Routes>
      </AnimatePresence>
    </Router>
  );
}

export default App;
