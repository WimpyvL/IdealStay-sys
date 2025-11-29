import React, { useState } from 'react';
import Modal from './Modal';
import { useAuth } from '../src/contexts/AuthContext';
import './ResetPasswordModal.css';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToSignIn: () => void;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ isOpen, onClose, onBackToSignIn }) => {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  
  const { state, resetPassword, clearError } = useAuth();
  const { isLoading, error } = state;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!password || password.length < 8) {
        setLocalError('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }
      await resetPassword(email, password);
      setSuccess(true);
    } catch (error) {
      console.error('Password reset failed:', error);
    }
  };

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setLocalError(null);
    setSuccess(false);
    clearError();
    onClose();
  };

  const handleBackToSignIn = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setLocalError(null);
    setSuccess(false);
    clearError();
    onBackToSignIn();
  };
  
  if (!isOpen) return null;

  return (
    <Modal title="Reset Password" onClose={handleClose}>
      <div className="reset-password-container">
        {success ? (
          <div className="success-message">
            <h3>Email Sent!</h3>
            <p>We've sent a password reset link to <strong>{email}</strong>. Please check your email and follow the instructions to reset your password.</p>
            <div className="modal__actions">
              <button type="button" className="button button--primary" onClick={handleBackToSignIn}>
                Back to Sign In
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="reset-password-form">
            <p className="form-subtitle">Enter your email and choose a new password. (Test mode: resets immediately without email link)</p>
            
            {(error || localError) && (
              <div className="error-message">
                {localError || error}
              </div>
            )}
            
            <div className="form-group">
              <label htmlFor="reset-email">Email Address</label>
              <input
                type="email"
                id="reset-email"
                name="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setLocalError(null);
                  if (error) clearError();
                }}
                disabled={isLoading}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-password">New Password</label>
              <input
                type="password"
                id="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLocalError(null);
                }}
                minLength={8}
                disabled={isLoading}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm-password">Confirm Password</label>
              <input
                type="password"
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setLocalError(null);
                }}
                minLength={8}
                disabled={isLoading}
                required
              />
            </div>

            <div className="modal__actions">
              <button 
                type="button" 
                className="button button--secondary" 
                onClick={handleBackToSignIn}
                disabled={isLoading}
              >
                Back to Sign In
              </button>
              <button 
                type="submit" 
                className="button button--primary"
                disabled={isLoading}
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default ResetPasswordModal;
