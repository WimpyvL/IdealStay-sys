import React, { useState } from 'react';
import { Booking } from '../types';
import { ChevronLeftIcon } from '../components/icons/Icons';
import Modal from '../components/Modal';
import Avatar from '../components/Avatar';
import './BookingDetailPage.css';
import { resolvePrimaryPropertyImage } from '../components/imageUtils';
import { createConversation } from '../src/services/messages.service';
import { getImageUrl } from '../constants';

interface BookingDetailPageProps {
  booking: Booking;
  onBack: () => void;
  onUpdateBooking: (booking: Booking) => void;
}

const BookingDetailPage: React.FC<BookingDetailPageProps> = ({ booking, onBack, onUpdateBooking }) => {
  const { property, check_in_date, check_out_date, total_amount, base_price, cleaning_fee, status, payment_status } = booking;
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [contactingHost, setContactingHost] = useState(false);

  const parseDate = (dateStr: string): Date => {
    return new Date(dateStr);
  };

  const checkInDate = parseDate(check_in_date);
  const checkOutDate = parseDate(check_out_date);

  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const nights = (() => {
    const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  })();

  const nightlyRate = base_price / nights;
  const serviceFee = total_amount - base_price - cleaning_fee;

  const handleConfirmCancel = () => {
    onUpdateBooking({ ...booking, status: 'cancelled' });
    onBack();
  };

  const primaryImage = (() => {
    if (!property) return '';
    // Check for images array from backend (database-aligned)
    if (property.images && property.images.length > 0) {
      const primaryImg = property.images.find(img => img.is_primary);
      const imageUrl = primaryImg ? primaryImg.image_url : property.images[0].image_url;
      return getImageUrl(imageUrl);
    }
    // Fallback to imageUrls if present (legacy support)
    const direct = (property as any).imageUrls && (property as any).imageUrls.length > 0 ? (property as any).imageUrls[0] : undefined;
    const resolved = resolvePrimaryPropertyImage(property as any);
    return getImageUrl(direct || resolved || '');
  })();

  return (
    <div className="booking-detail-page">
      <button onClick={onBack} className="back-button">
        <ChevronLeftIcon className="back-button__icon" />
        Back to My Bookings
      </button>

      <div className="booking-detail-header">
        <h1 className="booking-detail-header__title">Trip Details</h1>
        <span className={`booking-detail__status-badge booking-detail__status-badge--${status}`}>
            {status}
        </span>
      </div>

      <div className="booking-detail-layout">
        <div className="booking-detail-content">
          <div className="booking-detail-card">
            <h2 className="booking-detail-card__title">{property.title}</h2>
            <p className="booking-detail-card__location">{property.location}</p>
            <hr className="divider" />
            <div className="booking-detail-grid">
              <div>
                <p className="grid-item__label">Check-in</p>
                <p className="grid-item__value">{formatDate(checkInDate)}</p>
              </div>
              <div>
                <p className="grid-item__label">Check-out</p>
                <p className="grid-item__value">{formatDate(checkOutDate)}</p>
              </div>
            </div>
             <hr className="divider" />
             <div>
                <p className="grid-item__label">Guests</p>
                <p className="grid-item__value">{booking.guests_count} guests</p>
            </div>
          </div>
          <div className="booking-detail-card">
             <h2 className="booking-detail-card__title">Price Details</h2>
              <div className="price-breakdown">
                <div className="price-item">
                    <span>${nightlyRate.toLocaleString()} x {nights} nights</span>
                    <span>${base_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                {cleaning_fee > 0 && (
                  <div className="price-item">
                      <span>Cleaning fee</span>
                      <span>${cleaning_fee.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {serviceFee > 0 && (
                  <div className="price-item">
                      <span>Service fee</span>
                      <span>${serviceFee.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <hr className="divider" />
                <div className="price-item price-item--total">
                    <span>Total (USD)</span>
                    <span>${total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
          </div>

          {/* Payment Section - Show if payment is not completed */}
          {payment_status !== 'paid' && (status === 'confirmed' || status === 'pending') && (
            <div className="booking-detail-card booking-detail-card--payment">
              <div className="payment-header">
                <h2 className="booking-detail-card__title">Payment Required</h2>
                <span className={`payment-status-badge payment-status-badge--${payment_status}`}>
                  {payment_status === 'pending' ? 'Unpaid' : payment_status}
                </span>
              </div>

              <p className="booking-detail-card__location" style={{ marginTop: '0.5rem' }}>
                Complete your payment to confirm your reservation.
              </p>

              <div className="payment-info">
                <div className="payment-info-item">
                  <span className="payment-info-label">Amount Due</span>
                  <span className="payment-info-value">${total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="payment-info-item">
                  <span className="payment-info-label">Payment Status</span>
                  <span className="payment-info-value">{payment_status === 'pending' ? 'Awaiting Payment' : payment_status.charAt(0).toUpperCase() + payment_status.slice(1)}</span>
                </div>
              </div>

              <div className="payment-methods">
                <p className="payment-methods__title">Accepted Payment Methods</p>
                <div className="payment-methods__icons">
                  <div className="payment-method-icon">💳 Credit Card</div>
                  <div className="payment-method-icon">💰 Debit Card</div>
                  <div className="payment-method-icon">🏦 Bank Transfer</div>
                </div>
              </div>

              <button
                className="button button--success button--full"
                style={{ marginTop: '1.5rem' }}
                onClick={() => setShowPaymentModal(true)}
              >
                Pay Now - ${total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </button>
            </div>
          )}

          {(status === 'confirmed' || status === 'pending') && checkInDate > new Date() && (
             <div className="booking-detail-card">
              <h2 className="booking-detail-card__title">Manage Booking</h2>
              <p className="booking-detail-card__location">Need to change your plans? You can cancel your reservation here.</p>
              <button
                className="button button--danger button--full"
                style={{ marginTop: '1.5rem' }}
                onClick={() => setShowCancelModal(true)}
              >
                Cancel Booking
              </button>
            </div>
          )}
        </div>
        <aside className="booking-detail-sidebar">
          <div className="booking-detail-card">
            {primaryImage ? (
              <img src={primaryImage} alt={property.title} className="sidebar__image" />
            ) : (
              <div className="sidebar__image sidebar__image--placeholder" aria-label="No image available" />
            )}
            <div className="sidebar__host-info">
              <Avatar
                src={booking.host_image || property?.host?.profile_image_url}
                alt={
                  booking.host_first_name && booking.host_last_name
                    ? `${booking.host_first_name} ${booking.host_last_name}`
                    : property?.host
                    ? `${property.host.first_name} ${property.host.last_name}`
                    : 'Host'
                }
                className="sidebar__host-avatar"
                size={56}
              />
              <div>
                <p className="sidebar__host-label">Hosted by</p>
                <p className="sidebar__host-name">
                  {booking.host_first_name && booking.host_last_name
                    ? `${booking.host_first_name} ${booking.host_last_name}`
                    : property?.host
                    ? `${property.host.first_name} ${property.host.last_name}`
                    : 'Host'}
                </p>
              </div>
            </div>
             <button
               className="button button--primary button--full"
               disabled={contactingHost}
               onClick={async () => {
                 try {
                   if (contactingHost) return;
                   setContactingHost(true);
                   // If booking already has a conversation id, just open it.
                   if (booking.conversation_id) {
                     localStorage.setItem('openConversationId', String(booking.conversation_id));
                   } else {
                     // Attempt to create (or rely on backend dedupe) a conversation between guest & host scoped to property/booking
                     const participantIds: number[] = [];
                     if (booking.guest_id) participantIds.push(booking.guest_id);
                     if (booking.host_id) participantIds.push(booking.host_id);
                     // Fallback to current logged in user if not present in booking (shouldn't happen normally)
                     // If somehow guest/host not both available, we abort below; no global user context available here.
                     if (participantIds.length >= 2) {
                       const convId = await createConversation({
                         participant_ids: participantIds,
                         property_id: booking.property_id,
                         booking_id: booking.id
                       });
                       if (convId) {
                         localStorage.setItem('openConversationId', String(convId));
                       } else {
                         // If backend didn't return id, store intent to start chat with host
                         localStorage.setItem('startChatWithUserId', String(booking.host_id));
                       }
                     } else {
                       // Not enough information to start conversation
                       alert('Unable to start conversation: missing participant IDs.');
                       return;
                     }
                   }
                   // Dispatch navigation event (pattern used elsewhere)
                   window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'Messages' } }));
                   window.location.hash = '#messages';
                 } catch (err) {
                   console.error('Failed to contact host', err);
                   alert('Sorry, we could not open the chat. Please try again.');
                 } finally {
                   setContactingHost(false);
                 }
               }}
             >{contactingHost ? 'Opening…' : 'Contact Host'}</button>
          </div>
        </aside>
      </div>

      {showPaymentModal && (
        <Modal
            title="Complete Payment"
            onClose={() => setShowPaymentModal(false)}
        >
            <div className="payment-modal-content">
              <div className="payment-summary">
                <h3 className="payment-summary__title">Payment Summary</h3>
                <div className="payment-summary-item">
                  <span>Property</span>
                  <span>{property.title}</span>
                </div>
                <div className="payment-summary-item">
                  <span>Check-in</span>
                  <span>{formatDate(checkInDate)}</span>
                </div>
                <div className="payment-summary-item">
                  <span>Check-out</span>
                  <span>{formatDate(checkOutDate)}</span>
                </div>
                <div className="payment-summary-item payment-summary-item--total">
                  <span>Total Amount</span>
                  <span>${total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="payment-notice">
                <p>
                  <strong>Note:</strong> Payment gateway integration is coming soon.
                  For now, please contact the host to arrange payment or visit our office.
                </p>
              </div>
            </div>

            <div className="modal__actions">
                <button className="button button--secondary" onClick={() => setShowPaymentModal(false)}>
                    Close
                </button>
                <button
                  className="button button--primary"
                  onClick={() => {
                    alert('Payment gateway integration coming soon! Please contact the host or visit our office to complete payment.');
                    setShowPaymentModal(false);
                  }}
                >
                    Proceed to Payment
                </button>
            </div>
        </Modal>
      )}

      {showCancelModal && (
        <Modal
            title="Confirm Cancellation"
            onClose={() => setShowCancelModal(false)}
        >
            <p>Are you sure you want to cancel this booking? This action cannot be undone.</p>
            <div className="modal__actions">
                <button className="button button--secondary" onClick={() => setShowCancelModal(false)}>
                    Go Back
                </button>
                <button className="button button--danger" onClick={handleConfirmCancel}>
                    Yes, Cancel
                </button>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default BookingDetailPage;