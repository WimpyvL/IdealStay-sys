import React, { useState } from 'react';
import Modal from './Modal';
import { GoogleIcon, AppleIcon } from './icons/Icons';
import { useAuth } from '../src/contexts/AuthContext';
import './BecomeHostModal.css';

interface BecomeHostModalProps {
  isOpen: boolean;
  onClose: () => void;
  // onRegister kept for backward compatibility but now optional / unused externally
  onRegister?: (data: { name: string; email: string }) => void;
  onSwitchToSignIn: () => void;
}

const BecomeHostModal: React.FC<BecomeHostModalProps> = ({ isOpen, onClose, onRegister, onSwitchToSignIn }) => {
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
    if (error) {
      clearError();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { confirmPassword, ...registrationData } = formData;
      // Host role registration
      await register({ ...(registrationData as any), role: 'host' });
      setShowPostRegisterNotice(true);
      setFormData({ first_name: '', last_name: '', email: '', password: '', confirmPassword: '' });
      // Invoke legacy callback (without password fields) if provided
      if (onRegister) {
        onRegister({ name: `${registrationData.first_name} ${registrationData.last_name}`.trim(), email: registrationData.email });
      }
    } catch (err) {
      // Error surfaced via context state
      console.error('Host registration failed:', err);
    }
  };
  
  if (!isOpen) return null;

  return (
    <Modal title="Become a Host" onClose={onClose}>
      <div className="auth-modal-layout">
        <div className="auth-modal__graphic">
            <div className="auth-modal__graphic-content">
                <h2>Join a community of hosts.</h2>
                <p>Share your space, connect with travelers, and earn money on your own terms.</p>
            </div>
        </div>
        <div className="auth-modal__form">
            {!showPostRegisterNotice && (
              <form onSubmit={handleSubmit}>
                <p className="form-subtitle">Create your host account to get started.</p>

                {error && (
                  <div className="error-message">{error}</div>
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
                    <label htmlFor="host-first-name">First Name</label>
                    <input
                      type="text"
                      id="host-first-name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="host-last-name">Last Name</label>
                    <input
                      type="text"
                      id="host-last-name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="host-email">Email Address</label>
                  <input
                    type="email"
                    id="host-email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="host-password">Password</label>
                  <input
                    type="password"
                    id="host-password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={8}
                    disabled={isLoading}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="host-confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="host-confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    minLength={8}
                    disabled={isLoading}
                  />
                  {passwordError && <p className="form-error">{passwordError}</p>}
                </div>

                <div className="modal__actions">
                  <button
                    type="submit"
                    className="button button--primary button--full-width"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating Account...' : 'Create Account'}
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
                <p>We sent a verification link to your email. Please verify to activate your host account.</p>
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

export default BecomeHostModal;
