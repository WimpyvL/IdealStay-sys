import React from 'react';
import Modal from './Modal';
import { Booking } from '../types';
import { toAbsoluteImageUrl } from './imageUtils';
import './BookingDetailsModal.css';

interface BookingDetailsModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
}

const formatCurrency = (v: number) => v.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({ booking, isOpen, onClose }) => {
  if (!isOpen || !booking) return null;

  const nights = (() => {
    try {
      const checkIn = new Date(booking.check_in_date);
      const checkOut = new Date(booking.check_out_date);
      const diff = (checkOut.getTime() - checkIn.getTime()) / 86400000;
      return diff || 0;
    } catch { return 0; }
  })();

  const propertyTitle = booking.property?.title || `Property #${booking.property_id}`;
  const guestName = booking.guest
    ? `${booking.guest.first_name || ''} ${booking.guest.last_name || ''}`.trim()
    : (booking.guest_first_name || booking.guest_last_name
        ? `${booking.guest_first_name || ''} ${booking.guest_last_name || ''}`.trim()
        : `Guest #${booking.guest_id}`);

  const guestEmail = booking.guest?.email || booking.guest_email;
  const guestPhone = booking.guest?.phone || booking.guest_phone;
  const guestImage = toAbsoluteImageUrl(booking.guest?.profile_image_url || booking.guest_image);

  return (
    <Modal title={`Booking #${booking.id}`} onClose={onClose}>
      <div className="booking-details">
        <header className="booking-summary">
          <div className="booking-summary__main">
            <h3 className="booking-summary__property" title={propertyTitle}>{propertyTitle}</h3>
            <div className="booking-summary__badges">
              <span className={`status-pill status-pill--${booking.status}`}>{booking.status}</span>
              <span className={`status-pill status-pill--pay-${booking.payment_status}`}>{booking.payment_status}</span>
            </div>
          </div>
          <div className="booking-summary__sub">
            <span>{guestName}</span>
            <span className="dot-separator" aria-hidden>•</span>
            <span>{nights} night{nights !== 1 ? 's' : ''}</span>
            <span className="dot-separator" aria-hidden>•</span>
            <span>{booking.guests_count} guest{booking.guests_count !== 1 ? 's' : ''}</span>
          </div>
        </header>

        {(guestName || guestEmail || guestPhone) && (
          <section className="booking-details__section" aria-labelledby="guest-heading">
            <h4 id="guest-heading" className="section-title">Guest</h4>
            <div className="guest-card">
              <div className="guest-card__main">
                {guestImage && <img src={guestImage} alt={guestName || 'Guest'} className="guest-card__avatar" />}
                <div className="guest-card__info">
                  <div className="guest-card__name" title={guestName}>{guestName}</div>
                  <div className="guest-card__contacts">
                    {guestEmail && <span className="guest-card__email" title={guestEmail}>{guestEmail}</span>}
                    {guestPhone && <span className="guest-card__phone" title={guestPhone}>{guestPhone}</span>}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="guest-card__chat-btn"
                onClick={() => {
                  if (booking.conversation_id) {
                    localStorage.setItem('openConversationId', String(booking.conversation_id));
                  } else {
                    // Fallback: store intended participant to start new conversation server-side
                    localStorage.setItem('startChatWithUserId', String(booking.guest_id));
                  }
                  window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'Messages' } }));
                  // As App does not currently listen, fallback to direct set via hash to trigger any watchers
                  window.location.hash = '#messages';
                }}
              >Chat</button>
            </div>
          </section>
        )}

        {booking.property && (
          <section className="booking-details__section" aria-labelledby="property-heading">
            <h4 id="property-heading" className="section-title">Property Details</h4>
            <div className="property-info">
              <h5 className="property-info__title">{booking.property.title}</h5>
              <p className="property-info__description">{booking.property.description}</p>
              <dl className="data-grid">
                <div><dt>Property Type</dt><dd style={{ textTransform: 'capitalize' }}>{booking.property.property_type}</dd></div>
                <div><dt>Max Guests</dt><dd>{booking.property.max_guests}</dd></div>
                <div><dt>Street Address</dt><dd>{booking.property.address}</dd></div>
                <div><dt>City</dt><dd>{booking.property.city}</dd></div>
                {booking.property.state && <div><dt>State</dt><dd>{booking.property.state}</dd></div>}
                {booking.property.postal_code && <div><dt>Postal Code</dt><dd>{booking.property.postal_code}</dd></div>}
                <div><dt>Country</dt><dd>{booking.property.country}</dd></div>
                <div><dt>Bedrooms</dt><dd>{booking.property.bedrooms}</dd></div>
                <div><dt>Bathrooms</dt><dd>{booking.property.bathrooms}</dd></div>
                <div><dt>Beds</dt><dd>{booking.property.beds}</dd></div>
                <div><dt>Minimum Nights</dt><dd>{booking.property.min_nights}</dd></div>
                <div><dt>Maximum Nights</dt><dd>{booking.property.max_nights}</dd></div>
              </dl>
            </div>
          </section>
        )}

        <section className="booking-details__section" aria-labelledby="stay-heading">
          <h4 id="stay-heading" className="section-title">Stay Details</h4>
          <dl className="data-grid">
            <div><dt>Check In</dt><dd>{new Date(booking.check_in_date).toLocaleDateString()}</dd></div>
            <div><dt>Check Out</dt><dd>{new Date(booking.check_out_date).toLocaleDateString()}</dd></div>
            <div><dt>Nights</dt><dd>{nights}</dd></div>
            <div><dt>Guests</dt><dd>{booking.guests_count}</dd></div>
          </dl>
        </section>

        <section className="booking-details__section" aria-labelledby="pricing-heading">
          <h4 id="pricing-heading" className="section-title">Pricing</h4>
          <table className="pricing-table">
            <tbody>
              <tr><th scope="row">Base Price</th><td>{formatCurrency(booking.base_price)}</td></tr>
              <tr><th scope="row">Cleaning Fee</th><td>{formatCurrency(booking.cleaning_fee)}</td></tr>
              <tr><th scope="row">Security Deposit</th><td>{formatCurrency(booking.security_deposit)}</td></tr>
              <tr><th scope="row">Service Fee</th><td>{formatCurrency(booking.taxes)}</td></tr>
            </tbody>
            <tfoot>
              <tr className="pricing-total"><th scope="row">Total</th><td>{formatCurrency(booking.total_amount)}</td></tr>
            </tfoot>
          </table>
        </section>

        {(booking.special_requests || booking.guest_notes || booking.host_notes) && (
          <section className="booking-details__section" aria-labelledby="notes-heading">
            <h4 id="notes-heading" className="section-title">Notes & Requests</h4>
            <div className="notes-stack">
              {booking.special_requests && (
                <div className="note-block"><h5>Special Requests</h5><p>{booking.special_requests}</p></div>
              )}
              {booking.guest_notes && (
                <div className="note-block"><h5>Guest Notes</h5><p>{booking.guest_notes}</p></div>
              )}
              {booking.host_notes && (
                <div className="note-block"><h5>Host Notes</h5><p>{booking.host_notes}</p></div>
              )}
            </div>
          </section>
        )}

        <section className="booking-details__section" aria-labelledby="meta-heading">
          <h4 id="meta-heading" className="section-title">Meta</h4>
          <dl className="data-grid">
            <div><dt>Created</dt><dd>{new Date(booking.created_at).toLocaleString()}</dd></div>
            <div><dt>Updated</dt><dd>{new Date(booking.updated_at).toLocaleString()}</dd></div>
            {booking.payment_method && (<div><dt>Pay Method</dt><dd>{booking.payment_method}</dd></div>)}
            {booking.payment_reference && (<div><dt>Pay Ref</dt><dd>{booking.payment_reference}</dd></div>)}
          </dl>
        </section>
      </div>
    </Modal>
  );
};

export default BookingDetailsModal;
