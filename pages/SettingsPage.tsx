import React, { useState, useEffect } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { apiClient } from '../src/services/api.config';
import { getImageUrl } from '../src/utils/imageUtils';
import { CalendarIcon } from '../components/icons/Icons';
import './SettingsPage.css';

interface UserUpdateData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  profile_image_url: string;
}

const SettingsPage: React.FC = () => {
  const { state, uploadProfileImage } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<UserUpdateData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    profile_image_url: '',
  });

  // Sync form data with user state
  useEffect(() => {
    if (!state.user) return;

    // Format date_of_birth to YYYY-MM-DD for input field
    let formattedDate = '';
    if (state.user.date_of_birth) {
      const date = new Date(state.user.date_of_birth);
      if (!isNaN(date.getTime())) {
        formattedDate = date.toISOString().split('T')[0];
      }
    }

    setFormData({
      first_name: state.user.first_name || '',
      last_name: state.user.last_name || '',
      email: state.user.email || '',
      phone: state.user.phone || '',
      date_of_birth: formattedDate,
      profile_image_url: state.user.profile_image_url || '',
    });

    // Fallback: if no profile_image_url, fetch full profile directly
    if (!state.user.profile_image_url) {
      (async () => {
        try {
          const resp = await apiClient.get('/users/profile');
          if (resp.data?.success && resp.data.data?.profile_image_url) {
            setFormData(prev => ({ ...prev, profile_image_url: resp.data.data.profile_image_url }));
          }
        } catch (err) {
          // silent
        }
      })();
    }
  }, [state.user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload image using AuthContext method (updates user state automatically) and get new URL
      const newUrl = await uploadProfileImage(file);
      
      // Immediately set in local form state for instant preview
      setFormData(prev => ({
        ...prev,
        profile_image_url: newUrl
      }));
      
      setSuccess('Profile image uploaded successfully!');
      
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiClient.put('/users/profile', formData);

      if (response.data.success) {
        setSuccess('Profile updated successfully!');

        // Reload user data
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        throw new Error(response.data.message || 'Failed to update profile');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!state.user) {
    return (
      <div className="settings-page">
        <div className="settings-container">
          <p>Please sign in to access settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-container">
        <div className="settings-header">
          <h1>Account Settings</h1>
          <p>Manage your personal information and preferences</p>
        </div>

        <form className="settings-form" onSubmit={handleSubmit}>
          <div className="settings-section">
            <h2>Personal Information</h2>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="first_name">First Name *</label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="last_name">Last Name *</label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="email">Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="phone">Phone Number</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="form-field">
              <label htmlFor="date_of_birth">Date of Birth</label>
              <div className="date-input-container">
                <input
                  type="date"
                  id="date_of_birth"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  placeholder="yyyy/mm/dd"
                />
                {!formData.date_of_birth && <span className="date-placeholder">yyyy/mm/dd</span>}
                <CalendarIcon className="date-input-icon" />
              </div>
            </div>

            <div className="form-field">
              <label>Profile Image</label>
              <div className="image-upload-container">
                <div className="image-upload-controls">
                  <input
                    type="file"
                    id="profile_image"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="file-input"
                    disabled={uploading}
                  />
                  <label htmlFor="profile_image" className="file-input-label">
                    <div className="dropzone-content">
                      <svg className="upload-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <span className="dropzone-title">{uploading ? 'Uploading...' : 'Choose Image'}</span>
                      <span className="dropzone-info">Max size: 5MB. Accepts: JPG, PNG, GIF</span>
                    </div>
                  </label>
                </div>

                {formData.profile_image_url && (
                  <div className="profile-preview-wrapper">
                    <div className="profile-preview">
                      <img 
                        src={getImageUrl(formData.profile_image_url)} 
                        alt="Profile preview" 
                      />
                    </div>
                    <div className="upload-success-message">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      Image uploaded successfully
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, profile_image_url: '' }))}
                      className="button-link"
                    >
                      Remove Image
                    </button>
                  </div>
                )}
              </div>
            </div>

            {!formData.profile_image_url && (
              <div className="form-field">
                <label htmlFor="profile_image_url">Or Enter Image URL</label>
                <input
                  type="url"
                  id="profile_image_url"
                  name="profile_image_url"
                  value={formData.profile_image_url}
                  onChange={handleChange}
                  placeholder="https://example.com/image.jpg"
                />
                <span className="file-input-hint">Paste a direct link to an image</span>
              </div>
            )}
          </div>

          <div className="settings-section">
            <h2>Account Information</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Account Type</span>
                <span className="info-value">{state.user.role}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Member Since</span>
                <span className="info-value">
                  {new Date(state.user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              {state.user.is_verified !== undefined && (
                <div className="info-item">
                  <span className="info-label">Email Verified</span>
                  <span className={`info-badge ${state.user.is_verified ? 'verified' : 'unverified'}`}>
                    {state.user.is_verified ? 'Verified' : 'Not Verified'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="alert alert--error">
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert--success">
              {success}
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="button button--primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
