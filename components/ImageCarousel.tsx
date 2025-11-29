import React, { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './icons/Icons';
import './ImageCarousel.css';

interface ImageCarouselProps {
  images: string[];
  onImageClick?: (index: number) => void;
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({ images, onImageClick }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => {
    const isFirstSlide = currentIndex === 0;
    const newIndex = isFirstSlide ? images.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const goToNext = () => {
    const isLastSlide = currentIndex === images.length - 1;
    const newIndex = isLastSlide ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  };
  
  const goToSlide = (slideIndex: number) => {
    setCurrentIndex(slideIndex);
  }

  return (
    <div className="carousel-container">
      <div
        className="carousel-slide"
        style={{ backgroundImage: `url(${images[currentIndex]})` }}
        onClick={() => onImageClick?.(currentIndex)}
        role={onImageClick ? 'button' : undefined}
        aria-label={onImageClick ? `View image ${currentIndex + 1} fullscreen` : undefined}
      ></div>
      <button onClick={goToPrevious} className="carousel-arrow carousel-arrow--left" aria-label="Previous image">
        <ChevronLeftIcon />
      </button>
      <button onClick={goToNext} className="carousel-arrow carousel-arrow--right" aria-label="Next image">
        <ChevronRightIcon />
      </button>
      <div className="carousel-dots">
        {images.map((_, slideIndex) => (
          <button
            key={slideIndex}
            onClick={() => goToSlide(slideIndex)}
            className={`carousel-dot ${currentIndex === slideIndex ? 'carousel-dot--active' : ''}`}
            aria-label={`Go to image ${slideIndex + 1}`}
          ></button>
        ))}
      </div>
    </div>
  );
};

export default ImageCarousel;