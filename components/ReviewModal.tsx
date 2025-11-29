
import React, { useState } from 'react';
import { Booking } from '../types';
import Modal from './Modal';
import StarRating from './StarRating';
import './ReviewModal.css';

interface ReviewModalProps {
  booking: Booking;
  onClose: () => void;
  onSubmit: (review: { rating: number; text: string }) => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ booking, onClose, onSubmit }) => {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      alert('Please select a star rating.');
      return;
    }
    onSubmit({ rating, text: reviewText });
  };

  return (
    <Modal title="Leave a Review" onClose={onClose}>
      <form onSubmit={handleSubmit} className="review-form">
        <p className="review-form__property-title">
          How was your stay at <strong>{booking.property.title}</strong>?
        </p>
        
        <div className="review-form__rating-section">
          <label className="review-form__label">Your Rating</label>
          <StarRating rating={rating} onRatingChange={setRating} />
        </div>

        <div className="review-form__text-section">
           <label htmlFor="reviewText" className="review-form__label">Your Review</label>
          <textarea
            id="reviewText"
            className="review-form__textarea"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Share your experience..."
            rows={5}
          />
        </div>
        
        <div className="modal__actions">
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={rating === 0}>
            Submit Review
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ReviewModal;