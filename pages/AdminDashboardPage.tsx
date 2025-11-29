import React, { useState, FC, useEffect } from 'react';
import { Property, PropertyStatus } from '../types';
import { DEFAULT_PROPERTY_THUMBNAIL, getImageUrl, PROPERTY_STATUS_UI_MAP } from '../constants';
import {
  DollarSignIcon, UserGroupIcon, BuildingOfficeIcon, ActivityIcon,
  CheckCircleIcon, XCircleIcon, EyeIcon
} from '../components/icons/Icons';
import ViewPropertyModal from '../components/ViewPropertyModal';
import { useAdminStats, useAdminUsers } from '../src/hooks';
import { AdminUserType, propertiesService, adminService } from '../src/services';
import './AdminDashboardPage.css';

// --- Sub-components defined in the same file for encapsulation ---

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

// --- Main Admin Dashboard Page Component ---
interface AdminDashboardPageProps {
  properties: Property[]; // active properties passed from app (may exclude pending)
  onUpdateProperty: (property: Property) => void;
}

const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ properties, onUpdateProperty }) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [managedProperties, setManagedProperties] = useState<Property[]>([]);
  const [managedLoading, setManagedLoading] = useState(false);
  const [managedError, setManagedError] = useState<string | null>(null);
  const [viewingPropertyId, setViewingPropertyId] = useState<number | null>(null);
  const [approvingIds, setApprovingIds] = useState<Set<number>>(new Set());
  const [approvingHostIds, setApprovingHostIds] = useState<Set<number>>(new Set());

  // Fetch admin data
  const { stats, loading: statsLoading, error: statsError } = useAdminStats();
  const { users, pagination, loading: usersLoading, updateUserStatus, approveHost } = useAdminUsers(page, 10, search);

  const handleUpdateUserStatus = async (userId: number, newStatus: 'active' | 'inactive' | 'suspended') => {
    try {
      await updateUserStatus(userId, newStatus);
    } catch (error) {
      console.error('Failed to update user status:', error);
    }
  };

  const handleApproveHost = async (userId: number) => {
    setApprovingHostIds(prev => new Set(prev).add(userId));
    try {
      await approveHost(userId);
    } catch (error) {
      console.error('Failed to approve host:', error);
      alert('Failed to approve host');
    } finally {
      setApprovingHostIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleApproveProperty = async (propertyId: number) => {
    setApprovingIds(prev => new Set(prev).add(propertyId));
    try {
      await adminService.approveProperty(propertyId);
      setManagedProperties(prev => prev.map(p => p.id === propertyId ? { ...p, status: 'active' } : p));
    } catch (err) {
      alert('Failed to approve property');
    } finally {
      setApprovingIds(prev => {
        const next = new Set(prev);
        next.delete(propertyId);
        return next;
      });
    }
  };

  const handleRejectProperty = async (propertyId: number) => {
    try {
      // For now reuse generic update to inactive (could be dedicated reject endpoint returning inactive/rejected)
      await adminService.rejectProperty(propertyId, 'Rejected by admin');
      setManagedProperties(prev => prev.map(p => p.id === propertyId ? { ...p, status: 'inactive' } : p));
    } catch (err) {
      alert('Failed to reject property');
    }
  };

  // Fetch a broader set of properties (pending + active + inactive) for listing management
  useEffect(() => {
    const fetchManaged = async () => {
      try {
        setManagedLoading(true);
        setManagedError(null);
        // Fetch multiple pages or statuses sequentially (simple approach)
        const statuses = ['pending','active','inactive'];
        const all: Property[] = [];
        for (const status of statuses) {
          const result = await adminService.getProperties({ status, limit: 50 });
          const adapted: Property[] = result.properties.map((ap: any) => ({
            id: ap.id,
            host_id: 0,
            title: ap.title,
            description: '',
            property_type: 'other',
            address: '',
            city: ap.city,
            country: '',
            max_guests: 0,
            bedrooms: 0,
            bathrooms: 0,
            beds: 0,
            price_per_night: ap.price_per_night,
            cleaning_fee: 0,
            security_deposit: 0,
            min_nights: 0,
            max_nights: 0,
            check_in_time: '15:00:00',
            check_out_time: '11:00:00',
            advance_booking_days: 0,
            status: ap.status,
            is_instant_book: false,
            total_bookings: 0,
            total_reviews: 0,
            average_rating: 0,
            created_at: ap.created_at,
            updated_at: ap.created_at,
            host: {
              id: 0,
              email: ap.host_email,
              first_name: ap.host_first_name,
              last_name: ap.host_last_name,
              is_host: true,
              host_approved: true,
              host_rating: 0,
              host_total_reviews: 0,
              guest_rating: 0,
              guest_total_reviews: 0,
              is_active: true,
              is_verified: true,
              role: 'host',
              created_at: ap.created_at,
              updated_at: ap.created_at
            } as any,
            images: ap.primary_image ? [{
              id: 0,
              property_id: ap.id,
              image_url: ap.primary_image,
              alt_text: ap.title,
              display_order: 0,
              is_primary: true,
              created_at: ap.created_at
            }] : []
          }));
          all.push(...adapted);
        }
        // Sort: pending first, then active, then inactive
        const order: Record<string, number> = { pending: 0, active: 1, inactive: 2 };
        all.sort((a,b) => (order[a.status] ?? 99) - (order[b.status] ?? 99));
        setManagedProperties(all);
      } catch (err: any) {
        setManagedError(err.message || 'Failed to load properties');
      } finally {
        setManagedLoading(false);
      }
    };
    fetchManaged();
  }, []);
  
  return (
    <div className="admin-dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Platform overview and management tools.</p>
        </div>
      </div>
      
      {/* Loading State */}
      {statsLoading ? (
        <div className="admin-loading">
          <div className="loading-spinner"></div>
          <p>Loading admin dashboard...</p>
        </div>
      ) : statsError ? (
        <div className="admin-error">
          <p>Error loading admin statistics: {statsError}</p>
        </div>
      ) : (
        <>
          {/* Metrics Section */}
          <div className="admin-stats-grid">
            <StatCard 
              icon={<DollarSignIcon />} 
              title="Total Revenue" 
              value={`$${stats?.total_revenue.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}`}
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
        </>
      )}

      {!statsLoading && !statsError && (
        <div className="admin-dashboard-layout">
          {/* User Management */}
          <div className="admin-management-card">
            <div className="admin-management-card__header">
              <h3 className="admin-management-card__title">User Management</h3>
              <input 
                type="text" 
                placeholder="Search users..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="admin-search-input"
              />
            </div>
            
            <div className="admin-table-container">
              {usersLoading ? (
                <div className="admin-table-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading users...</p>
                </div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Host Status</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user: AdminUserType) => {
                      // Check if user should be treated as host based on role or is_host flag
                      const isHostUser = !!user.is_host || user.role === 'host';
                      const isHostApproved = !!user.host_approved;

                      return (
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
                          {isHostUser ? (
                            isHostApproved ? (
                              <span className="admin-status-badge admin-status-badge--active">
                                Approved Host
                              </span>
                            ) : (
                              <span className="admin-status-badge admin-status-badge--pending">
                                Pending Approval
                              </span>
                            )
                          ) : (
                            <span className="admin-status-badge admin-status-badge--inactive">
                              Not a Host
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`admin-status-badge admin-status-badge--${user.status}`}>
                            {user.status}
                          </span>
                        </td>
                        <td>{new Date(user.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="admin-action-buttons">
                            {isHostUser && !isHostApproved && (
                              <button
                                className="button button--success button--small"
                                onClick={() => handleApproveHost(user.id)}
                                disabled={approvingHostIds.has(user.id)}
                              >
                                {approvingHostIds.has(user.id) ? 'Approving...' : 'Approve Host'}
                              </button>
                            )}
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
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Pagination */}
              {pagination && pagination.total_pages > 1 && (
                <div className="admin-pagination">
                  <button 
                    onClick={() => setPage(page - 1)} 
                    disabled={page <= 1}
                    className="button button--secondary button--small"
                  >
                    Previous
                  </button>
                  <span className="admin-pagination-info">
                    Page {page} of {pagination.total_pages} ({pagination.total} total)
                  </span>
                  <button 
                    onClick={() => setPage(page + 1)} 
                    disabled={page >= pagination.total_pages}
                    className="button button--secondary button--small"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Listing Management */}
          <div className="admin-management-card">
            <h3 className="admin-management-card__title">Listing Management</h3>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Listing</th>
                    <th>Host</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {managedLoading && (
                    <tr><td colSpan={4} style={{ textAlign: 'center' }}>Loading listings...</td></tr>
                  )}
                  {managedError && !managedLoading && (
                    <tr><td colSpan={4} style={{ color: 'red', textAlign: 'center' }}>{managedError}</td></tr>
                  )}
                  {!managedLoading && !managedError && managedProperties.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center' }}>No properties found.</td></tr>
                  )}
                  {!managedLoading && !managedError && managedProperties.map(prop => {
                    const rawStatus = (prop.status || '').toString();
                    // Lazy import safe guard if constants not yet imported
                    // (Assumes constants imported at top; if not, add: import { PROPERTY_STATUS_UI_MAP } from '../constants';)
                    const mapping: any = (PROPERTY_STATUS_UI_MAP as any)[rawStatus] || (PROPERTY_STATUS_UI_MAP as any)[rawStatus.toLowerCase?.() || ''];
                    const statusLabel = mapping ? mapping.label : (rawStatus ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1) : '—');
                    const statusClass = mapping ? mapping.badgeClass : rawStatus.toLowerCase();
                    return (
                      <tr key={prop.id}>
                        <td>
                          <div className="user-info-cell">
                            <img
                              className="cell__image"
                              src={prop.images && prop.images[0] ? getImageUrl((prop.images[0] as any).image_url || (prop.images[0] as any).url) : DEFAULT_PROPERTY_THUMBNAIL}
                              alt={prop.title}
                            />
                            <div>
                              <div className="cell__text-main">{prop.title}</div>
                              <div className="cell__text-subtle">{prop.city}{prop.city ? ', ' : ''}{prop.country}</div>
                            </div>
                          </div>
                        </td>
                        <td>{prop.host ? `${(prop.host as any).first_name || ''} ${(prop.host as any).last_name || ''}`.trim() : '—'}</td>
                        <td><span className={`status-badge status-badge--${statusClass}`}>{statusLabel}</span></td>
                        <td>
                          <div className="action-buttons-cell">
                            <button className="action-button" title="View" onClick={() => setViewingPropertyId(prop.id)}>
                              <EyeIcon />
                            </button>
                            {prop.status === 'pending' && (
                              <>
                                <button 
                                  className={`action-button action-button--approve ${approvingIds.has(prop.id) ? 'action-button--loading' : ''}`} 
                                  onClick={() => !approvingIds.has(prop.id) && handleApproveProperty(prop.id)} 
                                  title={approvingIds.has(prop.id) ? 'Approving...' : 'Approve'}
                                  disabled={approvingIds.has(prop.id)}
                                >
                                  {approvingIds.has(prop.id) ? (
                                    <span className="inline-spinner" aria-label="Approving"></span>
                                  ) : (
                                    <CheckCircleIcon />
                                  )}
                                </button>
                                <button className="action-button action-button--reject" onClick={() => handleRejectProperty(prop.id)} title="Reject">
                                  <XCircleIcon />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <ViewPropertyModal
            propertyId={viewingPropertyId}
            isOpen={!!viewingPropertyId}
            onClose={() => setViewingPropertyId(null)}
          />
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;