import React, { useEffect, useState } from 'react';
import { authService } from '../src/services';
import './VerifyEmailPage.css';

interface VerifyEmailPageProps {
  token?: string;
  onVerified: () => void;
  onBackToExplore: () => void;
}

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({ token, onVerified, onBackToExplore }) => {
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState<string>('Verifying your email...');
  const [resendEmail, setResendEmail] = useState<string>('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Missing verification token.');
        return;
      }
      try {
        const res = await authService.verifyEmail(token);
        setStatus('success');
        setMessage(res.message || 'Email verified successfully.');
        setTimeout(() => onVerified(), 1500);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Verification failed. The link may be invalid or expired.');
      }
    };
    verify();
  }, [token, onVerified]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResendStatus('sending');
    setResendMessage('');
    try {
      const res = await authService.resendVerification(resendEmail);
      setResendStatus('sent');
      setResendMessage(res.message || 'Verification email resent.');
    } catch (err: any) {
      setResendStatus('error');
      setResendMessage(err.message || 'Failed to resend verification email.');
    }
  };

  return (
    <div className="verify-email">
      <div className="verify-email__card">
        <h1>Email Verification</h1>
        <p className={`verify-email__status verify-email__status--${status}`}>{message}</p>
        {status === 'pending' && <div className="loading-spinner" aria-label="Verifying" />}
        {status === 'success' && (
          <button className="button button--primary" onClick={onBackToExplore}>Continue</button>
        )}
        {status === 'error' && (
          <div className="verify-email__resend">
            <h2>Need a new link?</h2>
            <form onSubmit={handleResend} className="verify-email__resend-form">
              <input
                type="email"
                placeholder="Enter your email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                required
                disabled={resendStatus === 'sending'}
              />
              <button type="submit" className="button button--secondary" disabled={resendStatus === 'sending'}>
                {resendStatus === 'sending' ? 'Sending...' : 'Resend Verification Email'}
              </button>
            </form>
            {resendMessage && <p className={`verify-email__resend-message verify-email__resend-message--${resendStatus}`}>{resendMessage}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;
