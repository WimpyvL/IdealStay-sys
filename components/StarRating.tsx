
import React, { useState } from 'react';
import { StarIcon } from './icons/Icons';
import './StarRating.css';

interface StarRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
}

const StarRating: React.FC<StarRatingProps> = ({ rating, onRatingChange }) => {
  const [hover, setHover] = useState(0);

  return (
    <div className="star-rating">
      {[...Array(5)].map((_, index) => {
        const ratingValue = index + 1;
        return (
          <button
            type="button"
            key={ratingValue}
            className={`star-button ${ratingValue <= (hover || rating) ? 'star-button--on' : 'star-button--off'}`}
            onClick={() => onRatingChange(ratingValue)}
            onMouseEnter={() => setHover(ratingValue)}
            onMouseLeave={() => setHover(0)}
            aria-label={`Rate ${ratingValue} out of 5 stars`}
          >
            <StarIcon className="star-icon" />
          </button>
        );
      })}
    </div>
  );
};

export default StarRating;