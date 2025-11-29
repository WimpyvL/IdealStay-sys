import React, { useState } from 'react';
import Modal from './Modal';
import { GoogleIcon, AppleIcon } from './icons/Icons';
import { useAuth } from '../src/contexts/AuthContext';
import './SignUpModal.css';

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignIn: () => void;
}

const SignUpModal: React.FC<SignUpModalProps> = ({ isOpen, onClose, onSwitchToSignIn }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

    const [passwordError, setPasswordError] = useState('');
    const [showPostRegisterNotice, setShowPostRegisterNotice] = useState(false);
  const { state, register, clearError } = useAuth();
  const { isLoading, error } = state;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'password' || name === 'confirmPassword') {
        setPasswordError('');
    }
    
    // Clear error when user starts typing
    if (error) {
      clearError();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { confirmPassword, ...registrationData } = formData;
            const result = await register(registrationData as any);
            // Show verification notice instead of closing immediately
            setShowPostRegisterNotice(true);
            setFormData({ first_name: '', last_name: '', email: '', password: '', confirmPassword: '' });
    } catch (error) {
      // Error is handled by the AuthContext
      console.error('Registration failed:', error);
    }
  };
  
  if (!isOpen) return null;

  return (
    <Modal title="Create your account" onClose={onClose}>
      <div className="auth-modal-layout">
        <div className="auth-modal__graphic">
            <div className="auth-modal__graphic-content">
                <h2>Your journey begins here.</h2>
                <p>Sign up to book unique stays, manage your trips, and build a wishlist of dream destinations.</p>
            </div>
        </div>
        <div className="auth-modal__form">
            {!showPostRegisterNotice && (
            <form onSubmit={handleSubmit}>
                <p className="form-subtitle">Create an account to get started.</p>
                
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

                <div className="form-group-row">
                    <div className="form-group">
                        <label htmlFor="signup-first-name">First Name</label>
                        <input 
                            type="text" 
                            id="signup-first-name" 
                            name="first_name" 
                            value={formData.first_name} 
                            onChange={handleChange} 
                            disabled={isLoading}
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="signup-last-name">Last Name</label>
                        <input 
                            type="text" 
                            id="signup-last-name" 
                            name="last_name" 
                            value={formData.last_name} 
                            onChange={handleChange} 
                            disabled={isLoading}
                            required 
                        />
                    </div>
                </div>
                
                <div className="form-group">
                    <label htmlFor="signup-email">Email Address</label>
                    <input 
                        type="email" 
                        id="signup-email" 
                        name="email" 
                        value={formData.email} 
                        onChange={handleChange} 
                        disabled={isLoading}
                        required 
                    />
                </div>
                
                <div className="form-group">
                    <label htmlFor="signup-password">Password</label>
                    <input 
                        type="password" 
                        id="signup-password" 
                        name="password" 
                        value={formData.password} 
                        onChange={handleChange} 
                        disabled={isLoading}
                        required 
                        minLength={8} 
                    />
                </div>
                
                <div className="form-group">
                    <label htmlFor="signup-confirmPassword">Confirm Password</label>
                    <input 
                        type="password" 
                        id="signup-confirmPassword" 
                        name="confirmPassword" 
                        value={formData.confirmPassword} 
                        onChange={handleChange} 
                        disabled={isLoading}
                        required 
                        minLength={8}
                    />
                    {passwordError && <p className="form-error">{passwordError}</p>}
                </div>

                <div className="modal__actions">
                    <button 
                        type="submit" 
                        className="button button--primary button--full-width"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Creating Account...' : 'Sign Up'}
                    </button>
                </div>

                                <p className="form-switch-link">
                                        Already have an account?{' '}
                                        <button type="button" onClick={onSwitchToSignIn}>
                                                Sign In
                                        </button>
                                </p>
                        </form>
                        )}
                        {showPostRegisterNotice && (
                            <div className="post-register-notice" role="status" aria-live="polite">
                                <h3>Check your email 📬</h3>
                                <p>We sent a verification link to your email. Please click the link to activate your account.</p>
                                <p className="small">Didn’t get it? It may take a minute. Check spam or request a new link on the verification page.</p>
                                <div className="modal__actions">
                                    <button type="button" className="button button--primary" onClick={onClose}>
                                        Got It
                                    </button>
                                </div>
                            </div>
                        )}
        </div>
      </div>
    </Modal>
  );
};

export default SignUpModal;