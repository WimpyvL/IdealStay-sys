import React, { useState, FormEvent, useEffect, ChangeEvent, DragEvent, useRef } from 'react';
import { NewPropertyData, Amenity } from '../types';
import Modal from './Modal';
import { CloudArrowUpIcon } from './icons/Icons';
import { propertiesService } from '../src/services';
import { amenitiesService } from '../src/services/amenities.service';
import { useAuth } from '../src/contexts/AuthContext';
import './AddPropertyModal.css';

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProperty: (data: NewPropertyData) => void;
}

// Dynamics amenity support: fetch from backend rather than hard-coded mapping.
interface SelectableAmenity {
  id: number;
  name: string;
  category?: string;
}

const AddPropertyModal: React.FC<AddPropertyModalProps> = ({ isOpen, onClose, onAddProperty }) => {
  const [formData, setFormData] = useState<Omit<NewPropertyData, 'amenity_ids' | 'image_urls'> & {amenities: number[]}>({
    title: '',
    description: '',
    property_type: 'apartment',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'United States',
    max_guests: 2,
    bedrooms: 1,
    bathrooms: 1,
    beds: 1,
    price_per_night: 100,
    cleaning_fee: 10,
    security_deposit: 50,
    min_nights: 1,
    max_nights: 30,
    check_in_time: '15:00',
    check_out_time: '11:00',
    amenities: [],
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [availableAmenities, setAvailableAmenities] = useState<SelectableAmenity[]>([]);
  const [amenitiesLoading, setAmenitiesLoading] = useState(false);
  const [amenitiesError, setAmenitiesError] = useState<string | null>(null);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitAsPending, setSubmitAsPending] = useState(true); // true = pending (submit for review), false = draft
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Authentication
  const { state } = useAuth();
  const { user, isAuthenticated } = state;

  useEffect(() => {
    const { title, description, address, city, country } = formData;
    const areImagesProvided = imageFiles.length > 0;
    const isValid = title.trim() !== '' && description.trim() !== '' && address.trim() !== '' && 
                   city.trim() !== '' && country.trim() !== '' && areImagesProvided;
    setIsFormValid(isValid);
  }, [formData, imageFiles]);

  // Fetch amenities from backend (if endpoint exists) once open
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setAmenitiesLoading(true); setAmenitiesError(null);
      try {
        const list = await amenitiesService.getAllAmenities();
        if (!cancelled) {
          setAvailableAmenities(list.map(a => ({ id: a.id, name: a.name, category: a.category })));
        }
      } catch (err: any) {
        if (!cancelled) setAmenitiesError(err.message || 'Failed to load amenities');
      } finally {
        if (!cancelled) setAmenitiesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numericFields = ['price_per_night', 'max_guests', 'bedrooms', 'bathrooms', 'beds', 'cleaning_fee', 'security_deposit', 'min_nights', 'max_nights'];
    setFormData(prev => ({ 
      ...prev, 
      [name]: numericFields.includes(name) ? Number(value) : value 
    }));
  };

  const handleAmenityToggle = (amenityId: number) => {
    setFormData(prev => {
      const newList = prev.amenities.includes(amenityId)
        ? prev.amenities.filter(id => id !== amenityId)
        : [...prev.amenities, amenityId];
      return { ...prev, amenities: newList };
    });
  };

  const processFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    setImageFiles(prev => [...prev, ...newFiles]);

    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };
  
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !isAuthenticated) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      const amenityIds = formData.amenities;

      const propertyData = {
        title: formData.title,
        description: formData.description,
        property_type: formData.property_type,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        postal_code: formData.postal_code,
        latitude: 40.7128, // TODO: Implement geocoding
        longitude: -74.0060, // TODO: Implement geocoding
        bedrooms: formData.bedrooms,
        bathrooms: formData.bathrooms,
        beds: formData.beds,
        max_guests: formData.max_guests,
        price_per_night: formData.price_per_night,
        cleaning_fee: formData.cleaning_fee,
        security_deposit: formData.security_deposit,
        min_nights: formData.min_nights,
        max_nights: formData.max_nights,
        check_in_time: formData.check_in_time + ':00', // Convert HH:MM to HH:MM:SS
        check_out_time: formData.check_out_time + ':00', // Convert HH:MM to HH:MM:SS
        advance_booking_days: 0,
        is_instant_book: false,
        amenity_ids: amenityIds,
        status: submitAsPending ? 'pending' as const : 'draft' as const,
      };
      
      const newProperty = await propertiesService.createProperty(propertyData);
      console.log('✅ Property created:', newProperty);
      
      // Upload images if any were selected
      if (imageFiles.length > 0) {
        try {
          console.log(`🖼️ Uploading ${imageFiles.length} images for property ${newProperty.id}...`);
          const uploadedImages = await propertiesService.uploadPropertyImages(newProperty.id, imageFiles);
          console.log(`✅ Successfully uploaded ${imageFiles.length} images:`, uploadedImages);
        } catch (imageError) {
          console.error('❌ Failed to upload images:', imageError);
          // Property was created but images failed - show partial success message
          setSubmitError(`Property created successfully, but failed to upload images. You can add images later by editing the property.`);
          return; // Don't close modal if images failed
        }
      } else {
        console.log('ℹ️ No images selected for upload');
      }
      
      // Call the original callback with correct data format
      onAddProperty({
        ...formData,
        amenity_ids: amenityIds,
        image_urls: imagePreviews
      });
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        property_type: 'apartment',
        address: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'United States',
        max_guests: 2,
        bedrooms: 1,
        bathrooms: 1,
        beds: 1,
        price_per_night: 100,
        cleaning_fee: 10,
        security_deposit: 50,
        min_nights: 1,
        max_nights: 30,
        check_in_time: '15:00',
        check_out_time: '11:00',
        amenities: [],
      });
      setImageFiles([]);
      setImagePreviews([]);
      
      onClose();
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to create property. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isOpen) return null;

  return (
    <Modal title="Add a New Property" onClose={onClose}>
      {submitError && (
        <div className="error-message">
          <strong>Error:</strong> {submitError}
        </div>
      )}
      
      {!isAuthenticated && (
        <div className="warning-message">
          Please sign in to add a property.
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="add-property-form">
        <div className="form-grid">
          {/* Basic Property Information */}
          <div className="form-group form-span-6">
            <label htmlFor="title">Property Title</label>
            <input type="text" id="title" name="title" value={formData.title} onChange={handleChange} required />
          </div>

          <div className="form-group form-span-6">
            <label htmlFor="description">Description</label>
            <textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={3} required></textarea>
          </div>

          <div className="form-group form-span-3">
            <label htmlFor="property_type">Property Type</label>
            <select id="property_type" name="property_type" value={formData.property_type} onChange={handleChange}>
              <option value="apartment">Apartment</option>
              <option value="house">House</option>
              <option value="villa">Villa</option>
              <option value="cabin">Cabin</option>
              <option value="cottage">Cottage</option>
              <option value="condo">Condo</option>
              <option value="townhouse">Townhouse</option>
            </select>
          </div>
          <div className="form-group form-span-3">
            <label htmlFor="max_guests">Max Guests</label>
            <input type="number" id="max_guests" name="max_guests" value={formData.max_guests} onChange={handleChange} min="1" required />
          </div>

          {/* Location Information */}
          <div className="form-group form-span-6">
            <label htmlFor="address">Street Address</label>
            <input type="text" id="address" name="address" value={formData.address} onChange={handleChange} required />
          </div>

          <div className="form-group form-span-2">
            <label htmlFor="city">City</label>
            <input type="text" id="city" name="city" value={formData.city} onChange={handleChange} required />
          </div>
          <div className="form-group form-span-2">
            <label htmlFor="state">State</label>
            <input type="text" id="state" name="state" value={formData.state} onChange={handleChange} />
          </div>
          <div className="form-group form-span-2">
            <label htmlFor="postal_code">Postal Code</label>
            <input type="text" id="postal_code" name="postal_code" value={formData.postal_code} onChange={handleChange} />
          </div>

          <div className="form-group form-span-6">
            <label htmlFor="country">Country</label>
            <select id="country" name="country" value={formData.country} onChange={handleChange}>
              <option value="United States">United States</option>
              <option value="Canada">Canada</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="Australia">Australia</option>
              <option value="Germany">Germany</option>
              <option value="France">France</option>
              <option value="Italy">Italy</option>
              <option value="Spain">Spain</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Property Details */}
          <div className="form-group form-span-2">
            <label htmlFor="bedrooms">Bedrooms</label>
            <input type="number" id="bedrooms" name="bedrooms" value={formData.bedrooms} onChange={handleChange} min="0" required />
          </div>
          <div className="form-group form-span-2">
            <label htmlFor="bathrooms">Bathrooms</label>
            <input type="number" id="bathrooms" name="bathrooms" value={formData.bathrooms} onChange={handleChange} min="0.5" step="0.5" required />
          </div>
          <div className="form-group form-span-2">
            <label htmlFor="beds">Beds</label>
            <input type="number" id="beds" name="beds" value={formData.beds} onChange={handleChange} min="1" required />
          </div>

          {/* Pricing Information */}
          <div className="form-group form-span-2">
            <label htmlFor="price_per_night">Price per Night ($)</label>
            <input type="number" id="price_per_night" name="price_per_night" value={formData.price_per_night} onChange={handleChange} min="1" required />
          </div>
          <div className="form-group form-span-2">
            <label htmlFor="cleaning_fee">Cleaning Fee ($)</label>
            <input type="number" id="cleaning_fee" name="cleaning_fee" value={formData.cleaning_fee} onChange={handleChange} min="0" />
          </div>
          <div className="form-group form-span-2">
            <label htmlFor="security_deposit">Security Deposit ($)</label>
            <input type="number" id="security_deposit" name="security_deposit" value={formData.security_deposit} onChange={handleChange} min="0" />
          </div>

          {/* Booking Rules */}
          <div className="form-group form-span-2">
            <label htmlFor="min_nights">Minimum Nights</label>
            <input type="number" id="min_nights" name="min_nights" value={formData.min_nights} onChange={handleChange} min="1" />
          </div>
          <div className="form-group form-span-2">
            <label htmlFor="max_nights">Maximum Nights</label>
            <input type="number" id="max_nights" name="max_nights" value={formData.max_nights} onChange={handleChange} min="1" />
          </div>
          <div className="form-group form-span-1">
            <label htmlFor="check_in_time">Check-in</label>
            <input type="time" id="check_in_time" name="check_in_time" value={formData.check_in_time} onChange={handleChange} />
          </div>
          <div className="form-group form-span-1">
            <label htmlFor="check_out_time">Check-out</label>
            <input type="time" id="check_out_time" name="check_out_time" value={formData.check_out_time} onChange={handleChange} />
          </div>
          
          <div className="form-group form-span-6">
            <label>Amenities</label>
            {amenitiesLoading && <p>Loading amenities...</p>}
            {amenitiesError && <p className="error-message">Amenities unavailable: {amenitiesError}</p>}
            {!amenitiesLoading && !amenitiesError && (
              <div className="amenities-sections">
                {(() => {
                  // Group by category (fall back to 'Other')
                  const groups: Record<string, SelectableAmenity[]> = {};
                  for (const a of availableAmenities) {
                    const cat = a.category || 'Other';
                    if (!groups[cat]) groups[cat] = [];
                    groups[cat].push(a);
                  }
                  const entries = Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0]));
                  return entries.map(([cat, items]) => (
                    <div key={cat} className="amenities-section">
                      <h4 className="amenities-section__title">{cat}</h4>
                      <div className="amenities-checkbox-grid">
                        {items.map(item => (
                          <label key={item.id} className="amenity-checkbox">
                            <input
                              type="checkbox"
                              checked={formData.amenities.includes(item.id)}
                              onChange={() => handleAmenityToggle(item.id)}
                            />
                            <span>{item.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
                {availableAmenities.length === 0 && <p>No amenities available.</p>}
              </div>
            )}
          </div>

          <div className="form-group form-span-6">
            <label>Property Images</label>
            <div 
              className={`file-drop-zone ${isDragging ? 'file-drop-zone--drag-over' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*" 
                multiple 
                hidden 
              />
              <CloudArrowUpIcon />
              <p>
                <span>Click to upload</span> or drag and drop.
              </p>
            </div>
            {imagePreviews.length > 0 && (
              <div className="image-previews-grid">
                {imagePreviews.map((src, index) => (
                  <div key={index} className="image-preview-item">
                    <img src={src} alt={`Preview ${index + 1}`} className="image-preview-img" />
                    <button 
                      type="button" 
                      className="image-preview-remove-btn" 
                      onClick={() => handleRemoveImage(index)}
                      aria-label={`Remove image ${index + 1}`}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status Toggle */}
        <div className="form-group form-span-6" style={{ marginTop: '20px', marginBottom: '10px' }}>
          <label className="status-toggle-label">
            <span className="status-toggle-title">Submission Type:</span>
            <div className="status-toggle-container">
              <button
                type="button"
                className={`status-toggle-option ${!submitAsPending ? 'status-toggle-option--active' : ''}`}
                onClick={() => setSubmitAsPending(false)}
              >
                <span className="status-toggle-option__icon">💾</span>
                <span className="status-toggle-option__text">
                  <strong>Save as Draft</strong>
                  <small>Save without submitting for review</small>
                </span>
              </button>
              <button
                type="button"
                className={`status-toggle-option ${submitAsPending ? 'status-toggle-option--active' : ''}`}
                onClick={() => setSubmitAsPending(true)}
              >
                <span className="status-toggle-option__icon">📋</span>
                <span className="status-toggle-option__text">
                  <strong>Submit for Review</strong>
                  <small>Submit to admin for approval</small>
                </span>
              </button>
            </div>
          </label>
        </div>

        <div className="modal__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="button button--primary"
            disabled={!isFormValid || isSubmitting || !isAuthenticated}
          >
            {isSubmitting ? (
              <>
                <span className="loading-spinner-small"></span>
                Creating...
              </>
            ) : (
              submitAsPending ? 'Submit Property' : 'Save as Draft'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddPropertyModal;
