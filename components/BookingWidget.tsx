
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Property } from '../types';
import { StarIcon } from './icons/Icons';
import { formatRating } from './ratingUtils';
import Calendar from './Calendar';
import NotificationModal from './NotificationModal';
import { usePricingCalculation, useAvailabilityCheck } from '../src/hooks';
import { useAuth } from '../src/contexts/AuthContext';
import { bookingsService } from '../src/services';
import './BookingWidget.css';

interface BookingWidgetProps {
  property: Property;
}

const BookingWidget: React.FC<BookingWidgetProps> = ({ property }) => {
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [guests, setGuests] = useState(1);
  const [isCalendarOpen, setCalendarOpen] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  }>({
    isOpen: false,
    message: ''
  });
  const widgetRef = useRef<HTMLDivElement>(null);
  
  // Get authentication state
  const { state: authState } = useAuth();
  const { isAuthenticated } = authState;
  
  // API hooks for pricing and availability
  const { pricing, loading: pricingLoading, calculatePricing } = usePricingCalculation();
  const { availability, loading: availabilityLoading, checkAvailability } = useAvailabilityCheck();
  // Set of booked date strings (YYYY-MM-DD) representing nights (check_in inclusive, checkout exclusive)
  const [bookedDateSet, setBookedDateSet] = useState<Set<string>>(new Set());
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Close calendar on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  // Helper to format date as YYYY-MM-DD in local timezone
  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Check pricing and availability when dates change
  useEffect(() => {
    if (checkIn && checkOut && checkIn < checkOut) {
      const checkInStr = formatDateForAPI(checkIn);
      const checkOutStr = formatDateForAPI(checkOut);

      // Calculate pricing (includes guest count for validation)
      calculatePricing(property.id, checkInStr, checkOutStr, guests);

      // Check availability (availability endpoint doesn't need guest count for conflict checking)
      checkAvailability(property.id, checkInStr, checkOutStr);
    }
  }, [checkIn, checkOut, guests, property.id, calculatePricing, checkAvailability]);

  // Fetch existing booked date ranges (confirmed + pending) to disable dates for next 6 months
  const fetchBookedDates = useCallback(async () => {
    try {
      setLoadingBookings(true);
  const now = new Date();
  // Start a few days in the past to capture existing bookings that began earlier but still influence availability
  const pastBuffer = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const sixMonths = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
  const start = formatDateForAPI(pastBuffer);
      const end = formatDateForAPI(sixMonths);
      const booked = await bookingsService.getPropertyBookedDates(property.id, start, end);
      if (booked && booked.bookings) {
        const dateSet = new Set<string>();
        booked.bookings.forEach((b: any) => {
          if (!b.check_in_date || !b.check_out_date) return;
          // Normalize to YYYY-MM-DD (handle strings or Date objects returned from API)
          const checkInStr = typeof b.check_in_date === 'string' ? b.check_in_date.slice(0, 10) : b.check_in_date;
          const checkOutStrRaw = typeof b.check_out_date === 'string' ? b.check_out_date.slice(0, 10) : b.check_out_date;

          // Business rule: User expects BOTH the stay nights and the checkout calendar day to be blocked
          // Example: booking 2025-10-01 -> 2025-10-04 should block Oct 1,2,3,4 (even though night of 4th isn't stayed).
          // We'll iterate inclusive of checkout date. If later you adopt "checkout available for new arrivals", change loop end to (endD - 1 day).
          const startD = new Date(checkInStr + 'T00:00:00');
          const endDInclusive = new Date(checkOutStrRaw + 'T00:00:00');
          for (let d = new Date(startD); d <= endDInclusive; d.setDate(d.getDate() + 1)) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dateSet.add(`${y}-${m}-${day}`);
          }
        });
        console.log(`Loaded ${dateSet.size} booked dates for property ${property.id}:`, Array.from(dateSet).sort());
        setBookedDateSet(dateSet);
      }
    } catch (error) {
      console.error('Failed to fetch booked dates:', error);
      // Continue with empty set - allows booking widget to still function
    } finally {
      setLoadingBookings(false);
    }
  }, [property.id]);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      if (!cancelled) await fetchBookedDates();
    };
    fetch();
    return () => { cancelled = true; };
  }, [fetchBookedDates]);

  // Predicate: disable date if string in bookedDateSet
  const isDateBooked = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return bookedDateSet.has(`${y}-${m}-${day}`);
  };

  const handleDateSelect = (date: Date) => {
    // Clear any previous validation errors
    setValidationError(null);

    if (!checkIn || (checkIn && checkOut)) {
      // Starting a new selection
      setCheckIn(date);
      setCheckOut(null);
    } else if (date > checkIn) {
      // Selecting checkout date
      const diffTime = date.getTime() - checkIn.getTime();
      const selectedNights = Math.round(diffTime / (1000 * 60 * 60 * 24));

      // Validate min_nights
      const minNights = property.min_nights || 1;
      if (selectedNights < minNights) {
        setValidationError(`Minimum stay is ${minNights} night${minNights > 1 ? 's' : ''}. Please select a longer stay.`);
        return;
      }

      // Validate max_nights
      const maxNights = property.max_nights || 365;
      if (selectedNights > maxNights) {
        setValidationError(`Maximum stay is ${maxNights} night${maxNights > 1 ? 's' : ''}. Please select a shorter stay.`);
        return;
      }

      // Valid selection
      setCheckOut(date);
      setCalendarOpen(false);
    } else {
      // Date is before check-in, restart selection
      setCheckIn(date);
      setCheckOut(null);
    }
  };

  const clearDates = () => {
    setCheckIn(null);
    setCheckOut(null);
    setValidationError(null);
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const nights = useMemo(() => {
    if (checkIn && checkOut && checkOut > checkIn) {
      // Calculate nights directly from date objects
      const diffTime = checkOut.getTime() - checkIn.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    }
    return 0;
  }, [checkIn, checkOut]);

  // Use API pricing if available, fallback to simple calculation
  // Ensure all values are numbers to avoid string concatenation
  // Base price should be nightly rate * number of guests * number of nights when API does not supply a computed base_price
  // If the pricing API already returns a base_price we trust that (it may already account for guests/nights logic)
  const calculatedBaseFallback = nights > 0 ? (nights * property.price_per_night * guests) : 0;
  // Always compute base price locally even if API sends one (avoid mismatch / partial guest calc)
  const basePrice = calculatedBaseFallback;
  const cleaningFee = Number(pricing?.cleaning_fee ?? property.cleaning_fee ?? 0);
  const serviceFee = Number(pricing?.service_fee ?? (basePrice * 0.1)); // 10% service fee
  // Always compute total locally to prevent accidental string concatenation (e.g., "300" + "10")
  const totalPrice = basePrice + cleaningFee + serviceFee;
  
  // Check if dates are available
  const isAvailable = availability ? availability.available : true;
  const hasConflicts = availability && availability.conflicts && availability.conflicts.length > 0;

  const handleReserve = async () => {
    if (!isAuthenticated) {
      setNotification({
        isOpen: true,
        title: 'Sign In Required',
        message: 'Please sign in to make a reservation.',
        type: 'info'
      });
      return;
    }

    if (!checkIn || !checkOut || guests <= 0 || nights <= 0) {
      setNotification({
        isOpen: true,
        title: 'Invalid Selection',
        message: 'Please select valid dates and number of guests.',
        type: 'warning'
      });
      return;
    }

    if (!isAvailable) {
      setNotification({
        isOpen: true,
        title: 'Dates Unavailable',
        message: 'Sorry, these dates are not available. Please choose different dates.',
        type: 'error'
      });
      return;
    }

    setIsBooking(true);

    try {
      const bookingData = {
        property_id: property.id,
        check_in_date: formatDateForAPI(checkIn),
        check_out_date: formatDateForAPI(checkOut),
        guests_count: guests,
        special_requests: ''
      };

      const { booking, next_steps } = await bookingsService.createBooking(bookingData);

      // Close calendar if open
      setCalendarOpen(false);

      // Refresh booked dates to include the newly created pending booking
      await fetchBookedDates();

      setNotification({
        isOpen: true,
        title: 'Booking Created Successfully!',
        message: `Booking ID: ${booking.id}
Property: ${property.title}
Check-in: ${formatDate(checkIn)}
Check-out: ${formatDate(checkOut)}
Guests: ${guests}
Total: $${totalPrice.toFixed(2)}

${next_steps}`,
        type: 'success'
      });

      // Reset form
      setCheckIn(null);
      setCheckOut(null);
      setGuests(1);

    } catch (error: any) {
      const errorMessage = error?.message || error?.response?.data?.message || 'Unknown error occurred';
      setNotification({
        isOpen: true,
        title: 'Booking Failed',
        message: errorMessage,
        type: 'error'
      });
      console.error('Booking error:', error);
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="booking-widget" ref={widgetRef}>
      <div className="booking-widget__header">
        <p className="booking-widget__price">
          ${property.price_per_night.toLocaleString()}
          <span> / night</span>
        </p>
        <div className="booking-widget__rating">
          <StarIcon />
          <span>{formatRating((property as any).average_rating ?? (property as any).rating)}</span>
        </div>
      </div>

      <div className="booking-widget__form">
        {(property.min_nights > 1 || property.max_nights < 365) && (
          <div className="booking-widget__stay-info">
            {property.min_nights > 1 && property.max_nights < 365 ? (
              <p>Stay: {property.min_nights}-{property.max_nights} nights</p>
            ) : property.min_nights > 1 ? (
              <p>Minimum stay: {property.min_nights} nights</p>
            ) : (
              <p>Maximum stay: {property.max_nights} nights</p>
            )}
          </div>
        )}
        <div className="booking-widget__inputs">
          <div className="date-picker-container" onClick={() => setCalendarOpen(prev => !prev)}>
            <div className="input-group input-group--full">
              <label>CHECK IN/OUT</label>
              <div className="date-display">
                {checkIn && checkOut
                  ? `${formatDate(checkIn)} → ${formatDate(checkOut)}`
                  : checkIn
                    ? `${formatDate(checkIn)} (select checkout)`
                    : 'Add dates'}
              </div>
            </div>
          </div>
          
          {isCalendarOpen && (
            <div className="booking-widget__calendar-popover">
              <Calendar
                checkIn={checkIn}
                checkOut={checkOut}
                onDateSelect={handleDateSelect}
                onClear={clearDates}
                isDateDisabled={isDateBooked}
              />
              {loadingBookings && (
                <div className="booking-widget__calendar-loading">Loading booked dates...</div>
              )}
              {validationError && (
                <div className="booking-widget__validation-error">
                  <p>{validationError}</p>
                </div>
              )}
            </div>
          )}

          <div className="input-group input-group--full">
            <label htmlFor="guests">GUESTS</label>
            <select
              id="guests"
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              disabled={pricingLoading || availabilityLoading}
            >
              {[...Array(property.max_guests)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1} guest{i > 0 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        {hasConflicts && (
          <div className="booking-widget__warning">
            <p>These dates are not available. Please choose different dates.</p>
          </div>
        )}
        
        <button 
          className={`button button--full ${!isAvailable || hasConflicts ? 'button--disabled' : 'button--primary'}`}
          onClick={handleReserve} 
          disabled={nights <= 0 || isBooking || pricingLoading || availabilityLoading || !isAvailable || hasConflicts}
        >
          {isBooking ? 'Creating Reservation...' : 
           pricingLoading || availabilityLoading ? 'Checking Availability...' :
           !isAuthenticated ? 'Sign In to Reserve' :
           !isAvailable || hasConflicts ? 'Not Available' : 
           'Reserve'}
        </button>
      </div>

      {nights > 0 && (
        <div className="booking-widget__price-breakdown">
          <p>You won't be charged yet</p>
          <div className="price-item">
            <span>${property.price_per_night.toLocaleString()} x {guests} guest{guests > 1 ? 's' : ''} x {nights} night{nights > 1 ? 's' : ''}</span>
            <span>${basePrice.toLocaleString()}</span>
          </div>
          {cleaningFee > 0 && (
            <div className="price-item">
              <span>Cleaning fee</span>
              <span>${cleaningFee.toLocaleString()}</span>
            </div>
          )}
          <div className="price-item">
            <span>Service fee</span>
            <span>${serviceFee.toLocaleString()}</span>
          </div>
          <hr className="divider--light" />
          <div className="price-item price-item--total">
            <span>Total</span>
            <span>${totalPrice.toLocaleString()}</span>
          </div>
        </div>
      )}

      <NotificationModal
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        title={notification.title}
        message={notification.message}
        type={notification.type}
      />
    </div>
  );
};

export default BookingWidget;
