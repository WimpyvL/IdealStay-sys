import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ExplorePage from './pages/ExplorePage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import HostDashboardPage from './pages/HostDashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import MessagesPage from './pages/MessagesPage';
import BookingsPage from './pages/BookingsPage';
import PropertyDetailPage from './pages/PropertyDetailPage';
import BookingDetailPage from './pages/BookingDetailPage';
import FinancialsPage from './pages/FinancialsPage';
import SettingsPage from './pages/SettingsPage';
import BecomeHostModal from './components/BecomeHostModal';
import SignInModal from './components/SignInModal';
import ResetPasswordModal from './components/ResetPasswordModal';
import SignUpModal from './components/SignUpModal';
import { AuthProvider, useAuthState, useAuthActions } from './src/contexts/AuthContext';
import { ToastProvider } from './components/toast/ToastProvider';
import { Page, Property, Booking, NewPropertyData, User } from './types';
import './App.css';

// Header wrapper component to consume auth context cleanly
const AppHeaderWrapper: React.FC<{
  openRegisterModal: () => void;
  openSignInModal: () => void;
}> = ({ openRegisterModal, openSignInModal }) => {
  const { user, isAuthenticated } = useAuthState();
  const { logout } = useAuthActions();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Map URL paths to Page names for header highlighting
  const pathToPage: Record<string, Page> = {
    '/': 'Explore',
    '/bookings': 'Bookings',
    '/messages': 'Messages',
    '/host-dashboard': 'Host Dashboard',
    '/financials': 'Financials',
    '/settings': 'Settings',
    '/admin-dashboard': 'Admin Dashboard',
    '/verify-email': 'Verify Email'
  };
  
  const activePage = pathToPage[location.pathname] || 'Explore';
  
  const handleSetActivePage = (page: Page) => {
    const pageToPath: Record<Page, string> = {
      'Explore': '/',
      'Bookings': '/bookings',
      'Messages': '/messages',
      'Host Dashboard': '/host-dashboard',
      'Financials': '/financials',
      'Settings': '/settings',
      'Admin Dashboard': '/admin-dashboard',
      'Verify Email': '/verify-email'
    };
    navigate(pageToPath[page] || '/');
  };
  
  return (
    <Header
      activePage={activePage}
      setActivePage={handleSetActivePage}
      conversations={[]}
      currentUser={user}
      onBecomeHostClick={openRegisterModal}
      onSignInClick={openSignInModal}
      onSignOut={async () => { await logout(); }}
    />
  );
};

// Admin Dashboard route guard component
const AdminDashboardPageGuard: React.FC<{ properties: Property[]; onUpdateProperty: (property: Property) => void }> = ({ properties, onUpdateProperty }) => {
  const { user, isAuthenticated } = useAuthState();

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="access-denied-container" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#ef4444' }}>Access Denied</h1>
        <p style={{ fontSize: '1.125rem', color: '#6b7280' }}>You do not have permission to access the Admin Dashboard.</p>
        <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.5rem' }}>Admin privileges are required.</p>
      </div>
    );
  }

  return <AdminDashboardPage properties={properties} onUpdateProperty={onUpdateProperty} />;
};

const AppContent: React.FC = () => {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const navigate = useNavigate();

  // Auth now sourced from context inside AppContent wrapper
  const [isBecomeHostModalOpen, setIsBecomeHostModalOpen] = useState(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);

  const handleSelectProperty = (property: Property) => {
    setSelectedBooking(null);
    navigate(`/properties/${property.id}`);
  };
  
  const handleSelectBooking = (booking: Booking) => {
    setSelectedBooking(booking);
  }

  const handleClearSelection = () => {
    setSelectedBooking(null);
  };
  
  const handleUpdateBooking = (updatedBooking: Booking) => {
    setBookings(bookings.map(b => b.id === updatedBooking.id ? updatedBooking : b));
  };

  const handleAddProperty = (newPropertyData: NewPropertyData) => {
    // This is now handled by the AddPropertyModal's API call
    // Just log for now since the real property creation happens in the modal
    console.log('Property added:', newPropertyData);
    // TODO: Refresh properties list or handle success notification
  };

  const handleUpdateProperty = (updatedProperty: Property) => {
    setProperties(properties.map(p => p.id === updatedProperty.id ? updatedProperty : p));
  };

  // Support external navigation events (e.g., chat button)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.page) {
        // Map Page names to paths
        const pageToPath: Record<Page, string> = {
          'Explore': '/',
          'Bookings': '/bookings',
          'Messages': '/messages',
          'Host Dashboard': '/host-dashboard',
          'Financials': '/financials',
          'Settings': '/settings',
          'Admin Dashboard': '/admin-dashboard',
          'Verify Email': '/verify-email'
        };
        navigate(pageToPath[detail.page] || '/');
      }
    };
    window.addEventListener('navigate', handler as EventListener);
    return () => window.removeEventListener('navigate', handler as EventListener);
  }, [navigate]);

  // --- Auth Handlers (legacy wrappers removed; handled by context) ---
  
  const handleRegisterHost = (data: {name: string; email: string}) => {
    // This is now handled by the authentication API
    console.log("Host registration handled by API:", data);
  };

  const handleRegisterGuest = (data: {name: string; email: string}) => {
    // This is now handled by the authentication API
    console.log("Guest registration handled by API:", data);
  };

  const handleResetPassword = (email: string) => {
    alert(`A password reset link has been sent to ${email}.`);
    setIsResetPasswordModalOpen(false);
  };

  const PropertyDetailRoute: React.FC = () => {
    const { propertyId } = useParams<{ propertyId: string }>();
    const navigate = useNavigate();

    const handleBack = () => {
      const historyState = window.history.state as { idx?: number } | null;
      if (historyState?.idx && historyState.idx > 0) {
        navigate(-1);
      } else {
        navigate('/');
      }
    };

    if (!propertyId) {
      return <Navigate to="/" replace />;
    }

    return <PropertyDetailPage propertyId={propertyId} onBack={handleBack} />;
  };

  // --- Modal Switching Logic ---
  const openRegisterModal = () => { // This is for hosts
    setIsSignInModalOpen(false);
    setIsSignUpModalOpen(false);
    setIsBecomeHostModalOpen(true);
  };
  const openSignInModal = () => {
    setIsBecomeHostModalOpen(false);
    setIsSignUpModalOpen(false);
    setIsResetPasswordModalOpen(false);
    setIsSignInModalOpen(true);
  };
  const openSignUpModal = () => { // This is for guests
    setIsSignInModalOpen(false);
    setIsBecomeHostModalOpen(false);
    setIsSignUpModalOpen(true);
  };
  const openResetPasswordModal = () => {
    setIsSignInModalOpen(false);
    setIsResetPasswordModalOpen(true);
  };

  const renderContent = () => {
    if (selectedBooking) {
      return <BookingDetailPage booking={selectedBooking} onBack={handleClearSelection} onUpdateBooking={handleUpdateBooking} />;
    }
    return (
      <Routes>
        <Route path="/" element={<ExplorePage onSelectProperty={handleSelectProperty} />} />
        <Route path="/properties/:propertyId" element={<PropertyDetailRoute />} />
        <Route path="/verify-email" element={
          <VerifyEmailPage
            token={new URLSearchParams(window.location.search).get('token') || undefined}
            onVerified={() => {
              const newUrl = window.location.origin + window.location.pathname;
              window.history.replaceState({}, '', newUrl);
              navigate('/');
            }}
            onBackToExplore={() => navigate('/')}
          />
        } />
        <Route path="/host-dashboard" element={
          <HostDashboardPage 
            setActivePage={(page: Page) => {
              const pageToPath: Record<Page, string> = {
                'Explore': '/',
                'Bookings': '/bookings',
                'Messages': '/messages',
                'Host Dashboard': '/host-dashboard',
                'Financials': '/financials',
                'Settings': '/settings',
                'Admin Dashboard': '/admin-dashboard',
                'Verify Email': '/verify-email'
              };
              navigate(pageToPath[page] || '/');
            }} 
          />
        } />
        <Route path="/admin-dashboard" element={
          <AdminDashboardPageGuard properties={properties} onUpdateProperty={handleUpdateProperty} />
        } />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/bookings" element={
          <BookingsPage onSelectProperty={handleSelectProperty} onSelectBooking={handleSelectBooking} />
        } />
        <Route path="/financials" element={<FinancialsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    );
  }

  return (
    <div className="app-container">
      <div className="background-container">
        <div className="background-gradient"></div>
      </div>

      <AppHeaderWrapper
        openRegisterModal={openRegisterModal}
        openSignInModal={openSignInModal}
      />
      <main className="main-content">
        {renderContent()}
      </main>
      <Footer />

      {isBecomeHostModalOpen && (
        <BecomeHostModal
            isOpen={isBecomeHostModalOpen}
            onClose={() => setIsBecomeHostModalOpen(false)}
            onRegister={handleRegisterHost}
            onSwitchToSignIn={openSignInModal}
        />
      )}
      {isSignUpModalOpen && (
        <SignUpModal
            isOpen={isSignUpModalOpen}
            onClose={() => setIsSignUpModalOpen(false)}
            onSwitchToSignIn={openSignInModal}
        />
      )}
      {isSignInModalOpen && (
        <SignInModal
            isOpen={isSignInModalOpen}
            onClose={() => setIsSignInModalOpen(false)}
            onSwitchToSignUp={openSignUpModal}
            onSwitchToResetPassword={openResetPasswordModal}
        />
      )}
      {isResetPasswordModalOpen && (
        <ResetPasswordModal
            isOpen={isResetPasswordModalOpen}
            onClose={() => setIsResetPasswordModalOpen(false)}
            onBackToSignIn={openSignInModal}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;