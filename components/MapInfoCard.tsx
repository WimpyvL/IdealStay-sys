import React from 'react';
import { Property } from '../types';
import { XIcon } from './icons/Icons';
import './MapInfoCard.css';
import { resolvePrimaryPropertyImage, toAbsoluteImageUrl } from './imageUtils';

interface MapInfoCardProps {
    property: Property;
    onClose: () => void;
    onViewDetails: () => void;
}

const MapInfoCard: React.FC<MapInfoCardProps> = ({ property, onClose, onViewDetails }) => {
    const primaryImage = (() => {
        const resolved = resolvePrimaryPropertyImage(property as any);
        return toAbsoluteImageUrl(resolved || '') || '';
    })();

    const location = `${property.city}, ${property.state || property.country}`;

    return (
        <div className="map-info-card">
            <button className="map-info-card__close-btn" onClick={onClose} aria-label="Close property details">
                <XIcon />
            </button>
            <div className="map-info-card__image-wrapper">
                {primaryImage ? (
                    <img src={primaryImage} alt={property.title} />
                ) : (
                    <div className="map-info-card__image--placeholder" aria-label="No image available" />
                )}
            </div>
            <div className="map-info-card__details">
                <h3 className="map-info-card__title">{property.title}</h3>
                <p className="map-info-card__location">{location}</p>
                <div className="map-info-card__footer">
                    <p className="map-info-card__price">
                        ${property.price_per_night}<span>/night</span>
                    </p>
                    <button className="button button--primary button--small" onClick={onViewDetails}>
                        View
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MapInfoCard;
