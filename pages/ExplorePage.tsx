import React, { useState } from 'react';
import SearchBar from '../components/SearchBar';
import PropertyCard from '../components/PropertyCard';
import LocationMap from '../components/LocationMap';
import { Property } from '../types';
import { GridIcon, MapIcon } from '../components/icons/Icons';
import { useProperties } from '../src/hooks';
import './ExplorePage.css';

interface ExplorePageProps {
  onSelectProperty: (property: Property) => void;
}

const ExplorePage: React.FC<ExplorePageProps> = ({ onSelectProperty }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [selectedMapProperty, setSelectedMapProperty] = useState<Property | null>(null);
  
  // Property state management
  const [searchResults, setSearchResults] = useState<Property[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(false);
  
  // Fetch properties using the custom hook
  const { properties, loading, error, refetch } = useProperties();

  // Search handlers
  const handleSearch = (results: Property[]) => {
    setSearchResults(results);
    setIsSearchMode(true);
  };

  const handleSearchReset = () => {
    setIsSearchMode(false);
    setSearchResults([]);
  };

  // Determine which properties to display
  // Normalize to always be an array to avoid runtime errors if service returns unexpected shape
  const rawDisplayedProperties = isSearchMode ? (searchResults || []) : (properties || []);
  const displayedProperties: Property[] = Array.isArray(rawDisplayedProperties)
    ? rawDisplayedProperties
    : (rawDisplayedProperties && Array.isArray((rawDisplayedProperties as any).properties)
        ? (rawDisplayedProperties as any).properties
        : []);

  return (
    <div className="explore-page">
      <div className="explore-page__hero">
        <div className="explore-page__hero-content">
          <h1 className="explore-page__title">
            Find stays that feel like <span className="explore-page__title-highlight">home.</span>
          </h1>
          <p className="explore-page__subtitle">
            A beautiful, fast booking experience built for South Africa — crafted with love for real hosts and real travellers.
          </p>

          <div className="explore-page__hero-search">
            <SearchBar onSearch={handleSearch} isLoading={loading} />
          </div>
        </div>

        <div className="explore-page__hero-image">
          <img
            src="https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop"
            alt="Modern luxury home"
            className="hero-image"
          />
          <div className="premium-experience-card">
            <div className="premium-experience-icon">✨</div>
            <h3 className="premium-experience-title">Premium Experience</h3>
            <p className="premium-experience-text">Discover handpicked stays across South Africa</p>
          </div>
        </div>
      </div>

      <section className="explore-page__content-section">
        <div className="explore-page__header">
          <div className="section-title-container">
            <h2 className="section-title">
              {isSearchMode ? `Search Results (${searchResults.length})` : 'Featured Properties'}
            </h2>
            {isSearchMode && (
              <button 
                onClick={handleSearchReset} 
                className="clear-search-button"
              >
                Clear Search
              </button>
            )}
          </div>
          <div className="view-toggle">
            <button 
              className={`view-toggle__button ${viewMode === 'grid' ? 'view-toggle__button--active' : ''}`}
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <GridIcon />
              <span>Grid</span>
            </button>
            <button 
              className={`view-toggle__button ${viewMode === 'map' ? 'view-toggle__button--active' : ''}`}
              onClick={() => setViewMode('map')}
              aria-label="Map view"
            >
              <MapIcon />
              <span>Map</span>
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="explore-page__loading">
            <div className="loading-spinner"></div>
            <p>Loading properties...</p>
          </div>
        ) : error ? (
          <div className="explore-page__error">
            <div className="error-message">
              <h3>Unable to load properties</h3>
              <p>{error}</p>
              <button onClick={() => refetch()} className="retry-button">
                Try Again
              </button>
            </div>
          </div>
        ) : !displayedProperties || displayedProperties.length === 0 ? (
          <div className="explore-page__empty">
            <h3>{isSearchMode ? 'No results found' : 'No properties found'}</h3>
            <p>{isSearchMode ? 'Try adjusting your search criteria.' : 'Try adjusting your search criteria or check back later.'}</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="property-grid">
            {displayedProperties.map((property) => (
              <PropertyCard 
                key={property.id} 
                property={property}
                onSelect={onSelectProperty}
              />
            ))}
          </div>
        ) : (
          <div className="explore-page__map-container">
            <LocationMap 
              properties={displayedProperties}
              selectedProperty={selectedMapProperty}
              onPinSelect={setSelectedMapProperty}
              onViewDetails={onSelectProperty}
            />
          </div>
        )}
      </section>
    </div>
  );
};

export default ExplorePage;
