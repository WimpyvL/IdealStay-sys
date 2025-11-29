let googleMapsPromise: Promise<typeof window.google> | null = null;

interface LoadMapsOptions {
  libraries?: string[];
}

const SCRIPT_ID = 'idealstay-google-maps-script';

/**
 * Dynamically loads the Google Maps JavaScript API if it isn't already available.
 * Returns a promise that resolves with the `google` namespace once Maps is ready.
 */
export const loadGoogleMapsApi = (apiKey: string, options: LoadMapsOptions = {}): Promise<typeof window.google> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only be loaded in a browser environment.'));
  }

  if (!apiKey) {
    return Promise.reject(new Error('Google Maps API key is missing.'));
  }

  if (window.google && window.google.maps) {
    return Promise.resolve(window.google);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    const handleScriptLoad = () => {
      if (window.google && window.google.maps) {
        resolve(window.google);
      } else {
        reject(new Error('Google Maps loaded but the SDK is unavailable.'));
      }
    };

    const handleScriptError = () => {
      reject(new Error('Failed to load the Google Maps script.'));
    };

    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        handleScriptLoad();
        return;
      }
      existingScript.addEventListener('load', handleScriptLoad, { once: true });
      existingScript.addEventListener('error', handleScriptError, { once: true });
      return;
    }

    const script = document.createElement('script');
    const libraries = options.libraries && options.libraries.length > 0
      ? `&libraries=${options.libraries.join(',')}`
      : '';

    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}${libraries}`;
    script.async = true;
    script.defer = true;
    script.dataset.loaded = 'false';

    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      handleScriptLoad();
    }, { once: true });

    script.addEventListener('error', () => {
      script.dataset.loaded = 'error';
      handleScriptError();
    }, { once: true });

    document.head.appendChild(script);
  });

  return googleMapsPromise;
};
