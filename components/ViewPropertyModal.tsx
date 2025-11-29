import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { Property } from '../types';
import { getImageUrl, DEFAULT_PROPERTY_THUMBNAIL, PROPERTY_STATUS_UI_MAP } from '../constants';
import { propertiesService } from '../src/services';
import './ViewPropertyModal.css';

interface ViewPropertyModalProps {
  propertyId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

const ViewPropertyModal: React.FC<ViewPropertyModalProps> = ({ propertyId, isOpen, onClose }) => {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !propertyId) {
      return;
    }
    const fetchProperty = async () => {
      setLoading(true);
      setError(null);
      try {
        const full = await propertiesService.getPropertyById(propertyId);
        setProperty(full);
      } catch (err: any) {
        setError(err.message || 'Failed to load property details');
      } finally {
        setLoading(false);
      }
    };
    fetchProperty();
  }, [isOpen, propertyId]);

  if (!isOpen) return null;

  return (
    <Modal title={property ? property.title : 'Property Details'} onClose={onClose}>
      <div className="view-property-modal__body">
        {loading && (
          <div className="view-property-modal__loading">
            <div className="loading-spinner" />
            <p>Loading property...</p>
          </div>
        )}
        {error && !loading && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}
        {property && !loading && !error && (
          <div className="view-property-modal__content">
            <div className="vp-images-grid">
              {property.images && property.images.length > 0 ? (
                property.images.slice(0,5).map(img => (
                  <img key={img.id} src={getImageUrl((img as any).image_url || (img as any).url)} alt={img.alt_text || property.title} className="vp-image" />
                ))
              ) : (
                <img src={DEFAULT_PROPERTY_THUMBNAIL} alt="No images" className="vp-image" />
              )}
            </div>

            <div className="vp-meta-grid">
              <div className="vp-meta-item">
                <span className="vp-meta-label">Location</span>
                <span className="vp-meta-value">{property.city}{property.state ? ', ' + property.state : ''}{property.country ? ', ' + property.country : ''}</span>
              </div>
              <div className="vp-meta-item">
                <span className="vp-meta-label">Type</span>
                <span className="vp-meta-value">{property.property_type}</span>
              </div>
              <div className="vp-meta-item">
                <span className="vp-meta-label">Status</span>
                {(() => {
                  const rawStatus = (property.status || '').toString();
                  const mapping: any = (PROPERTY_STATUS_UI_MAP as any)[rawStatus] || (PROPERTY_STATUS_UI_MAP as any)[rawStatus.toLowerCase?.() || ''];
                  const label = mapping ? mapping.label : (rawStatus ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1) : '—');
                  const badgeClass = mapping ? mapping.badgeClass : rawStatus.toLowerCase();
                  return <span className={`status-badge status-badge--${badgeClass}`}>{label}</span>;
                })()}
              </div>
              <div className="vp-meta-item">
                <span className="vp-meta-label">Price / Night</span>
                <span className="vp-meta-value">${property.price_per_night}</span>
              </div>
              <div className="vp-meta-item">
                <span className="vp-meta-label">Bedrooms</span>
                <span className="vp-meta-value">{property.bedrooms}</span>
              </div>
              <div className="vp-meta-item">
                <span className="vp-meta-label">Bathrooms</span>
                <span className="vp-meta-value">{property.bathrooms}</span>
              </div>
              <div className="vp-meta-item">
                <span className="vp-meta-label">Beds</span>
                <span className="vp-meta-value">{property.beds}</span>
              </div>
              <div className="vp-meta-item">
                <span className="vp-meta-label">Max Guests</span>
                <span className="vp-meta-value">{property.max_guests}</span>
              </div>
              <div className="vp-meta-item">
                <span className="vp-meta-label">Created</span>
                <span className="vp-meta-value">{new Date(property.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="vp-section">
              <h4>Description</h4>
              <p className="vp-description">{property.description}</p>
            </div>

            {property.amenities && property.amenities.length > 0 && (
              <div className="vp-section">
                <h4>Amenities</h4>
                <div className="vp-amenities">
                  {property.amenities.slice(0,24).map(am => (
                    <span key={am.id} className="vp-amenity-tag">{am.name}</span>
                  ))}
                  {property.amenities.length > 24 && (
                    <span className="vp-amenity-tag vp-amenity-tag--more">+{property.amenities.length - 24} more</span>
                  )}
                </div>
              </div>
            )}

            {property.reviews && property.reviews.length > 0 && (
              <div className="vp-section">
                <h4>Recent Reviews</h4>
                <ul className="vp-reviews">
                  {property.reviews.slice(0,3).map(r => (
                    <li key={r.id} className="vp-review-item">
                      <div className="vp-review-rating">⭐ {r.rating}</div>
                      <div className="vp-review-comment">{r.comment || r.title}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="vp-footer-actions">
              <button className="button button--secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ViewPropertyModal;
