import React, { useState } from 'react';
import Modal from './Modal';
import { GoogleIcon, AppleIcon } from './icons/Icons';
import { useAuth } from '../src/contexts/AuthContext';
import './SignInModal.css';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignUp: () => void;
  onSwitchToResetPassword: () => void;
}

const SignInModal: React.FC<SignInModalProps> = ({ 
    isOpen, 
    onClose, 
    onSwitchToSignUp,
    onSwitchToResetPassword 
}) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  
  const { state, login, clearError } = useAuth();
  const { isLoading, error } = state;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (error) {
      clearError();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(formData);
      // Clear form and close modal on successful login
      setFormData({ email: '', password: '' });
      onClose();
    } catch (error) {
      // Error is handled by the AuthContext
      console.error('Login failed:', error);
    }
  };
  
  if (!isOpen) return null;

  return (
    <Modal title="Sign In" onClose={onClose}>
        <div className="auth-modal-layout">
            <div className="auth-modal__graphic">
                <div className="auth-modal__graphic-content">
                    <h2>Your next adventure awaits.</h2>
                    <p>Access your trips, messages, and saved properties all in one place.</p>
                </div>
            </div>
            <div className="auth-modal__form">
                 <form onSubmit={handleSubmit}>
                    <p className="form-subtitle">Welcome back! Sign in to continue.</p>
                    
                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}
                    
                    <div className="social-login-options">
                        <button type="button" className="social-login-button" disabled={isLoading}>
                            <GoogleIcon />
                            <span>Continue with Google</span>
                        </button>
                         <button type="button" className="social-login-button" disabled={isLoading}>
                            <AppleIcon />
                            <span>Continue with Apple</span>
                        </button>
                    </div>

                    <div className="divider-or">
                        <span>OR</span>
                    </div>

                    <div className="form-group">
                        <label htmlFor="signin-email">Email Address</label>
                        <input 
                            type="email" 
                            id="signin-email" 
                            name="email" 
                            value={formData.email} 
                            onChange={handleChange} 
                            disabled={isLoading}
                            required 
                        />
                    </div>

                    <div className="form-group">
                        <div className="form-label-group">
                            <label htmlFor="signin-password">Password</label>
                            <button 
                                type="button" 
                                className="form-link-button" 
                                onClick={onSwitchToResetPassword}
                                disabled={isLoading}
                            >
                                Forgot password?
                            </button>
                        </div>
                        <input 
                            type="password" 
                            id="signin-password" 
                            name="password" 
                            value={formData.password} 
                            onChange={handleChange} 
                            disabled={isLoading}
                            required 
                        />
                    </div>

                    <div className="modal__actions">
                        <button 
                            type="submit" 
                            className="button button--primary button--full-width"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </button>
                    </div>

                    <p className="form-switch-link">
                        Don't have an account?{' '}
                        <button type="button" onClick={onSwitchToSignUp}>
                            Sign Up
                        </button>
                    </p>
                </form>
            </div>
        </div>
    </Modal>
  );
};

export default SignInModal;