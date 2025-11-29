import React, { useState, FormEvent, useEffect, ChangeEvent, DragEvent, useRef } from 'react';
import { Property, PropertyImage } from '../types';
import Modal from './Modal';
import { CloudArrowUpIcon } from './icons/Icons';
import { propertiesService } from '../src/services';
import { amenitiesService } from '../src/services/amenities.service';
import { useAuth } from '../src/contexts/AuthContext';
import { getImageUrl } from '../constants';
import { resolvePrimaryPropertyImage } from './imageUtils';
import './AddPropertyModal.css'; // Reuse the same styles

interface EditPropertyModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateProperty: (property: Property) => void;
}

// Dynamic amenity handling (IDs instead of hard-coded names)
interface SelectableAmenity { id: number; name: string; category?: string; }

// Extract incoming amenity IDs from property.amenities (objects or ids)
const extractAmenityIds = (amenities: any[] = []): number[] => {
  return amenities.map(a => (typeof a === 'object' ? a.id : a)).filter((v: any) => Number.isFinite(v));
};

// Helper function to format time from HH:MM:SS to HH:MM
const formatTimeForInput = (timeString: string): string => {
  if (!timeString) return '15:00';
  return timeString.substring(0, 5); // Extract HH:MM from HH:MM:SS
};

const EditPropertyModal: React.FC<EditPropertyModalProps> = ({ 
  property, 
  isOpen, 
  onClose, 
  onUpdateProperty 
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    property_type: 'apartment' as const,
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
    amenities: [] as number[],
  });
  const [availableAmenities, setAvailableAmenities] = useState<SelectableAmenity[]>([]);
  const [amenitiesLoading, setAmenitiesLoading] = useState(false);
  const [amenitiesError, setAmenitiesError] = useState<string | null>(null);
  
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  // Existing images we loaded from the property (full objects) so we can reference their IDs
  const [existingImages, setExistingImages] = useState<PropertyImage[]>([]);
  // Keep a simple list of existing image URLs for display (derived)
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  // Track images the user removed so we can delete them on save
  const [removedImageIds, setRemovedImageIds] = useState<number[]>([]);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitAsPending, setSubmitAsPending] = useState(true); // true = pending (submit for review), false = draft
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [hasUserModifiedImages, setHasUserModifiedImages] = useState(false); // tracks local add/remove so refetch won't overwrite
  
  // Authentication
  const { state } = useAuth();
  const { user, isAuthenticated } = state;

  // Initialize form data when property changes
  useEffect(() => {
    if (property && isOpen) {
      setFormData({
        title: property.title || '',
        description: property.description || '',
        property_type: property.property_type || 'apartment',
        address: property.address || '',
        city: property.city || '',
        state: property.state || '',
        postal_code: property.postal_code || '',
        country: property.country || 'United States',
        max_guests: property.max_guests || 2,
        bedrooms: property.bedrooms || 1,
        bathrooms: property.bathrooms || 1,
        beds: property.beds || 1,
        price_per_night: property.price_per_night || 100,
        cleaning_fee: property.cleaning_fee || 10,
        security_deposit: property.security_deposit || 50,
        min_nights: property.min_nights || 1,
        max_nights: property.max_nights || 30,
        check_in_time: formatTimeForInput(property.check_in_time || '15:00:00'),
        check_out_time: formatTimeForInput(property.check_out_time || '11:00:00'),
        amenities: extractAmenityIds(property.amenities || []),
      });
      
      // Capture existing images (full objects) and build display URLs.
      // If backend only provided a primary_image field (no images array), synthesize one for editing context.
      let imgs: PropertyImage[] = property.images || [];
      if ((!imgs || imgs.length === 0) && (property as any).primary_image) {
        const fallbackUrl = resolvePrimaryPropertyImage(property as any);
        if (fallbackUrl) {
          // Create a synthetic image object (id -1 to indicate not persisted separately)
            imgs = [{
            id: -1,
            property_id: property.id,
            image_url: fallbackUrl,
            alt_text: property.title || 'Primary Image',
            display_order: 0,
            is_primary: true,
            created_at: property.created_at,
          }];
        }
      }
      setExistingImages(imgs);
      setExistingImageUrls(imgs.map(img => getImageUrl(img.image_url)));
  setRemovedImageIds([]);
  setHasUserModifiedImages(false);
      setImageFiles([]);
      setImagePreviews([]);
      setSubmitError(null);

      // Set toggle based on current property status
      // If property is draft, default to draft; otherwise default to pending (submit for review)
      setSubmitAsPending(property.status !== 'draft');
    }
  }, [property, isOpen]);

  // Ensure we always have the FULL property (with images and amenities) when editing.
  // If the passed in property has no images or amenities array, refetch from API.
  useEffect(() => {
    const fetchFullPropertyIfNeeded = async () => {
      if (!property || !isOpen) return;
      const noImages = !property.images || property.images.length === 0;
      const onlySynthetic = property.images && property.images.length === 1 && property.images[0].id === -1;
      const noAmenities = !property.amenities || property.amenities.length === 0;

      // Fetch full property if images or amenities are missing
      if (!hasUserModifiedImages && (noImages || onlySynthetic || noAmenities)) {
        try {
          setIsLoadingImages(true);
          const full = await propertiesService.getPropertyById(property.id);

          // Update images if they were missing
          if (full && full.images && full.images.length > 0) {
            const filtered = full.images.filter(img => !removedImageIds.includes(img.id));
            setExistingImages(filtered as PropertyImage[]);
            setExistingImageUrls(filtered.map(img => getImageUrl(img.image_url)));
          }

          // Update amenities in form data if they were missing
          if (full && full.amenities) {
            const amenityIds = extractAmenityIds(full.amenities);
            setFormData(prev => ({ ...prev, amenities: amenityIds }));
          }
        } catch (err) {
          console.warn('Failed to refetch full property data', err);
        } finally {
          setIsLoadingImages(false);
        }
      }
    };
    fetchFullPropertyIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, property?.id, hasUserModifiedImages, removedImageIds]);

  useEffect(() => {
    const { title, description, address, city, country } = formData;
    const hasImages = existingImages.filter(img => !removedImageIds.includes(img.id)).length > 0 || imageFiles.length > 0;
    const isValid = title.trim() !== '' && description.trim() !== '' && address.trim() !== '' && 
                   city.trim() !== '' && country.trim() !== '' && hasImages;
    setIsFormValid(isValid);
  }, [formData, imageFiles, existingImages, removedImageIds]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numericFields = ['price_per_night', 'max_guests', 'bedrooms', 'bathrooms', 'beds', 'cleaning_fee', 'security_deposit', 'min_nights', 'max_nights'];
    setFormData(prev => ({ 
      ...prev, 
      [name]: numericFields.includes(name) ? Number(value) : value 
    }));
  };

  const handleAmenityToggle = (id: number) => {
    setFormData(prev => {
      const newList = prev.amenities.includes(id)
        ? prev.amenities.filter(a => a !== id)
        : [...prev.amenities, id];
      return { ...prev, amenities: newList };
    });
  };
  // Fetch amenities dynamically when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setAmenitiesLoading(true); setAmenitiesError(null);
      try {
        const list = await amenitiesService.getAllAmenities();
        if (!cancelled) setAvailableAmenities(list.map(a => ({ id: a.id, name: a.name, category: a.category })));
      } catch (err: any) {
        if (!cancelled) setAmenitiesError(err.message || 'Failed to load amenities');
      } finally {
        if (!cancelled) setAmenitiesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

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

  const handleRemoveNewImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setHasUserModifiedImages(true);
  };

  const handleRemoveExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
    setExistingImageUrls(prev => prev.filter((_, i) => i !== index));
    // Record removal for deletion (capture image id)
    const removed = existingImages[index];
    if (removed) {
      // Synthetic placeholder (id -1) should not trigger deletion API
      if (removed.id !== -1) {
        setRemovedImageIds(prev => prev.includes(removed.id) ? prev : [...prev, removed.id]);
      }
    }
    setHasUserModifiedImages(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !isAuthenticated || !property) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      const amenityIds = formData.amenities;
      
      const updateData = {
        id: property.id, // Include the id in the update data
        title: formData.title,
        description: formData.description,
        property_type: formData.property_type,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        postal_code: formData.postal_code,
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
        amenity_ids: amenityIds,
        status: submitAsPending ? 'pending' as const : 'draft' as const,
      };
      
      // 1. Update the property core details
      const updatedPropertyCore = await propertiesService.updateProperty(updateData);

      // 2. Delete removed images (sequential or Promise.all)
      if (removedImageIds.length > 0) {
        try {
          await Promise.all(removedImageIds.map(id => propertiesService.deletePropertyImage(property.id, id)));
        } catch (delErr) {
          console.warn('⚠️ Some images failed to delete:', delErr);
        }
      }

      // 3. Upload new images if any
      if (imageFiles.length > 0) {
        try {
          await propertiesService.uploadPropertyImages(property.id, imageFiles);
        } catch (uploadErr) {
          console.error('❌ Failed to upload new images:', uploadErr);
          setSubmitError('Property details saved, but some new images failed to upload.');
        }
      }

      // 4. Refetch full property (with images & amenities) to ensure latest state
      let fullyUpdated = updatedPropertyCore;
      try {
        fullyUpdated = await propertiesService.getPropertyById(property.id);
      } catch (refetchErr) {
        console.warn('⚠️ Failed to refetch property after update, using core update object.', refetchErr);
      }

      // 5. Callback & close (only close if no image upload errors)
      onUpdateProperty(fullyUpdated);
      if (!submitError) {
        onClose();
      }
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to update property. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isOpen || !property) return null;

  return (
    <Modal title={`Edit Property: ${property.title}`} onClose={onClose}>
      {submitError && (
        <div className="error-message">
          <strong>Error:</strong> {submitError}
        </div>
      )}
      
      {!isAuthenticated && (
        <div className="warning-message">
          Please sign in to edit this property.
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="add-property-form">
        <div className="form-grid">
          {/* Basic Property Information */}
          <div className="form-group form-span-6">
            <label htmlFor="title">Property Title</label>
            <input 
              type="text" 
              id="title" 
              name="title" 
              value={formData.title} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div className="form-group form-span-6">
            <label htmlFor="description">Description</label>
            <textarea 
              id="description" 
              name="description" 
              value={formData.description} 
              onChange={handleChange} 
              rows={3} 
              required
            ></textarea>
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
            <input 
              type="number" 
              id="max_guests" 
              name="max_guests" 
              value={formData.max_guests} 
              onChange={handleChange} 
              min="1" 
              required 
            />
          </div>

          {/* Location Information */}
          <div className="form-group form-span-6">
            <label htmlFor="address">Street Address</label>
            <input 
              type="text" 
              id="address" 
              name="address" 
              value={formData.address} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div className="form-group form-span-2">
            <label htmlFor="city">City</label>
            <input 
              type="text" 
              id="city" 
              name="city" 
              value={formData.city} 
              onChange={handleChange} 
              required 
            />
          </div>
          
          <div className="form-group form-span-2">
            <label htmlFor="state">State</label>
            <input 
              type="text" 
              id="state" 
              name="state" 
              value={formData.state} 
              onChange={handleChange} 
            />
          </div>
          
          <div className="form-group form-span-2">
            <label htmlFor="postal_code">Postal Code</label>
            <input 
              type="text" 
              id="postal_code" 
              name="postal_code" 
              value={formData.postal_code} 
              onChange={handleChange} 
            />
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
            <input 
              type="number" 
              id="bedrooms" 
              name="bedrooms" 
              value={formData.bedrooms} 
              onChange={handleChange} 
              min="0" 
              required 
            />
          </div>
          
          <div className="form-group form-span-2">
            <label htmlFor="bathrooms">Bathrooms</label>
            <input 
              type="number" 
              id="bathrooms" 
              name="bathrooms" 
              value={formData.bathrooms} 
              onChange={handleChange} 
              min="0.5" 
              step="0.5" 
              required 
            />
          </div>
          
          <div className="form-group form-span-2">
            <label htmlFor="beds">Beds</label>
            <input 
              type="number" 
              id="beds" 
              name="beds" 
              value={formData.beds} 
              onChange={handleChange} 
              min="1" 
              required 
            />
          </div>

          {/* Pricing Information */}
          <div className="form-group form-span-2">
            <label htmlFor="price_per_night">Price per Night ($)</label>
            <input 
              type="number" 
              id="price_per_night" 
              name="price_per_night" 
              value={formData.price_per_night} 
              onChange={handleChange} 
              min="1" 
              required 
            />
          </div>
          
          <div className="form-group form-span-2">
            <label htmlFor="cleaning_fee">Cleaning Fee ($)</label>
            <input 
              type="number" 
              id="cleaning_fee" 
              name="cleaning_fee" 
              value={formData.cleaning_fee} 
              onChange={handleChange} 
              min="0" 
            />
          </div>
          
          <div className="form-group form-span-2">
            <label htmlFor="security_deposit">Security Deposit ($)</label>
            <input 
              type="number" 
              id="security_deposit" 
              name="security_deposit" 
              value={formData.security_deposit} 
              onChange={handleChange} 
              min="0" 
            />
          </div>

          {/* Booking Rules */}
          <div className="form-group form-span-2">
            <label htmlFor="min_nights">Minimum Nights</label>
            <input 
              type="number" 
              id="min_nights" 
              name="min_nights" 
              value={formData.min_nights} 
              onChange={handleChange} 
              min="1" 
            />
          </div>
          
          <div className="form-group form-span-2">
            <label htmlFor="max_nights">Maximum Nights</label>
            <input 
              type="number" 
              id="max_nights" 
              name="max_nights" 
              value={formData.max_nights} 
              onChange={handleChange} 
              min="1" 
            />
          </div>
          
          <div className="form-group form-span-1">
            <label htmlFor="check_in_time">Check-in</label>
            <input 
              type="time" 
              id="check_in_time" 
              name="check_in_time" 
              value={formData.check_in_time} 
              onChange={handleChange} 
            />
          </div>
          
          <div className="form-group form-span-1">
            <label htmlFor="check_out_time">Check-out</label>
            <input 
              type="time" 
              id="check_out_time" 
              name="check_out_time" 
              value={formData.check_out_time} 
              onChange={handleChange} 
            />
          </div>
          
          <div className="form-group form-span-6">
            <label>Amenities</label>
            {amenitiesLoading && <p>Loading amenities...</p>}
            {amenitiesError && <p className="error-message">Amenities unavailable: {amenitiesError}</p>}
            {!amenitiesLoading && !amenitiesError && (
              <div className="amenities-sections">
                {(() => {
                  const groups: Record<string, SelectableAmenity[]> = {};
                  for (const a of availableAmenities) {
                    const cat = a.category || 'Other';
                    if (!groups[cat]) groups[cat] = [];
                    groups[cat].push(a);
                  }
                  return Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0])).map(([cat, items]) => (
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
            
            {/* Existing Images */}
            {existingImageUrls.length > 0 && (
              <>
                <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem', color: '#64748b' }}>
                  Current Images
                </h4>
                <div className="image-previews-grid">
                  {existingImageUrls.map((src, index) => (
                    <div key={`existing-${index}`} className="image-preview-item">
                      <img src={src} alt={`Existing ${index + 1}`} className="image-preview-img" />
                      <button 
                        type="button" 
                        className="image-preview-remove-btn" 
                        onClick={() => handleRemoveExistingImage(index)}
                        aria-label={`Remove existing image ${index + 1}`}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            {isLoadingImages && existingImageUrls.length === 0 && (
              <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Loading images...</div>
            )}
            
            {/* New Images Upload */}
            <div 
              className={`file-drop-zone ${isDragging ? 'file-drop-zone--drag-over' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{ marginTop: existingImageUrls.length > 0 ? '1rem' : '0' }}
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
                <span>Click to upload</span> or drag and drop new images.
              </p>
            </div>
            
            {/* New Image Previews */}
            {imagePreviews.length > 0 && (
              <>
                <h4 style={{ fontSize: '0.875rem', marginTop: '1rem', marginBottom: '0.5rem', color: '#64748b' }}>
                  New Images to Add
                </h4>
                <div className="image-previews-grid">
                  {imagePreviews.map((src, index) => (
                    <div key={`new-${index}`} className="image-preview-item">
                      <img src={src} alt={`New Preview ${index + 1}`} className="image-preview-img" />
                      <button 
                        type="button" 
                        className="image-preview-remove-btn" 
                        onClick={() => handleRemoveNewImage(index)}
                        aria-label={`Remove new image ${index + 1}`}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </>
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
                Updating...
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

export default EditPropertyModal;