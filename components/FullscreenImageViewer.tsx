import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from './icons/Icons';
import './FullscreenImageViewer.css';

interface FullscreenImageViewerProps {
  images: string[];
  startIndex: number;
  onClose: () => void;
}

const FullscreenImageViewer: React.FC<FullscreenImageViewerProps> = ({ images, startIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  const goToPrevious = useCallback(() => {
    const isFirstSlide = currentIndex === 0;
    const newIndex = isFirstSlide ? images.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  }, [currentIndex, images.length]);

  const goToNext = useCallback(() => {
    const isLastSlide = currentIndex === images.length - 1;
    const newIndex = isLastSlide ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  }, [currentIndex, images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToPrevious, goToNext, onClose]);

  return (
    <div className="fullscreen-viewer-overlay" role="dialog" aria-modal="true">
      <button onClick={onClose} className="viewer-close-button" aria-label="Close image viewer">
        <XIcon />
      </button>

      <div className="viewer-image-container">
        <button onClick={goToPrevious} className="viewer-arrow viewer-arrow--left" aria-label="Previous image">
          <ChevronLeftIcon />
        </button>
        
        <img src={images[currentIndex]} alt={`Property image ${currentIndex + 1}`} className="viewer-image" />
        
        <button onClick={goToNext} className="viewer-arrow viewer-arrow--right" aria-label="Next image">
          <ChevronRightIcon />
        </button>
      </div>

      <div className="viewer-counter">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
};

export default FullscreenImageViewer;