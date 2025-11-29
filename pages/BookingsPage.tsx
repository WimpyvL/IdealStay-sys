
import React, { useMemo, useState } from 'react';
import { useToast } from '../components/toast/ToastProvider';
import { Booking, Property } from '../types';
import BookingCard from '../components/BookingCard';
import ReviewModal from '../components/ReviewModal';
import BookingDetailsModal from '../components/BookingDetailsModal';
import { useGuestBookings, useHostBookings } from '../src/hooks';
import { useAuth } from '../src/contexts/AuthContext';
import { bookingsService } from '../src/services/bookings.service';
import './BookingsPage.css';
import { toAbsoluteImageUrl } from '../components/imageUtils';
import Avatar from '../components/Avatar';

interface BookingSectionProps {
  title: string;
  bookings: Booking[];
  onSelectProperty: (property: Property) => void;
  onSelectBooking: (booking: Booking) => void;
  onLeaveReview: (booking: Booking) => void;
}

const BookingSection: React.FC<BookingSectionProps> = ({ title, bookings, onSelectProperty, onSelectBooking, onLeaveReview }) => {
  return (
    <section className="booking-section">
      <h2 className="booking-section__title">{title}</h2>
      {bookings.length === 0 ? (
        <div className="section-empty-state">No {title.toLowerCase()}.</div>
      ) : (
        <div className="booking-grid">
          {bookings.map(booking => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onSelectProperty={onSelectProperty}
              onSelectBooking={onSelectBooking}
              onLeaveReview={onLeaveReview}
            />
          ))}
        </div>
      )}
    </section>
  );
};

interface HostBookingItemProps {
  booking: Booking;
  onApprove: (bookingId: number) => void;
  onDeny: (bookingId: number) => void;
  onViewDetails: (booking: Booking) => void;
  sectionTag: string; // e.g., Upcoming, In Progress, Completed, Cancelled, Pending Approval
}

const HostBookingItem: React.FC<HostBookingItemProps> = ({ booking, onApprove, onDeny, onViewDetails, sectionTag }) => {
  const checkInDate = new Date(booking.check_in_date);
  const checkOutDate = new Date(booking.check_out_date);
  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

  const getStatusBadge = () => {
    const statusMap: Record<string, { label: string; className: string }> = {
      pending: { label: 'Pending Approval', className: 'status-badge--pending' },
      confirmed: { label: 'Confirmed', className: 'status-badge--confirmed' },
      cancelled: { label: 'Cancelled', className: 'status-badge--cancelled' },
      completed: { label: 'Completed', className: 'status-badge--completed' }
    };
    const status = statusMap[booking.status] || { label: booking.status, className: '' };
    return <span className={`status-badge ${status.className}`}>{status.label}</span>;
  };

  return (
    <div className="host-booking-item">
      <div className="host-booking-header">
        <div className="host-booking-property">
          <h3>{booking.property_title || 'Property'}</h3>
          {getStatusBadge()}
        </div>
        <div className="host-booking-section-tag" data-tag={sectionTag.toLowerCase().replace(/\s+/g,'-')}>
          {sectionTag}
        </div>
      </div>
      <div className="host-booking-content">
        <div className="host-booking-guest">
          <Avatar
            src={toAbsoluteImageUrl(booking.guest_image) || booking.guest_image}
            alt={`${booking.guest_first_name} ${booking.guest_last_name}`}
            className="guest-avatar"
          />
          <div className="guest-info">
            <p className="guest-name">{booking.guest_first_name} {booking.guest_last_name}</p>
            <p className="guest-email">{booking.guest_email}</p>
          </div>
        </div>
        <div className="host-booking-details">
          <div className="booking-detail">
            <span className="detail-label">Check-in:</span>
            <span className="detail-value">{checkInDate.toLocaleDateString()}</span>
          </div>
          <div className="booking-detail">
            <span className="detail-label">Check-out:</span>
            <span className="detail-value">{checkOutDate.toLocaleDateString()}</span>
          </div>
          <div className="booking-detail">
            <span className="detail-label">Duration:</span>
            <span className="detail-value">{nights} night{nights !== 1 ? 's' : ''}</span>
          </div>
          <div className="booking-detail">
            <span className="detail-label">Guests:</span>
            <span className="detail-value">{booking.guests_count}</span>
          </div>
          <div className="booking-detail">
            <span className="detail-label">Total:</span>
            <span className="detail-value">${booking.total_amount?.toLocaleString()}</span>
          </div>
        </div>
      </div>
      <div className="host-booking-actions">
        {booking.status === 'pending' && (
          <>
            <button className="button button--success button--small" onClick={() => onApprove(booking.id)}>
              Approve
            </button>
            <button className="button button--danger button--small" onClick={() => onDeny(booking.id)}>
              Deny
            </button>
          </>
        )}
        <button className="button button--secondary button--small" onClick={() => onViewDetails(booking)}>
          View Details
        </button>
      </div>
    </div>
  );
};

interface HostBookingSectionProps {
  title: string;
  bookings: Booking[];
  onApprove: (bookingId: number) => void;
  onDeny: (bookingId: number) => void;
  onViewDetails: (booking: Booking) => void;
  sectionTag: string; // pass down to each booking item
}

const HostBookingSection: React.FC<HostBookingSectionProps> = ({ title, bookings, onApprove, onDeny, onViewDetails, sectionTag }) => {
  return (
    <section className="booking-section">
      <h2 className="booking-section__title">{title}</h2>
      {bookings.length === 0 ? (
        <div className="section-empty-state">No {title.toLowerCase()}.</div>
      ) : (
        <div className="host-bookings-list">
          {bookings.map(booking => (
            <HostBookingItem
              key={booking.id}
              booking={booking}
              onApprove={onApprove}
              onDeny={onDeny}
              onViewDetails={onViewDetails}
              sectionTag={sectionTag}
            />
          ))}
        </div>
      )}
    </section>
  );
};

interface BookingsPageProps {
  onSelectProperty: (property: Property) => void;
  onSelectBooking: (booking: Booking) => void;
}

const BookingsPage: React.FC<BookingsPageProps> = ({ onSelectProperty, onSelectBooking }) => {
  const [bookingToReview, setBookingToReview] = useState<Booking | null>(null);
  const [selectedHostBooking, setSelectedHostBooking] = useState<Booking | null>(null);

  // Get authentication state
  const { state } = useAuth();
  const { isAuthenticated, user } = state;
  const userRole = user?.role;

  // Determine if user is viewing as host or guest
  const isHostView = userRole === 'host' || userRole === 'admin';

  // Fetch bookings based on role
  const guestBookingsData = useGuestBookings();
  const hostBookingsData = useHostBookings();

  const { bookings, loading, error, refetch } = isHostView ? hostBookingsData : guestBookingsData;

  // Debug: Log bookings data
  React.useEffect(() => {
    console.log('=== BOOKINGS PAGE DEBUG ===');
    console.log('User ID:', user?.id);
    console.log('User role:', userRole);
    console.log('Is host view:', isHostView);
    console.log('Total bookings:', bookings.length);
    console.log('All bookings:', bookings);
    console.log('Booking IDs:', bookings.map(b => b.id));
    console.log('Property IDs:', bookings.map(b => b.property_id));
    console.log('Host IDs:', bookings.map(b => b.host_id));
    console.log('Guest IDs:', bookings.map(b => b.guest_id));
    if (isHostView) {
      console.log('Host bookings raw data:', hostBookingsData);
    } else {
      console.log('Guest bookings raw data:', guestBookingsData);
    }
  }, [bookings, userRole, isHostView, hostBookingsData, guestBookingsData, user]);

  // Handler for host actions
  const handleApproveBooking = async (bookingId: number) => {
    try {
      await bookingsService.updateBookingStatus({
        booking_id: bookingId,
        status: 'confirmed'
      });
      await refetch();
      alert('Booking approved successfully!');
    } catch (error) {
      console.error('Failed to approve booking:', error);
      alert('Failed to approve booking. Please try again.');
    }
  };

  const handleDenyBooking = async (bookingId: number) => {
    const reason = prompt('Please provide a reason for denying this booking (optional):');
    try {
      await bookingsService.cancelBooking(bookingId, reason || undefined);
      await refetch();
      alert('Booking denied successfully.');
    } catch (error) {
      console.error('Failed to deny booking:', error);
      alert('Failed to deny booking. Please try again.');
    }
  };

  const handleViewHostBookingDetails = (booking: Booking) => {
    setSelectedHostBooking(booking);
  };

  // Guest view handlers
  const handleOpenReviewModal = (booking: Booking) => {
    setBookingToReview(booking);
  };

  const handleCloseReviewModal = () => {
    setBookingToReview(null);
  };

  const { showToast } = useToast();

  const handleSubmitReview = async (review: { rating: number, text: string }) => {
    if (!bookingToReview) return;

    try {
      await bookingsService.addBookingReview(bookingToReview.id, {
        rating: review.rating,
        comment: review.text,
      });

      showToast('Thank you for your review! Your feedback has been submitted successfully.', { type: 'success' });
      handleCloseReviewModal();
      refetch();
    } catch (error: any) {
      console.error('Failed to submit review:', error);
      showToast(`Failed to submit review: ${error.message || 'Please try again later.'}`, { type: 'error' });
    }
  };

  // Filter bookings by status
  const pendingBookings = useMemo(() => {
    const filtered = bookings.filter(b => b.status === 'pending');
    console.log('Pending bookings:', filtered.length, filtered.map(b => ({ id: b.id, status: b.status })));
    return filtered;
  }, [bookings]);

  // Categorization logic
  // Upcoming: confirmed and check-in date is in the future
  // In Progress: confirmed and today's date is between check-in (inclusive) and check-out (exclusive)
  // Completed: status completed OR confirmed where checkout date is in the past
  // Cancelled: status cancelled
  const now = new Date();
  const upcomingBookings = useMemo(() => {
    const filtered = bookings.filter(b => b.status === 'confirmed' && new Date(b.check_in_date) > now);
    console.log('Upcoming bookings:', filtered.length, filtered.map(b => ({ id: b.id, status: b.status, checkIn: b.check_in_date })));
    return filtered;
  }, [bookings, now]);

  const inProgressBookings = useMemo(() => {
    const filtered = bookings.filter(b => {
      if (b.status !== 'confirmed') return false;
      const checkIn = new Date(b.check_in_date);
      const checkOut = new Date(b.check_out_date);
      return checkIn <= now && checkOut > now; // currently staying
    });
    console.log('In-progress bookings:', filtered.length, filtered.map(b => ({ id: b.id, status: b.status, checkIn: b.check_in_date, checkOut: b.check_out_date })));
    return filtered;
  }, [bookings, now]);

  const completedBookings = useMemo(() => {
    const filtered = bookings.filter(b => b.status === 'completed' || (b.status === 'confirmed' && new Date(b.check_out_date) <= now));
    console.log('Completed bookings:', filtered.length, filtered.map(b => ({ id: b.id, status: b.status, checkOut: b.check_out_date })));
    return filtered;
  }, [bookings, now]);

  const cancelledBookings = useMemo(() => {
    const filtered = bookings.filter(b => b.status === 'cancelled');
    console.log('Cancelled bookings:', filtered.length, filtered.map(b => ({ id: b.id, status: b.status })));
    return filtered;
  }, [bookings]);

  const hasBookings = bookings.length > 0;

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="bookings-page">
        <div className="placeholder-container">
          <h1 className="page-title-standalone">Sign In Required</h1>
          <p className="page-subtitle">Please sign in to view your bookings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bookings-page">
      <h1 className="page-title">
        {isHostView ? 'Host Bookings' : 'My Bookings'}
      </h1>
      <p className="page-subtitle">
        {isHostView
          ? 'Manage bookings for your properties.'
          : 'View and manage your travel plans.'}
      </p>

      {loading ? (
        <div className="bookings-page__loading">
          <div className="loading-spinner"></div>
          <p>Loading your bookings...</p>
        </div>
      ) : error ? (
        <div className="bookings-page__error">
          <div className="error-message">
            <h3>Unable to load bookings</h3>
            <p>{error}</p>
            <button onClick={() => refetch()} className="retry-button">
              Try Again
            </button>
          </div>
        </div>
      ) : hasBookings ? (
        <div className="bookings-content">
          {isHostView ? (
            <>
              <HostBookingSection
                title="Pending Approval"
                bookings={pendingBookings}
                onApprove={handleApproveBooking}
                onDeny={handleDenyBooking}
                onViewDetails={handleViewHostBookingDetails}
                sectionTag="Pending"
              />
              <HostBookingSection
                title="Upcoming Stays"
                bookings={upcomingBookings}
                onApprove={handleApproveBooking}
                onDeny={handleDenyBooking}
                onViewDetails={handleViewHostBookingDetails}
                sectionTag="Upcoming"
              />
              <HostBookingSection
                title="In Progress"
                bookings={inProgressBookings}
                onApprove={handleApproveBooking}
                onDeny={handleDenyBooking}
                onViewDetails={handleViewHostBookingDetails}
                sectionTag="In Progress"
              />
              <HostBookingSection
                title="Completed"
                bookings={completedBookings}
                onApprove={handleApproveBooking}
                onDeny={handleDenyBooking}
                onViewDetails={handleViewHostBookingDetails}
                sectionTag="Completed"
              />
              <HostBookingSection
                title="Cancelled"
                bookings={cancelledBookings}
                onApprove={handleApproveBooking}
                onDeny={handleDenyBooking}
                onViewDetails={handleViewHostBookingDetails}
                sectionTag="Cancelled"
              />
            </>
          ) : (
            <>
              <BookingSection title="Pending Approval" bookings={pendingBookings} onSelectProperty={onSelectProperty} onSelectBooking={onSelectBooking} onLeaveReview={handleOpenReviewModal} />
              <BookingSection title="Upcoming Stays" bookings={upcomingBookings} onSelectProperty={onSelectProperty} onSelectBooking={onSelectBooking} onLeaveReview={handleOpenReviewModal} />
              <BookingSection title="In Progress" bookings={inProgressBookings} onSelectProperty={onSelectProperty} onSelectBooking={onSelectBooking} onLeaveReview={handleOpenReviewModal} />
              <BookingSection title="Completed" bookings={completedBookings} onSelectProperty={onSelectProperty} onSelectBooking={onSelectBooking} onLeaveReview={handleOpenReviewModal} />
              <BookingSection title="Cancelled" bookings={cancelledBookings} onSelectProperty={onSelectProperty} onSelectBooking={onSelectBooking} onLeaveReview={handleOpenReviewModal} />
            </>
          )}
        </div>
      ) : (
        <div className="placeholder-container">
            <h2 className="page-title-standalone">
              {isHostView ? 'No Bookings Yet' : 'No Trips Booked Yet'}
            </h2>
            <p className="page-subtitle">
              {isHostView
                ? 'Bookings for your properties will appear here.'
                : 'When you\'re ready to plan your next adventure, we\'re here to help.'}
            </p>
        </div>
      )}

      {/* Guest Review Modal */}
      {bookingToReview && (
        <ReviewModal
          booking={bookingToReview}
          onClose={handleCloseReviewModal}
          onSubmit={handleSubmitReview}
        />
      )}

      {/* Host Booking Details Modal */}
      {selectedHostBooking && (
        <BookingDetailsModal
          booking={selectedHostBooking}
          isOpen={true}
          onClose={() => setSelectedHostBooking(null)}
        />
      )}
    </div>
  );
};

export default BookingsPage;
