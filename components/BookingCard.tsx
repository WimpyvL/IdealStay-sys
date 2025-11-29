

import React from 'react';
import { Booking, Property } from '../types';
import './BookingCard.css';
import { CalendarIcon } from './icons/Icons';
import { propertiesService } from '../src/services/properties.service';
import { resolvePrimaryPropertyImage, toAbsoluteImageUrl } from './imageUtils';

interface BookingCardProps {
  booking: Booking;
  onSelectProperty: (property: Property) => void;
  onSelectBooking: (booking: Booking) => void;
  onLeaveReview: (booking: Booking) => void;
}

const BookingCard: React.FC<BookingCardProps> = ({ booking, onSelectProperty, onSelectBooking, onLeaveReview }) => {
  const { property, total_amount, status, check_in_date, check_out_date } = booking;
  const [resolvedProperty, setResolvedProperty] = React.useState<Property | undefined>(property);
  const [imageUrl, setImageUrl] = React.useState<string>('');

  const parseDate = (value?: string): Date | null => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };

  const checkInDate = parseDate(check_in_date);
  const checkOutDate = parseDate(check_out_date);

  const formatDate = (date: Date | null): string => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatYear = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { year: 'numeric' });
  };

  const dateRange = checkInDate && checkOutDate
    ? `${formatDate(checkInDate)} - ${formatDate(checkOutDate)}, ${formatYear(checkOutDate)}`
    : 'Dates unavailable';

  // Derive display status from database status
  const getDisplayStatus = (): string => {
    if (status === 'cancelled') return 'cancelled';
    if (status === 'completed') return 'past';
    if (status === 'confirmed' && checkOutDate && checkOutDate < new Date()) return 'past';
    if (status === 'confirmed' && checkInDate && checkInDate > new Date()) return 'upcoming';
    if (status === 'pending') return 'pending';
    return status;
  };

  const displayStatus = getDisplayStatus();

  const handleViewDetails = () => {
    onSelectBooking(booking);
  };

  const handleViewProperty = () => {
    if (property) {
      onSelectProperty(property);
    }
  }

  const handleLeaveReview = () => {
    onLeaveReview(booking);
  }

  const renderButtons = () => {
    // Use database status values
    if (status === 'cancelled') {
      return <button className="button button--primary button--small" onClick={handleViewProperty}>Book Again</button>;
    }

    if (status === 'completed' || (status === 'confirmed' && checkOutDate && checkOutDate < new Date())) {
      // Check if review already exists
      const hasReview = booking.review_id !== null && booking.review_id !== undefined;

      return (
        <>
          <button className="button button--secondary button--small" onClick={handleViewProperty}>Book Again</button>
          {!hasReview && (
            <button className="button button--primary button--small" onClick={handleLeaveReview}>Leave a Review</button>
          )}
        </>
      );
    }

    if (status === 'confirmed' || status === 'pending') {
      return (
        <button className="button button--primary button--small" onClick={handleViewDetails}>View Details</button>
      );
    }

    return null;
  };

  // Resolve image with extended fallbacks + optional fetch
  React.useEffect(() => {
    const p = resolvedProperty;
    const attemptResolve = (prop?: Property): string | undefined => {
      if (!prop) return undefined;
      const primaryField = (prop as any).primary_image as string | undefined;
      const fromResolver = resolvePrimaryPropertyImage(prop as any);
      const firstImage = prop.images && prop.images.length > 0 ? prop.images[0].image_url : undefined;
      const legacyArray = (prop as any).imageUrls && (prop as any).imageUrls.length > 0 ? (prop as any).imageUrls[0] : undefined;
      const flatImage = (prop as any).image_url as string | undefined;
      return primaryField || fromResolver || firstImage || legacyArray || flatImage;
    };

    // Some booking endpoints may flatten fields directly on the booking:
    const flattened = (booking as any).property_image || (booking as any).property_primary_image || (booking as any).primary_image || (booking as any).image_url;
    let candidate = flattened || attemptResolve(p);

    if (candidate) {
      setImageUrl(toAbsoluteImageUrl(candidate) || '');
      return;
    }

    // If we still have no image but we have property_id, attempt a fetch
    const controller = new AbortController();
    if (!candidate && booking.property_id) {
      (async () => {
        try {
          const full = await propertiesService.getPropertyById(booking.property_id);
          setResolvedProperty(full);
          const afterFetch = attemptResolve(full);
          if (afterFetch) setImageUrl(toAbsoluteImageUrl(afterFetch) || '');
        } catch (err) {
          console.warn('Failed to fetch property for booking image', booking.id, err);
        }
      })();
    }
    return () => controller.abort();
  }, [booking, resolvedProperty]);

  const primaryImage = imageUrl;

  return (
    <div className="booking-card">
      <div className="booking-card__image-wrapper">
        {primaryImage ? (
          <img src={primaryImage} alt={(resolvedProperty || property)?.title || 'Property'} className="booking-card__image" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="booking-card__image booking-card__image--placeholder" aria-label="No image available" />
        )}
        <span className={`booking-card__status-badge booking-card__status-badge--${displayStatus}`}>
          {displayStatus}
        </span>
      </div>
      <div className="booking-card__info">
  <p className="booking-card__location">{(resolvedProperty || property) ? `${(resolvedProperty || property)?.city}, ${(resolvedProperty || property)?.country}` : 'Location unavailable'}</p>
  <h3 className="booking-card__title">{(resolvedProperty || property)?.title || 'Property unavailable'}</h3>
        <div className="booking-card__meta">
            <div className="booking-card__date">
                <CalendarIcon/>
                <span>{dateRange}</span>
            </div>
            <p className="booking-card__price">
              Total: <span>${Number(total_amount ?? 0).toLocaleString()}</span>
            </p>
        </div>
      </div>
      <div className="booking-card__actions">
        {renderButtons()}
      </div>
    </div>
  );
};

export default BookingCard;