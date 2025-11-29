import React, { useState } from 'react';
import { Property, Amenity } from '../types';
import { 
  ChevronLeftIcon, MapPinIcon, StarIcon, UsersIcon, 
  WifiIcon, KitchenIcon, ParkingIcon, PoolIcon, AirConIcon, TvIcon,
  DryerIcon, HairDryerIcon, HeatingIcon, IronIcon, RightArrowIcon
} from '../components/icons/Icons';
import BookingWidget from '../components/BookingWidget';
import ImageCarousel from '../components/ImageCarousel';
import Avatar from '../components/Avatar';
import { toAbsoluteImageUrl } from '../components/imageUtils';
import { getImageUrl, DEFAULT_PROPERTY_THUMBNAIL } from '../constants';
import FullscreenImageViewer from '../components/FullscreenImageViewer';
import { useProperty } from '../src/hooks';
import { formatRating } from '../components/ratingUtils';
import './PropertyDetailPage.css';

interface PropertyDetailPageProps {
  propertyId: number | string;
  onBack: () => void;
}

// Define amenity name type for compatibility
type AmenityName = 'Wifi' | 'Kitchen' | 'Parking' | 'Pool' | 'Air Conditioning' | 'TV' | 'Dryer' | 'Hair Dryer' | 'Heating' | 'Iron' | 'Washer';

const AmenityIcon: React.FC<{ amenity: AmenityName | string }> = ({ amenity }) => {
  const icons: Record<string, React.ReactNode> = {
    'Wifi': <WifiIcon />,
    'WiFi': <WifiIcon />,
    'Kitchen': <KitchenIcon />,
    'Parking': <ParkingIcon />,
    'Pool': <PoolIcon />,
    'Air Conditioning': <AirConIcon />,
    'TV': <TvIcon />,
    'Dryer': <DryerIcon />,
    'Hair Dryer': <HairDryerIcon />,
    'Heating': <HeatingIcon />,
    'Iron': <IronIcon />,
    'Washer': <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v16.5h16.5V3.75H3.75zM9 9h6v6H9V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9.75a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3a.75.75 0 01.75-.75z" /></svg>,
  };
  
  const iconKey = Object.keys(icons).find(key => key.toLowerCase() === amenity.toLowerCase());

  return <div className="amenity-icon">{iconKey ? icons[iconKey] : <div>•</div>}</div>;
};

const PropertyDetailPage: React.FC<PropertyDetailPageProps> = ({ propertyId, onBack }) => {
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);
  
  // Fetch property data
  const { property, loading, error, refetch } = useProperty(propertyId);

  const handleImageClick = (index: number) => {
    setViewerStartIndex(index);
    setIsViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setIsViewerOpen(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="property-detail-page">
        <button onClick={onBack} className="back-button">
          <ChevronLeftIcon className="back-button__icon" />
          Back to Explore
        </button>
        <div className="property-loading">
          <div className="loading-spinner"></div>
          <p>Loading property details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !property) {
    return (
      <div className="property-detail-page">
        <button onClick={onBack} className="back-button">
          <ChevronLeftIcon className="back-button__icon" />
          Back to Explore
        </button>
        <div className="property-error">
          <h2>Unable to Load Property</h2>
          <p>{error || 'Property not found'}</p>
          <button onClick={() => refetch()} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Build a normalized image array:
  // Priority: explicit property.images (image_url/url), then legacy property.imageUrls, then synthetic primary_image.
  const normalizedImages: string[] = (() => {
    const coll: string[] = [];
    if (Array.isArray((property as any).images) && (property as any).images.length > 0) {
      for (const img of (property as any).images) {
        const raw = (img as any).image_url || (img as any).url;
        if (raw) coll.push(getImageUrl(raw));
      }
    } else if (Array.isArray((property as any).imageUrls) && (property as any).imageUrls.length > 0) {
      for (const u of (property as any).imageUrls) {
        if (u) coll.push(getImageUrl(u));
      }
    } else if ((property as any).primary_image) {
      coll.push(getImageUrl((property as any).primary_image));
    }
    // De-duplicate while preserving order
    const dedup = Array.from(new Set(coll.filter(Boolean)));
    return dedup.length > 0 ? dedup : [DEFAULT_PROPERTY_THUMBNAIL];
  })();

  // Normalize amenities similar to PropertyCard approach
  const amenityNames: string[] = (() => {
    const raw = (property as any).amenities;
    if (!Array.isArray(raw)) return [];
    return raw.map((a: any) => {
      if (typeof a === 'string') return a;
      if (a && typeof a === 'object') return a.name || a.amenity || a.title;
      return undefined;
    }).filter((v: any): v is string => !!v);
  })();

  return (
    <div className="property-detail-page">
      <button onClick={onBack} className="back-button">
        <ChevronLeftIcon className="back-button__icon" />
        Back to Explore
      </button>

      {/* Page Header */}
      <div className="property-header">
        <h1 className="property-header__title">{property.title}</h1>
        <div className="property-header__meta">
          <div className="property-header__meta-item">
            <StarIcon />
            <span>{formatRating((property as any).average_rating ?? (property as any).rating)}</span>
          </div>
          <div className="property-header__meta-item">
            <MapPinIcon />
            <span>{property.city && property.country ? `${property.city}, ${property.country}` : property.location}</span>
          </div>
        </div>
      </div>

      {/* Image & Booking Layout */}
      <div className="property-detail-layout">
        <div className="property-detail-content">
          <div className="property-image-container">
            <ImageCarousel images={normalizedImages} onImageClick={handleImageClick} />
          </div>

          <div className="property-info-card">
            <div className="host-info">
              <div className="host-info__details">
                <h2 className="host-info__title">{property.property_type || property.type} hosted by {property.host?.first_name || property.host?.name || 'Host'}</h2>
                <p className="host-info__guests">
                  <UsersIcon />
                  <span>Up to {property.max_guests || property.maxGuests} guests</span>
                </p>
              </div>
              <Avatar 
                src={toAbsoluteImageUrl(property.host?.profile_image_url || property.host?.avatarUrl)}
                alt={property.host?.first_name || property.host?.name || 'Host'} 
                className="host-info__avatar" 
              />
            </div>
            
            <hr className="divider" />

            <div className="property-description">
              <h3 className="section-heading">About this place</h3>
              <p>{property.description}</p>
            </div>

            <hr className="divider" />

            <div className="property-details">
              <h3 className="section-heading">Property Details</h3>
              <div className="property-details-grid">
                <div className="property-detail-item">
                  <span className="property-detail-label">Property Type</span>
                  <span className="property-detail-value" style={{ textTransform: 'capitalize' }}>{property.property_type || property.type || 'N/A'}</span>
                </div>
                <div className="property-detail-item">
                  <span className="property-detail-label">Max Guests</span>
                  <span className="property-detail-value">{property.max_guests || property.maxGuests || 'N/A'}</span>
                </div>
                <div className="property-detail-item">
                  <span className="property-detail-label">Bedrooms</span>
                  <span className="property-detail-value">{property.bedrooms || 'N/A'}</span>
                </div>
                <div className="property-detail-item">
                  <span className="property-detail-label">Beds</span>
                  <span className="property-detail-value">{property.beds || 'N/A'}</span>
                </div>
                <div className="property-detail-item">
                  <span className="property-detail-label">Bathrooms</span>
                  <span className="property-detail-value">{property.bathrooms || 'N/A'}</span>
                </div>
                <div className="property-detail-item">
                  <span className="property-detail-label">Minimum Nights</span>
                  <span className="property-detail-value">{property.min_nights || 'N/A'}</span>
                </div>
                <div className="property-detail-item">
                  <span className="property-detail-label">Maximum Nights</span>
                  <span className="property-detail-value">{property.max_nights || 'N/A'}</span>
                </div>
              </div>

              <h4 className="property-details-subheading">Location</h4>
              <div className="property-details-grid">
                <div className="property-detail-item">
                  <span className="property-detail-label">Street Address</span>
                  <span className="property-detail-value">{property.address || 'N/A'}</span>
                </div>
                <div className="property-detail-item">
                  <span className="property-detail-label">City</span>
                  <span className="property-detail-value">{property.city || 'N/A'}</span>
                </div>
                {property.state && (
                  <div className="property-detail-item">
                    <span className="property-detail-label">State</span>
                    <span className="property-detail-value">{property.state}</span>
                  </div>
                )}
                {property.postal_code && (
                  <div className="property-detail-item">
                    <span className="property-detail-label">Postal Code</span>
                    <span className="property-detail-value">{property.postal_code}</span>
                  </div>
                )}
                <div className="property-detail-item">
                  <span className="property-detail-label">Country</span>
                  <span className="property-detail-value">{property.country || 'N/A'}</span>
                </div>
              </div>
            </div>

            <hr className="divider" />

            <div className="property-amenities">
              <h3 className="section-heading">What this place offers</h3>
              {amenityNames.length > 0 ? (
                <div className="amenities-grid">
                  {amenityNames.map((amenity) => (
                    <div key={amenity} className="amenity-item">
                      <AmenityIcon amenity={amenity} />
                      <span>{amenity}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="amenities-empty">No amenities listed.</p>
              )}
            </div>
          </div>
        </div>

        <aside className="property-detail-booking">
          <BookingWidget property={property} />
        </aside>
      </div>
      
      {isViewerOpen && (
        <FullscreenImageViewer
          // Use the already normalizedImages array so fullscreen viewer gets absolute URLs
          // Previous implementation passed raw image_url values (often relative like /uploads/..),
          // causing 404s when the frontend dev server attempted to load them from its own origin.
          images={normalizedImages}
          startIndex={viewerStartIndex}
          onClose={handleCloseViewer}
        />
      )}
    </div>
  );
};

export default PropertyDetailPage;