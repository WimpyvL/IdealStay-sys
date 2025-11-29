import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Property } from '../types';
import MapInfoCard from './MapInfoCard';
import './LocationMap.css';
import { loadGoogleMapsApi } from '../src/utils/googleMaps';

// Note: This component requires the Google Maps JavaScript API to be loaded
// in your HTML file for it to function.
declare global {
  interface Window {
    google: any;
  }
}

interface LocationMapProps {
  properties: Property[];
  selectedProperty: Property | null;
  onPinSelect: (property: Property | null) => void;
  onViewDetails: (property: Property) => void;
}

const LocationMap: React.FC<LocationMapProps> = ({ properties, selectedProperty, onPinSelect, onViewDetails }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null); // State to hold the map instance
  const markersRef = useRef<any[]>([]); // Ref to hold marker instances
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  interface PropertyWithCoords {
    property: Property;
    lat: number;
    lng: number;
  }

  const propertiesWithCoords = useMemo<PropertyWithCoords[]>(() => {
    return properties.reduce<PropertyWithCoords[]>((acc, property) => {
      const lat = property.latitude ?? (property as unknown as { lat?: number }).lat;
      const lng = property.longitude ?? (property as unknown as { lng?: number }).lng;

      if (typeof lat === 'number' && typeof lng === 'number') {
        acc.push({ property, lat, lng });
      }

      return acc;
    }, []);
  }, [properties]);

  const defaultCenter = useMemo(() => {
    if (propertiesWithCoords.length > 0) {
      const { totalLat, totalLng } = propertiesWithCoords.reduce(
        (acc, item) => ({
          totalLat: acc.totalLat + item.lat,
          totalLng: acc.totalLng + item.lng,
        }),
        { totalLat: 0, totalLng: 0 }
      );

      return {
        lat: totalLat / propertiesWithCoords.length,
        lng: totalLng / propertiesWithCoords.length,
      };
    }

    return { lat: -30.5595, lng: 22.9375 }; // Centre of South Africa
  }, [propertiesWithCoords]);

  useEffect(() => {
    let isMounted = true;

    if (!apiKey) {
      setMapsError('Google Maps API key is missing.');
      return () => {
        isMounted = false;
      };
    }

    loadGoogleMapsApi(apiKey, { libraries: ['places'] })
      .then(() => {
        if (isMounted) {
          setMapsReady(true);
          setMapsError(null);
        }
      })
      .catch((error: Error) => {
        console.error('Failed to load Google Maps API', error);
        if (isMounted) {
          setMapsError('We couldn’t load the interactive map. Please try again later.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [apiKey]);

  // Initialize map effect
  useEffect(() => {
    if (!mapsReady || map || !mapRef.current || !window.google?.maps) {
      return;
    }

    const newMap = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: propertiesWithCoords.length > 0 ? 6 : 5,
      disableDefaultUI: true,
      styles: [
        {
          featureType: 'poi',
          stylers: [{ visibility: 'off' }],
        },
        {
          featureType: 'transit',
          stylers: [{ visibility: 'off' }],
        },
        {
          featureType: 'road',
          elementType: 'labels.icon',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    setMap(newMap);
  }, [mapsReady, map, defaultCenter, propertiesWithCoords.length]);

  // Update markers effect
  useEffect(() => {
    if (!map || !window.google?.maps) {
      return;
    }

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    propertiesWithCoords.forEach(({ property, lat, lng }) => {
      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        title: property.title,
        animation: window.google.maps.Animation.DROP,
      });

      (marker as any).__propertyId = property.id;

      marker.addListener('click', () => {
        onPinSelect(property);
      });

      markersRef.current.push(marker);
    });

    if (propertiesWithCoords.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      propertiesWithCoords.forEach(({ lat, lng }) => {
        bounds.extend({ lat, lng });
      });

      try {
        map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
      } catch {
        map.fitBounds(bounds);
      }

      if (propertiesWithCoords.length === 1) {
        map.setZoom(12);
      }
    }
  }, [map, propertiesWithCoords, onPinSelect]);

  // Effect to handle selected property changes
  useEffect(() => {
    if (!window.google) return;

    markersRef.current.forEach((marker) => {
      const isSelected = (marker as any).__propertyId === selectedProperty?.id;
      marker.setAnimation(isSelected ? window.google.maps.Animation.BOUNCE : null);
    });

    if (!selectedProperty) {
      return;
    }

    const selectedEntry = propertiesWithCoords.find(item => item.property.id === selectedProperty.id);
    if (!selectedEntry) {
      return;
    }

    map?.panTo({ lat: selectedEntry.lat, lng: selectedEntry.lng });
    if (map?.getZoom() && map.getZoom() < 12) {
      map.setZoom(12);
    }
  }, [selectedProperty, map, propertiesWithCoords]);

  return (
    <div className="location-map-container">
        <div ref={mapRef} className="google-map" />
        {!mapsReady && !mapsError && (
          <div className="map-overlay map-overlay--loading">
            <div className="map-overlay__content">
              <div className="map-overlay__spinner" aria-hidden="true" />
              <p>Loading map experience…</p>
            </div>
          </div>
        )}
        {mapsError && (
          <div className="map-overlay map-overlay--error" role="alert">
            <div className="map-overlay__content">
              <p>{mapsError}</p>
            </div>
          </div>
        )}
        {mapsReady && selectedProperty && (
            <MapInfoCard 
                property={selectedProperty}
                onClose={() => onPinSelect(null)}
                onViewDetails={() => onViewDetails(selectedProperty)}
            />
        )}
    </div>
  );
};

export default LocationMap;
