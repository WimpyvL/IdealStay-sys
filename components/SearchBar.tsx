import React, { useState, useRef, useEffect } from 'react';
import { MapPinIcon, CalendarIcon, UsersIcon, SearchIcon } from './icons/Icons';
import Calendar from './Calendar';
import { propertiesService, PropertySearchParams, amenitiesService } from '../src/services';
import { AmenityRecord } from '../src/services/amenities.service';
import './SearchBar.css';

interface SearchBarProps {
  onSearch?: (results: any[]) => void;
  onSearchParams?: (params: PropertySearchParams) => void;
  isLoading?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onSearchParams, isLoading = false }) => {
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [location, setLocation] = useState('');
  const [guests, setGuests] = useState(1);
  const [isCalendarOpen, setCalendarOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<AmenityRecord[]>([]);
  const [isAmenitiesOpen, setAmenitiesOpen] = useState(false);

  const calendarRef = useRef<HTMLDivElement>(null);
  const amenitiesRef = useRef<HTMLDivElement>(null);

  // Fetch amenities on mount
  useEffect(() => {
    const loadAmenities = async () => {
      try {
        const data = await amenitiesService.getAllAmenities();
        setAmenities(data);
      } catch (error) {
        console.error('Failed to load amenities:', error);
      }
    };
    loadAmenities();
  }, []);

  // Close calendar and amenities on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
      if (amenitiesRef.current && !amenitiesRef.current.contains(event.target as Node)) {
        setAmenitiesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleDateSelect = (date: Date) => {
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(date);
      setCheckOut(null);
    } else if (date > checkIn) {
      setCheckOut(date);
      setCalendarOpen(false);
    } else {
      setCheckIn(date);
      setCheckOut(null);
    }
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
  };

  const clearDates = () => {
    setCheckIn(null);
    setCheckOut(null);
  };

  const toggleAmenity = (amenityId: string) => {
    setSelectedAmenities(prev =>
      prev.includes(amenityId)
        ? prev.filter(id => id !== amenityId)
        : [...prev, amenityId]
    );
  };

  const handleSearch = async () => {
    if (!location.trim()) {
      alert('Please enter a location');
      return;
    }

    setIsSearching(true);

    try {
      const searchParams: PropertySearchParams = {
        location: location.trim(),
        guests: guests,
        ...(checkIn && { check_in_date: checkIn.toISOString().split('T')[0] }),
        ...(checkOut && { check_out_date: checkOut.toISOString().split('T')[0] }),
        ...(selectedAmenities.length > 0 && { amenities: selectedAmenities }),
      };

      // Call the parent component's search params callback
      if (onSearchParams) {
        onSearchParams(searchParams);
      }

      // Perform the actual search
      if (onSearch) {
        const searchResponse = await propertiesService.searchProperties(searchParams);
        onSearch(searchResponse.properties);
      }
    } catch (error: any) {
      console.error('Search failed:', error);
      alert('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const incrementGuests = () => setGuests(prev => prev + 1);
  const decrementGuests = () => setGuests(prev => Math.max(1, prev - 1));

  return (
    <div className="search-bar" ref={calendarRef}>
      <div className="search-bar__form">
        <div className="search-bar__row">
          {/* Location */}
          <div className="search-bar__group">
            <MapPinIcon className="search-bar__icon" />
            <input
              id="location"
              type="text"
              placeholder="Where to?"
              className="search-bar__input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button className="search-bar__location-submit-btn">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true" focusable="false" style={{display: 'block', height: '16px', width: '16px', fill: 'currentcolor'}}><path d="M0.5 7.49998L15.5 0.499983L8.5 15.5L7.5 8.49998L0.5 7.49998Z" stroke="currentColor" strokeWidth="1.5"></path></svg>
            </button>
          </div>

          {/* Guests */}
          <div className="search-bar__group search-bar__guests-control">
            <UsersIcon className="search-bar__icon" />
            <span className="search-bar__guests-label">Guests</span>
            <button onClick={decrementGuests} className="search-bar__guests-btn">-</button>
            <span className="search-bar__guests-count">{guests}</span>
            <button onClick={incrementGuests} className="search-bar__guests-btn">+</button>
          </div>
        </div>

        <div className="search-bar__row">
          {/* Check-in / Check-out */}
          <div className="search-bar__group search-bar__date-group" onClick={() => setCalendarOpen(prev => !prev)}>
            <CalendarIcon className="search-bar__icon" />
            <input
              type="text"
              readOnly
              placeholder="yyyy/mm/dd"
              className="search-bar__input"
              value={checkIn ? formatDate(checkIn) : ''}
            />
          </div>
          <div className="search-bar__group search-bar__date-group" onClick={() => setCalendarOpen(prev => !prev)}>
            <CalendarIcon className="search-bar__icon" />
            <input
              type="text"
              readOnly
              placeholder="yyyy/mm/dd"
              className="search-bar__input"
              value={checkOut ? formatDate(checkOut) : ''}
            />
          </div>
          {isCalendarOpen && (
            <div className="search-bar__calendar-popover">
              <Calendar
                checkIn={checkIn}
                checkOut={checkOut}
                onDateSelect={handleDateSelect}
                onClear={clearDates}
              />
            </div>
          )}
        </div>

        <div className="search-bar__row">
          {/* Filters */}
          <div className="search-bar__group search-bar__filters-group" ref={amenitiesRef}>
            <button className="search-bar__filters-btn" onClick={() => setAmenitiesOpen(prev => !prev)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{transform: 'rotate(90deg)'}}><path d="M3 7H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path><path d="M6 12H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path><path d="M10 17H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path></svg>
              Filters
            </button>
            {isAmenitiesOpen && (
              <div className="search-bar__amenities-popover">
                <div className="amenities-filter">
                  <div className="amenities-filter__header">
                    <h3>Amenities</h3>
                    {selectedAmenities.length > 0 && (
                      <button
                        onClick={() => setSelectedAmenities([])}
                        className="amenities-filter__clear"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="amenities-filter__list">
                    {amenities.map((amenity) => (
                      <label key={amenity.id} className="amenities-filter__item">
                        <input
                          type="checkbox"
                          checked={selectedAmenities.includes(String(amenity.id))}
                          onChange={() => toggleAmenity(String(amenity.id))}
                        />
                        <span>{amenity.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Search Button */}
          <button
            className="search-bar__button"
            onClick={handleSearch}
            disabled={isSearching || isLoading}
          >
            {isSearching || isLoading ? (
              <div className="loading-spinner-small"></div>
            ) : (
              <>
                <SearchIcon className="search-bar__button-icon" />
                Search
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;