import React, { useState, FC } from 'react';
import { Property, PropertyStatus } from '../types';
import { DEFAULT_PROPERTY_THUMBNAIL, getImageUrl } from '../constants';
import {
  DollarSignIcon, UserGroupIcon, BuildingOfficeIcon, ActivityIcon,
  CheckCircleIcon, XCircleIcon
} from '../components/icons/Icons';
import {
  useAdminStats,
  useAdminUsers,
  useAdminProperties,
  useAdminBookings,
  useAdminReviews,
  useRevenueAnalytics
} from '../src/hooks';
import './AdminDashboardPage.css';

// --- Types ---
type TabView = 'overview' | 'properties' | 'users' | 'bookings' | 'reviews' | 'financials';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  theme: 'blue' | 'green' | 'sky' | 'yellow';
}

const StatCard: FC<StatCardProps> = ({ icon, title, value, theme }) => (
  <div className="admin-stat-card">
    <div className={`admin-stat-card__icon-wrapper admin-stat-card__icon-wrapper--${theme}`}>
      {icon}
    </div>
    <div className="admin-stat-card__details">
      <p className="admin-stat-card__title">{title}</p>
      <p className="admin-stat-card__value">{value}</p>
    </div>
  </div>
);

// --- Main Component ---
interface EnhancedAdminDashboardPageProps {
  properties: Property[];
  onUpdateProperty: (property: Property) => void;
}

const EnhancedAdminDashboardPage: React.FC<EnhancedAdminDashboardPageProps> = ({
  properties,
  onUpdateProperty
}) => {
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [propertyStatus, setPropertyStatus] = useState('all');
  const [propertyPage, setPropertyPage] = useState(1);
  const [propertySearch, setPropertySearch] = useState('');
  const [bookingStatus, setBookingStatus] = useState('all');
  const [bookingPage, setBookingPage] = useState(1);
  const [reviewFilter, setReviewFilter] = useState('all');

  // Fetch admin data
  const { stats, loading: statsLoading, error: statsError } = useAdminStats();
  const { users, pagination: userPagination, loading: usersLoading, updateUserStatus } = useAdminUsers(
    userPage,
    10,
    userSearch
  );

  // Enhanced admin data
  const { properties: adminProperties, pagination: propertyPagination, loading: propertiesLoading, approveProperty, rejectProperty } = useAdminProperties({
    status: propertyStatus,
    search: propertySearch,
    page: propertyPage,
    limit: 10
  });

  const { bookings, pagination: bookingPagination, loading: bookingsLoading, cancelBooking, processRefund } = useAdminBookings({
    status: bookingStatus !== 'all' ? bookingStatus : undefined,
    page: bookingPage,
    limit: 10
  });

  const { reviews, pagination: reviewPagination, loading: reviewsLoading, moderateReview, deleteReview } = useAdminReviews({
    flagged: reviewFilter === 'flagged' ? true : undefined,
    page: 1,
    limit: 20
  });

  const { analytics, loading: analyticsLoading } = useRevenueAnalytics('monthly');

  // Handlers
  const handleUpdateUserStatus = async (userId: number, newStatus: 'active' | 'inactive' | 'suspended') => {
    try {
      await updateUserStatus(userId, newStatus);
    } catch (error) {
      console.error('Failed to update user status:', error);
      alert('Failed to update user status. Please try again.');
    }
  };

  const handleApproveProperty = async (propertyId: number) => {
    try {
      await approveProperty(propertyId, 'Approved by admin');
      alert('Property approved successfully!');
    } catch (error) {
      console.error('Failed to approve property:', error);
      alert('Failed to approve property. Please try again.');
    }
  };

  const handleRejectProperty = async (propertyId: number) => {
    const reason = prompt('Please enter rejection reason:');
    if (!reason) return;

    try {
      await rejectProperty(propertyId, reason);
      alert('Property rejected successfully!');
    } catch (error) {
      console.error('Failed to reject property:', error);
      alert('Failed to reject property. Please try again.');
    }
  };

  const handleCancelBooking = async (bookingId: number) => {
    const reason = prompt('Please enter cancellation reason:');
    if (!reason) return;

    try {
      await cancelBooking(bookingId, reason);
      alert('Booking cancelled successfully!');
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      alert('Failed to cancel booking. Please try again.');
    }
  };

  const handleModerateReview = async (reviewId: number, action: string) => {
    try {
      await moderateReview(reviewId, action);
      alert('Review moderated successfully!');
    } catch (error) {
      console.error('Failed to moderate review:', error);
      alert('Failed to moderate review. Please try again.');
    }
  };

  // --- Render Functions ---
  const renderOverview = () => (
    <>
      {/* Stats Grid */}
      <div className="admin-stats-grid">
        <StatCard
          icon={<DollarSignIcon />}
          title="Total Revenue"
          value={`$${stats?.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}`}
          theme="green"
        />
        <StatCard
          icon={<UserGroupIcon />}
          title="Total Users"
          value={stats?.total_users || 0}
          theme="blue"
        />
        <StatCard
          icon={<BuildingOfficeIcon />}
          title="Total Properties"
          value={stats?.total_properties || 0}
          theme="sky"
        />
        <StatCard
          icon={<ActivityIcon />}
          title="Pending Approvals"
          value={stats?.pending_properties || 0}
          theme="yellow"
        />
      </div>

      {/* Quick Actions */}
      <div className="admin-quick-actions">
        <h3>Quick Actions</h3>
        <div className="admin-action-buttons">
          <button className="button button--primary" onClick={() => setActiveTab('properties')}>
            Review Properties
          </button>
          <button className="button button--primary" onClick={() => setActiveTab('bookings')}>
            Manage Bookings
          </button>
          <button className="button button--primary" onClick={() => setActiveTab('financials')}>
            View Financials
          </button>
        </div>
      </div>
    </>
  );

  const renderProperties = () => (
    <div className="admin-management-card">
      <div className="admin-management-card__header">
        <h3 className="admin-management-card__title">Property Management</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            value={propertyStatus}
            onChange={(e) => setPropertyStatus(e.target.value)}
            className="admin-search-input"
          >
            <option value="all">All Properties</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
          <input
            type="text"
            placeholder="Search properties..."
            value={propertySearch}
            onChange={(e) => setPropertySearch(e.target.value)}
            className="admin-search-input"
          />
        </div>
      </div>

      {propertiesLoading ? (
        <div className="admin-table-loading">
          <div className="loading-spinner"></div>
          <p>Loading properties...</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Host</th>
                <th>Location</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {adminProperties.map((prop: any) => (
                <tr key={prop.id}>
                  <td>
                    <div className="admin-property-cell">
                      <img
                        src={prop.primary_image ? getImageUrl(prop.primary_image) : DEFAULT_PROPERTY_THUMBNAIL}
                        alt={prop.title}
                        className="admin-property-image"
                      />
                      <p className="admin-property-title">{prop.title}</p>
                    </div>
                  </td>
                  <td>{prop.host_first_name} {prop.host_last_name}</td>
                  <td>{prop.city}</td>
                  <td>${prop.price_per_night}/night</td>
                  <td>
                    <span className={`admin-status-badge admin-status-badge--${prop.status}`}>
                      {prop.status}
                    </span>
                  </td>
                  <td>
                    <div className="admin-action-buttons">
                      {(prop.status === 'pending' || prop.status === 'draft') && (
                        <>
                          <button
                            className="button button--success button--small"
                            onClick={() => handleApproveProperty(prop.id)}
                            title="Approve Property"
                          >
                            <CheckCircleIcon />
                          </button>
                          <button
                            className="button button--danger button--small"
                            onClick={() => handleRejectProperty(prop.id)}
                            title="Reject Property"
                          >
                            <XCircleIcon />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {propertyPagination && propertyPagination.total_pages > 1 && (
            <div className="admin-pagination">
              <button
                onClick={() => setPropertyPage(propertyPage - 1)}
                disabled={propertyPage <= 1}
                className="button button--secondary button--small"
              >
                Previous
              </button>
              <span className="admin-pagination-info">
                Page {propertyPage} of {propertyPagination.total_pages} ({propertyPagination.total} total)
              </span>
              <button
                onClick={() => setPropertyPage(propertyPage + 1)}
                disabled={propertyPage >= propertyPagination.total_pages}
                className="button button--secondary button--small"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderUsers = () => (
    <div className="admin-management-card">
      <div className="admin-management-card__header">
        <h3 className="admin-management-card__title">User Management</h3>
        <input
          type="text"
          placeholder="Search users..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          className="admin-search-input"
        />
      </div>

      {usersLoading ? (
        <div className="admin-table-loading">
          <div className="loading-spinner"></div>
          <p>Loading users...</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user: any) => (
                <tr key={user.id}>
                  <td>
                    <div className="admin-user-cell">
                      <div className="admin-user-info">
                        <p className="admin-user-name">{user.first_name} {user.last_name}</p>
                      </div>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`admin-role-badge admin-role-badge--${user.role}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-status-badge admin-status-badge--${user.status}`}>
                      {user.status}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="admin-action-buttons">
                      {user.status === 'active' ? (
                        <button
                          className="button button--danger button--small"
                          onClick={() => handleUpdateUserStatus(user.id, 'suspended')}
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          className="button button--primary button--small"
                          onClick={() => handleUpdateUserStatus(user.id, 'active')}
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {userPagination && userPagination.total_pages > 1 && (
            <div className="admin-pagination">
              <button
                onClick={() => setUserPage(userPage - 1)}
                disabled={userPage <= 1}
                className="button button--secondary button--small"
              >
                Previous
              </button>
              <span className="admin-pagination-info">
                Page {userPage} of {userPagination.total_pages} ({userPagination.total} total)
              </span>
              <button
                onClick={() => setUserPage(userPage + 1)}
                disabled={userPage >= userPagination.total_pages}
                className="button button--secondary button--small"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderBookings = () => (
    <div className="admin-management-card">
      <div className="admin-management-card__header">
        <h3 className="admin-management-card__title">Booking Management</h3>
        <select
          value={bookingStatus}
          onChange={(e) => setBookingStatus(e.target.value)}
          className="admin-search-input"
        >
          <option value="all">All Bookings</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {bookingsLoading ? (
        <div className="admin-table-loading">
          <div className="loading-spinner"></div>
          <p>Loading bookings...</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Guest</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking: any) => (
                <tr key={booking.id}>
                  <td>{booking.property_title}</td>
                  <td>{booking.guest_first_name} {booking.guest_last_name}</td>
                  <td>{new Date(booking.check_in_date).toLocaleDateString()}</td>
                  <td>{new Date(booking.check_out_date).toLocaleDateString()}</td>
                  <td>${booking.total_amount.toFixed(2)}</td>
                  <td>
                    <span className={`admin-status-badge admin-status-badge--${booking.status}`}>
                      {booking.status}
                    </span>
                  </td>
                  <td>
                    <div className="admin-action-buttons">
                      {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                        <button
                          className="button button--danger button--small"
                          onClick={() => handleCancelBooking(booking.id)}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {bookingPagination && bookingPagination.total_pages > 1 && (
            <div className="admin-pagination">
              <button
                onClick={() => setBookingPage(bookingPage - 1)}
                disabled={bookingPage <= 1}
                className="button button--secondary button--small"
              >
                Previous
              </button>
              <span className="admin-pagination-info">
                Page {bookingPage} of {bookingPagination.total_pages} ({bookingPagination.total} total)
              </span>
              <button
                onClick={() => setBookingPage(bookingPage + 1)}
                disabled={bookingPage >= bookingPagination.total_pages}
                className="button button--secondary button--small"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderReviews = () => (
    <div className="admin-management-card">
      <div className="admin-management-card__header">
        <h3 className="admin-management-card__title">Review Moderation</h3>
        <select
          value={reviewFilter}
          onChange={(e) => setReviewFilter(e.target.value)}
          className="admin-search-input"
        >
          <option value="all">All Reviews</option>
          <option value="flagged">Flagged Only</option>
        </select>
      </div>

      {reviewsLoading ? (
        <div className="admin-table-loading">
          <div className="loading-spinner"></div>
          <p>Loading reviews...</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Reviewer</th>
                <th>Rating</th>
                <th>Comment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review: any) => (
                <tr key={review.id}>
                  <td>{review.property_title}</td>
                  <td>{review.reviewer_first_name} {review.reviewer_last_name}</td>
                  <td>{review.rating}/5</td>
                  <td>{review.comment?.substring(0, 50)}...</td>
                  <td>
                    <span className={`admin-status-badge admin-status-badge--${review.admin_action}`}>
                      {review.admin_action}
                    </span>
                  </td>
                  <td>
                    <div className="admin-action-buttons">
                      <button
                        className="button button--success button--small"
                        onClick={() => handleModerateReview(review.id, 'approved')}
                      >
                        Approve
                      </button>
                      <button
                        className="button button--warning button--small"
                        onClick={() => handleModerateReview(review.id, 'hidden')}
                      >
                        Hide
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderFinancials = () => (
    <div className="admin-management-card">
      <h3 className="admin-management-card__title">Financial Analytics</h3>
      {analyticsLoading ? (
        <div className="admin-table-loading">
          <div className="loading-spinner"></div>
          <p>Loading analytics...</p>
        </div>
      ) : analytics ? (
        <div>
          <div className="admin-stats-grid">
            <StatCard
              icon={<DollarSignIcon />}
              title="Total Bookings"
              value={analytics.overall_stats.total_bookings}
              theme="blue"
            />
            <StatCard
              icon={<DollarSignIcon />}
              title="Total Revenue"
              value={`$${analytics.overall_stats.total_revenue.toFixed(2)}`}
              theme="green"
            />
            <StatCard
              icon={<DollarSignIcon />}
              title="Avg Booking Value"
              value={`$${analytics.overall_stats.avg_booking_value.toFixed(2)}`}
              theme="sky"
            />
          </div>

          <h4 style={{ marginTop: '30px' }}>Revenue by Property Type</h4>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Property Type</th>
                  <th>Bookings</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {analytics.revenue_by_property_type.map((item: any) => (
                  <tr key={item.property_type}>
                    <td>{item.property_type}</td>
                    <td>{item.bookings_count}</td>
                    <td>${item.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p>No financial data available</p>
      )}
    </div>
  );

  return (
    <div className="admin-dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Enhanced Admin Dashboard</h1>
          <p className="page-subtitle">Comprehensive platform management and analytics.</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'overview' ? 'admin-tab--active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`admin-tab ${activeTab === 'properties' ? 'admin-tab--active' : ''}`}
          onClick={() => setActiveTab('properties')}
        >
          Properties
        </button>
        <button
          className={`admin-tab ${activeTab === 'users' ? 'admin-tab--active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button
          className={`admin-tab ${activeTab === 'bookings' ? 'admin-tab--active' : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
          Bookings
        </button>
        <button
          className={`admin-tab ${activeTab === 'reviews' ? 'admin-tab--active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews
        </button>
        <button
          className={`admin-tab ${activeTab === 'financials' ? 'admin-tab--active' : ''}`}
          onClick={() => setActiveTab('financials')}
        >
          Financials
        </button>
      </div>

      {/* Content Area */}
      {statsLoading ? (
        <div className="admin-loading">
          <div className="loading-spinner"></div>
          <p>Loading admin dashboard...</p>
        </div>
      ) : statsError ? (
        <div className="admin-error">
          <p>Error loading admin dashboard: {statsError}</p>
        </div>
      ) : (
        <div className="admin-tab-content">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'properties' && renderProperties()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'bookings' && renderBookings()}
          {activeTab === 'reviews' && renderReviews()}
          {activeTab === 'financials' && renderFinancials()}
        </div>
      )}
    </div>
  );
};

export default EnhancedAdminDashboardPage;