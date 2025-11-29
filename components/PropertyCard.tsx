import React from 'react';
import { Property, Amenity } from '../types';
import { 
  StarIcon,
  WifiIcon,
  KitchenIcon,
  ParkingIcon,
  PoolIcon,
  AirConIcon,
  TvIcon,
  DryerIcon,
  HairDryerIcon,
  HeatingIcon,
  IronIcon,
  RightArrowIcon
} from './icons/Icons';
import './PropertyCard.css';
import { getImageUrl, DEFAULT_PROPERTY_THUMBNAIL } from '../constants';
import { resolvePrimaryPropertyImage } from './imageUtils';
import { formatRating } from './ratingUtils';

interface PropertyCardProps {
  property: Property;
  onSelect: (property: Property) => void;
}

const amenityIcons: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  'wifi': WifiIcon,
  'kitchen': KitchenIcon,
  'parking': ParkingIcon,
  'pool': PoolIcon,
  'air conditioning': AirConIcon,
  'tv': TvIcon,
  'television': TvIcon,
  'internet': WifiIcon,
  'wireless': WifiIcon,
  'dryer': DryerIcon,
  'hair dryer': HairDryerIcon,
  'heating': HeatingIcon,
  'iron': IronIcon,
};

const amenityAbbreviations: Record<string, string> = {
  'dryer': 'DRY',
  'hair dryer': 'HAI',
  'heating': 'HEA',
  'iron': 'IRO',
};


const PropertyCard: React.FC<PropertyCardProps> = ({ property, onSelect }) => {
  // Defensive image resolution: support various property shapes
  const legacyArray = (property as any).imageUrls as string[] | undefined;
  const directFromLegacy = legacyArray && legacyArray.length > 0 ? legacyArray[0] : undefined;
  const fromImages = property.images && property.images.length > 0 ? (property.images[0] as any).image_url || (property.images[0] as any).url : undefined;
  const fromPrimaryResolver = resolvePrimaryPropertyImage(property as any);
  const rawImage = directFromLegacy || fromImages || fromPrimaryResolver;
  const imageSrc = rawImage ? getImageUrl(rawImage) : DEFAULT_PROPERTY_THUMBNAIL;

  // Normalize amenities: backend might supply objects, array, or CSV string
  const rawAmenities = (property as any).amenities || (property as any).amenity_names;
  let amenityNames: string[] = [];
  
  if (Array.isArray(rawAmenities)) {
    // Handle array of objects or strings
    amenityNames = rawAmenities.map((a: any) => {
      if (typeof a === 'string') return a;
      if (a && typeof a === 'object') return a.name || a.amenity || a.title;
      return undefined;
    }).filter((v: any): v is string => !!v);
  } else if (typeof rawAmenities === 'string' && rawAmenities.trim()) {
    // Handle CSV string from backend
    amenityNames = rawAmenities.split(',').map(name => name.trim()).filter(name => name);
  }
  
  const amenitiesToShow = 4;
  const limitedAmenities = amenityNames.slice(0, amenitiesToShow);

  return (
    <div 
      className="property-card"
      onClick={() => onSelect(property)}
    >
      <div className="property-card__image-wrapper">
        <img
          src={imageSrc}
          alt={property.title}
          className="property-card__image"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_PROPERTY_THUMBNAIL; }}
        />
        <div className="property-card__rating">
          <StarIcon className="property-card__rating-icon" />
          <span>{formatRating(property.average_rating)}</span>
        </div>
        <div className="property-card__image-gradient"></div>
         <span className="property-card__type-badge">{(property as any).type || (property as any).property_type || 'Apartment'}</span>
      </div>
      <div className="property-card__info">
  <h3 className="property-card__title">{property.title}</h3>
  <p className="property-card__location">{(property as any).location || `${property.city || ''}${property.city && property.country ? ', ' : ''}${property.country || ''}`}</p>
        <div className="property-card__amenities">
          <RightArrowIcon className="property-card__amenity-arrow-icon" />
          {limitedAmenities.map((amenity) => {
            const amenityKey = amenity.toLowerCase();
            const IconComponent = amenityIcons[amenityKey];
            
            return IconComponent ? (
              <span key={amenity} title={amenity}>
                <IconComponent className="property-card__amenity-icon" />
              </span>
            ) : (
              <span 
                key={amenity} 
                title={amenity}
                className="property-card__amenity-text"
              >
                {amenityAbbreviations[amenityKey] || amenity.slice(0, 3).toUpperCase()}
              </span>
            );
          })}
          {amenityNames.length > amenitiesToShow && (
            <div className="property-card__amenities-more" title={`${amenityNames.length - amenitiesToShow} more amenities`}>
              +{amenityNames.length - amenitiesToShow}
            </div>
          )}
        </div>
        <p className="property-card__price">
          ${ (property as any).pricePerNight || property.price_per_night }
          <span className="property-card__price-period"> / night</span>
        </p>
      </div>
    </div>
  );
};

export default PropertyCard;