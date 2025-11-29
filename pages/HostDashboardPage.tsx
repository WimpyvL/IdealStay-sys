import React, { useMemo, useState } from 'react';
import { Page, Property, NewPropertyData } from '../types';
import { DEFAULT_PROPERTY_THUMBNAIL, getImageUrl } from '../constants';
import { 
  DollarSignIcon, BedIcon, ActivityIcon, MessageIcon, StarIcon, PlusIcon, ChartBarIcon
} from '../components/icons/Icons';
import AddPropertyModal from '../components/AddPropertyModal';
import ManagePropertyModal from '../components/ManagePropertyModal';
import EditPropertyModal from '../components/EditPropertyModal';
import BookingDetailsModal from '../components/BookingDetailsModal';
import { useAuth } from '../src/contexts/AuthContext';
import { useHostProperties, useHostBookings, useHostStats, useHostActivity, useHostFinancials } from '../src/hooks';
import { ActivityItemType, FinancialDataType } from '../src/services';
import { bookingsService } from '../src/services/bookings.service';
import './HostDashboardPage.css';
import { toAbsoluteImageUrl } from '../components/imageUtils';

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, change }) => (
  <div className="metric-card">
    <div className="metric-card__icon-wrapper">{icon}</div>
    <div className="metric-card__details">
      <p className="metric-card__label">{label}</p>
      <p className="metric-card__value">{value}</p>
    </div>
    {change && <p className="metric-card__change">{change}</p>}
  </div>
);

const ActivityTypeIcon: React.FC<{ type: ActivityItemType['type'] }> = ({ type }) => {
    const icons: { [key in ActivityItemType['type']]: React.ReactNode } = {
        booking: <BedIcon />,
        message: <MessageIcon />,
        review: <StarIcon />,
        payment: <DollarSignIcon />,
    };
    return <div className={`activity-item__icon activity-item__icon--${type}`}>{icons[type]}</div>;
};

interface FinanceBreakdownCardProps {
    data: FinancialDataType[];
    onViewReport: () => void;
}

const FinanceBreakdownCard: React.FC<FinanceBreakdownCardProps> = ({ data, onViewReport }) => {
    const [timePeriod, setTimePeriod] = useState('Monthly');

    const { totalRevenue, totalExpenses, netProfit, maxValue } = useMemo(() => {
        const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
        const totalExpenses = data.reduce((sum, item) => sum + item.expenses, 0);
        const netProfit = totalRevenue - totalExpenses;
        const maxValue = Math.max(...data.map(item => Math.max(item.revenue, item.expenses)));
        return { totalRevenue, totalExpenses, netProfit, maxValue };
    }, [data]);

    return (
        <div className="dashboard-card">
            <div className="finance-card-header">
                 <h2 className="dashboard-card__title">Finance Breakdown</h2>
                 <div className="time-period-toggle">
                     <button className={timePeriod === 'Monthly' ? 'active' : ''} onClick={() => setTimePeriod('Monthly')}>Monthly</button>
                     <button className={timePeriod === 'Yearly' ? 'active' : ''} onClick={() => setTimePeriod('Yearly')}>Yearly</button>
                 </div>
            </div>
            
            <div className="finance-chart">
        <div className="chart-bars">
          {data.map(item => (
            <div
              key={item.period}
              className="chart-bar-group"
              title={`${item.period}\nRevenue: $${item.revenue}\nExpenses: $${item.expenses}`}
            >
              <div className="chart-bar chart-bar--revenue" style={{ height: `${(item.revenue / maxValue) * 100}%` }}></div>
              <div className="chart-bar chart-bar--expenses" style={{ height: `${(item.expenses / maxValue) * 100}%` }}></div>
            </div>
          ))}
        </div>
        <div className="chart-labels">
          {data.map(item => (
            <div key={item.period} className="chart-label">{item.period}</div>
          ))}
        </div>
            </div>

            <div className="finance-summary">
                <div className="summary-item">
                    <span className="summary-item__label">Total Revenue</span>
                    <span className="summary-item__value">${totalRevenue.toLocaleString()}</span>
                </div>
                 <div className="summary-item">
                    <span className="summary-item__label">Total Expenses</span>
                    <span className="summary-item__value">${totalExpenses.toLocaleString()}</span>
                </div>
                 <div className="summary-item">
                    <span className="summary-item__label">Net Profit</span>
                    <span className={`summary-item__value ${netProfit >= 0 ? 'summary-item__value--positive' : 'summary-item__value--negative'}`}>
                      ${netProfit.toLocaleString()}
                    </span>
                </div>
            </div>

            <div className="finance-card-footer">
                <button className="button button--secondary button--full" onClick={onViewReport}>
                    View Full Report
                </button>
            </div>
        </div>
    );
};

interface HostDashboardPageProps {
  setActivePage: (page: Page) => void;
}

const HostDashboardPage: React.FC<HostDashboardPageProps> = ({ setActivePage }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  
  // Get authentication state
  const { state } = useAuth();
  const { user, isAuthenticated, isLoading } = state;
  const { becomeHost, refreshUser } = useAuth();
  
  // Fetch host-specific data
  const { properties: hostPropertiesRaw, loading: propertiesLoading, error: propertiesError, refetch: refetchProperties } = useHostProperties(user?.id);
  const hostProperties = hostPropertiesRaw ?? [];
  const { bookings: hostBookings, loading: bookingsLoading, refetch: refetchBookings } = useHostBookings();
  const { stats: hostStats, loading: statsLoading, error: statsError } = useHostStats();
  const { activities: recentActivity, loading: activityLoading } = useHostActivity(10);
  const { financials: financeData, loading: financialsLoading } = useHostFinancials('monthly');

  // Filter pending bookings for approval section
  const pendingBookings = useMemo(() => {
    return hostBookings.filter(booking => booking.status === 'pending');
  }, [hostBookings]);

  const manualPaymentQueue = useMemo(() => {
    return hostBookings.filter((booking) => {
      if (!booking) return false;
      if (booking.status === 'cancelled' || booking.status === 'refunded') return false;
      return booking.payment_status === 'pending' || booking.payment_status === 'partial';
    });
  }, [hostBookings]);
  
  const selectedBooking = useMemo(() => {
    if (selectedBookingId == null) return null;
    return hostBookings.find(b => b.id === selectedBookingId) || null;
  }, [selectedBookingId, hostBookings]);

  const handleAddProperty = async (data: NewPropertyData) => {
    try {
      // Implementation will be added when we connect AddPropertyModal to API
      console.log('Adding property:', data);
      // await propertiesService.createProperty(data);
      // refetchProperties();
    } catch (error) {
      console.error('Failed to add property:', error);
    }
    setIsModalOpen(false); // Close modal on successful submission
  };

  const handleUpdateProperty = (updatedProperty: Property) => {
    // Refresh the properties list to show updated data
    refetchProperties();
    setEditOpen(false);
    setSelectedProperty(null);
    setManageOpen(false);
  };

  const handleApproveBooking = async (bookingId: number) => {
    try {
      await bookingsService.updateBookingStatus({
        booking_id: bookingId,
        status: 'confirmed'
      });
      // Refresh bookings to show updated status
      await refetchBookings();
    } catch (error) {
      console.error('Failed to approve booking:', error);
      alert('Failed to approve booking. Please try again.');
    }
  };

  const handleDenyBooking = async (bookingId: number) => {
    const reason = prompt('Please provide a reason for denying this booking (optional):');
    try {
      await bookingsService.updateBookingStatus({
        booking_id: bookingId,
        status: 'cancelled',
        reason: reason || undefined
      });
      // Refresh bookings to show updated status
      await refetchBookings();
    } catch (error) {
      console.error('Failed to deny booking:', error);
      alert('Failed to deny booking. Please try again.');
    }
  };

  const handleApprovePayment = async (bookingId: number) => {
    const referenceInput = window.prompt('Enter payment reference or receipt number (optional):') || '';
    const paymentReference = referenceInput.trim();

    try {
      await bookingsService.updatePaymentDetails(bookingId, {
        payment_status: 'paid',
        payment_method: 'manual',
        payment_notes: 'Manual approval recorded via host dashboard',
        ...(paymentReference ? { payment_reference: paymentReference } : {}),
      });
      await refetchBookings();
      alert('Payment marked as paid. Booking status updated.');
    } catch (error) {
      console.error('Failed to approve payment:', error);
      alert('Failed to approve payment. Please try again.');
    }
  };

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="host-dashboard-page">
        <div className="placeholder-container">
          <h1 className="page-title-standalone">Sign In Required</h1>
          <p className="page-subtitle">Please sign in to access your host dashboard.</p>
        </div>
      </div>
    );
  }

  // Loading auth state
  if (isLoading) {
    return (
      <div className="host-dashboard-page">
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>Preparing your dashboard...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated but not a host yet
  if (user && (!user.is_host || !user.host_approved)) {
    const upgrading = false; // could hook state if we add spinner later
    return (
      <div className="host-dashboard-page">
        <div className="placeholder-container">
          <h1 className="page-title-standalone">Become a Host</h1>
          <p className="page-subtitle">Your account (<strong>{user.email}</strong>) isn&apos;t a host yet. Upgrade now to create listings and view host analytics.</p>
          <div style={{ marginTop: '1.5rem' }}>
            <button
              className="button button--primary"
              disabled={upgrading}
              onClick={async () => {
                try {
                  await becomeHost();
                  await refreshUser();
                  // Reload the page to reflect the new host status
                  window.location.reload();
                } catch (e) {
                  console.error('Failed to upgrade to host', e);
                }
              }}
            >
              Upgrade to Host
            </button>
          </div>
          <p className="small" style={{ marginTop: '1rem' }}>After upgrading, this page will reload with your host tools.</p>
        </div>
      </div>
    );
  }

  // Show loading state
  if (propertiesLoading || statsLoading || financialsLoading) {
    return (
      <div className="host-dashboard-page">
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="host-dashboard-page">
      <div className="dashboard-header">
        <div>
            <h1 className="page-title">Welcome Back, {user?.first_name || 'Host'}!</h1>
            <p className="page-subtitle">Here's a snapshot of your hosting activity.</p>
        </div>
        <button className="button button--primary add-property-button" onClick={() => setIsModalOpen(true)}>
            <PlusIcon />
            Add New Property
        </button>
      </div>
      
      {/* Metrics Section */}
      <div className="metrics-grid">
        <MetricCard 
          icon={<DollarSignIcon />} 
          label="Monthly Revenue" 
          value={hostStats ? `$${hostStats.monthly_revenue.toLocaleString()}` : '$0'} 
        />
        <MetricCard 
          icon={<BedIcon />} 
          label="Total Bookings" 
          value={hostStats ? hostStats.total_bookings.toString() : '0'} 
        />
        <MetricCard 
          icon={<StarIcon />} 
          label="Average Rating" 
          value={hostStats ? hostStats.avg_rating.toFixed(1) : '0.0'} 
        />
      </div>

      <div className="dashboard-layout">
        {/* Pending Bookings Section */}
        {pendingBookings.length > 0 && (
          <div className="dashboard-grid-span-2">
            <div className="dashboard-card">
              <h2 className="dashboard-card__title">Pending Bookings</h2>
              <div className="pending-bookings-list">
                {pendingBookings.map((booking) => {
                  const checkInDate = new Date(booking.check_in_date);
                  const checkOutDate = new Date(booking.check_out_date);
                  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <div key={booking.id} className="pending-booking-item">
                      <div className="pending-booking-info">
                        <div className="pending-booking-guest">
                          <div className="guest-avatar-wrapper">
                            {(() => {
                              const avatarSrc = toAbsoluteImageUrl(booking.guest_image);
                              if (avatarSrc) {
                                return (
                                  <img
                                    src={avatarSrc}
                                    alt={`${booking.guest_first_name || 'Guest'} ${booking.guest_last_name || ''}`.trim()}
                                    className="guest-avatar"
                                  />
                                );
                              }
                              const initials = `${booking.guest_first_name?.[0] || ''}${booking.guest_last_name?.[0] || ''}`.trim() || 'G';
                              return <span className="guest-avatar--fallback">{initials}</span>;
                            })()}
                          </div>
                          <div>
                            <p className="guest-name">
                              {booking.guest_first_name} {booking.guest_last_name}
                            </p>
                            <p className="booking-property">{booking.property_title || 'Property'}</p>
                          </div>
                        </div>
                        <div className="pending-booking-details">
                          <p className="booking-dates">
                            {checkInDate.toLocaleDateString()} - {checkOutDate.toLocaleDateString()}
                          </p>
                          <p className="booking-info">
                            {nights} night{nights !== 1 ? 's' : ''} • {booking.guests_count} guest{booking.guests_count !== 1 ? 's' : ''}
                          </p>
                          <p className="booking-amount">${booking.total_amount?.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="pending-booking-actions">
                        <button
                          className="button button--primary button--small"
                          onClick={() => handleApproveBooking(booking.id)}
                        >
                          Approve
                        </button>
                        <button
                          className="button button--secondary button--small"
                          onClick={() => handleDenyBooking(booking.id)}
                        >
                          Deny
                        </button>
                        <button
                          className="button button--ghost button--small"
                          onClick={() => setSelectedBookingId(booking.id)}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {manualPaymentQueue.length > 0 && (
          <div className="dashboard-grid-span-2">
            <div className="dashboard-card">
              <h2 className="dashboard-card__title">Payments Requiring Approval</h2>
              <div className="payment-approvals-list">
                {manualPaymentQueue.map((booking) => {
                  const checkOutDate = new Date(booking.check_out_date);
                  const checkInDate = new Date(booking.check_in_date);
                  const nights = Math.max(
                    0,
                    Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
                  );

                  return (
                    <div key={booking.id} className="payment-approval-item">
                      <div className="payment-approval-main">
                        <div className="payment-approval-guest">
                          <div className="guest-avatar-wrapper">
                            {(() => {
                              const avatarSrc = toAbsoluteImageUrl(booking.guest_image);
                              if (avatarSrc) {
                                return (
                                  <img
                                    src={avatarSrc}
                                    alt={`${booking.guest_first_name || 'Guest'} ${booking.guest_last_name || ''}`.trim()}
                                    className="guest-avatar"
                                  />
                                );
                              }
                              const initials = `${booking.guest_first_name?.[0] || ''}${booking.guest_last_name?.[0] || ''}`.trim() || 'G';
                              return <span className="guest-avatar--fallback">{initials}</span>;
                            })()}
                          </div>
                          <div className="payment-approval-copy">
                            <p className="guest-name">
                              {booking.guest_first_name} {booking.guest_last_name}
                            </p>
                            <p className="booking-property">{booking.property_title || `Booking #${booking.id}`}</p>
                            <p className="payment-approval-meta">
                              {nights} night{nights !== 1 ? 's' : ''} • {booking.guests_count} guest
                              {booking.guests_count !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="payment-approval-finance">
                          <span className="payment-approval-amount">
                            ${booking.total_amount?.toLocaleString()}
                          </span>
                          <span className={`payment-status-pill payment-status-pill--${booking.payment_status}`}>
                            {booking.payment_status}
                          </span>
                          {booking.payment_reference && (
                            <span className="payment-reference">Ref: {booking.payment_reference}</span>
                          )}
                        </div>
                      </div>
                      <div className="payment-approval-actions">
                        <button
                          className="button button--primary button--small"
                          onClick={() => handleApprovePayment(booking.id)}
                        >
                          Mark Payment as Received
                        </button>
                        <button
                          className="button button--ghost button--small"
                          onClick={() => setSelectedBookingId(booking.id)}
                        >
                          Review Booking
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

         <div className="dashboard-grid-span-2">
            <div className="dashboard-card">
              <h2 className="dashboard-card__title">My Listings</h2>
              {propertiesError ? (
                <div className="error-message">
                  <p>Unable to load properties: {propertiesError}</p>
                  <button onClick={() => refetchProperties()} className="retry-button">
                    Try Again
                  </button>
                </div>
              ) : hostProperties.length === 0 ? (
                <div className="empty-state">
                  <p>No properties listed yet.</p>
                  <button onClick={() => setIsModalOpen(true)} className="button button--primary">
                    Add Your First Property
                  </button>
                </div>
              ) : (
                <div className="listings-list">
                  {hostProperties.map((listing: Property) => {
                    // Attempt to derive a display image from several possible backend shapes
                    const primaryFromArray = listing.images && listing.images.length > 0 ? ((listing.images[0] as any).image_url || (listing.images[0] as any).url) : null;
                    // Some endpoints return a flattened primary_image column
                    const primaryFromField = (listing as any).primary_image;
                    const derivedImage = primaryFromArray || primaryFromField;
                    const imageSrc = derivedImage ? getImageUrl(derivedImage) : DEFAULT_PROPERTY_THUMBNAIL;
                    return (
                    <div key={listing.id} className="listing-item">
                      <img 
                        src={imageSrc}
                        alt={listing.title} 
                        className="listing-item__image" 
                      />
                    <div className="listing-item__details">
                      <p className="listing-item__title">{listing.title}</p>
                      <p className="listing-item__location">{listing.city}, {listing.country}</p>
                    </div>
                    <span className={`status-badge status-badge--${listing.status.toLowerCase()}`}>
                      {listing.status}
                    </span>
                    <button 
                      className="button button--secondary button--small"
                      onClick={() => { setSelectedProperty(listing); setManageOpen(true); }}
                    >
                      Manage
                    </button>
                  </div>
                  )})}
                </div>
              )}
            </div>
        </div>
        
        <FinanceBreakdownCard data={financeData} onViewReport={() => setActivePage('Financials')} />

        <div className="dashboard-card">
          <h2 className="dashboard-card__title">Recent Activity</h2>
          <div className="activity-feed">
            {activityLoading ? (
              <p>Loading activity...</p>
            ) : recentActivity.length === 0 ? (
              <p>No recent activity</p>
            ) : (
              recentActivity.map((activity: ActivityItemType) => (
                <div key={activity.id} className={`activity-item ${activity.type === 'booking' ? 'activity-item--clickable' : ''}`}
                  onClick={() => {
                    if (activity.type === 'booking') {
                      const bookingIdMatch = activity.id.toString().match(/(\d+)/);
                      // If activity.id is not numeric, attempt to parse from description "Property X" pattern could include id; adjust as backend shapes become fixed
                      const parsedId = bookingIdMatch ? parseInt(bookingIdMatch[1], 10) : Number(activity.id);
                      if (!isNaN(parsedId)) {
                        setSelectedBookingId(parsedId);
                      }
                    }
                  }}
                  role={activity.type === 'booking' ? 'button' : undefined}
                  tabIndex={activity.type === 'booking' ? 0 : -1}
                >
                  <ActivityTypeIcon type={activity.type} />
                  <div className="activity-item__details">
                    <p className="activity-item__title">{activity.title}</p>
                    <p className="activity-item__description">{activity.description}</p>
                    <p className="activity-item__timestamp">{new Date(activity.timestamp).toLocaleString()}</p>
                  </div>
                  {activity.amount && (
                    <span className="activity-item__amount">${activity.amount.toLocaleString()}</span>
                  )}
                  {activity.rating && (
                    <span className="activity-item__rating">★ {activity.rating}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {isModalOpen && (
        <AddPropertyModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAddProperty={handleAddProperty}
        />
      )}
    </div>
    <ManagePropertyModal 
      property={selectedProperty}
      isOpen={manageOpen}
      onClose={() => { setManageOpen(false); setSelectedProperty(null); }}
      onEdit={(prop) => { 
        setManageOpen(false);
        setEditOpen(true);
        // selectedProperty is already set, so no need to set it again
      }}
      onViewBookings={(prop) => { setActivePage('Bookings'); console.log('View bookings for property', prop.id); }}
    />
    
    <EditPropertyModal 
      property={selectedProperty}
      isOpen={editOpen}
      onClose={() => { setEditOpen(false); setSelectedProperty(null); }}
      onUpdateProperty={handleUpdateProperty}
    />
    <BookingDetailsModal 
      booking={selectedBooking}
      isOpen={selectedBooking != null}
      onClose={() => setSelectedBookingId(null)}
    />
    </>
  );
};

export default HostDashboardPage;