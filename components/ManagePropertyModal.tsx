import React from 'react';
import Modal from './Modal';
import { Property } from '../types';
import { getImageUrl, DEFAULT_PROPERTY_THUMBNAIL } from '../constants';
import { resolvePrimaryPropertyImage } from './imageUtils';
import './ManagePropertyModal.css';

interface ManagePropertyModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (property: Property) => void;
  onViewBookings?: (property: Property) => void;
}

const ManagePropertyModal: React.FC<ManagePropertyModalProps> = ({ property, isOpen, onClose, onEdit, onViewBookings }) => {
  if (!isOpen || !property) return null;
  // Unified primary image resolution (handles images array, .url, and primary_image fallback)
  const primaryImage = resolvePrimaryPropertyImage(property);

  return (
    <Modal title={`Manage: ${property.title}`} onClose={onClose}>
      <div className="manage-property-modal">
        <div className="manage-property-modal__header">
          {primaryImage ? (
            <img src={getImageUrl(primaryImage)} alt={property.title} className="manage-property-modal__image" />
          ) : (
            <img src={DEFAULT_PROPERTY_THUMBNAIL} alt="No image available" className="manage-property-modal__image" />
          )}
          <div className="manage-property-modal__summary">
            <h3>{property.title}</h3>
            <p className="location">{property.city}, {property.country}</p>
            <p className="status"><span className={`status-badge status-badge--${property.status.toLowerCase()}`}>{property.status}</span></p>
            <div className="quick-stats">
              <span>{property.max_guests} guests</span>
              {property.bedrooms && <span>{property.bedrooms} br</span>}
              {property.bathrooms && <span>{property.bathrooms} ba</span>}
              {property.price_per_night && <span>${property.price_per_night}/night</span>}
            </div>
          </div>
        </div>

        <div className="manage-property-modal__actions">
          <button className="button button--secondary" onClick={() => onEdit?.(property)}>Edit Details</button>
          <button className="button button--secondary" onClick={() => onViewBookings?.(property)}>View Bookings</button>
          <button className="button button--primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
};

export default ManagePropertyModal;
