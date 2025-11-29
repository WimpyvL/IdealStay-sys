import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number; // ms
}

interface ToastContextValue {
  showToast: (message: string, options?: { type?: ToastType; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options: { type?: ToastType; duration?: number } = {}) => {
      const id = `${Date.now()}-${counterRef.current++}`;
      const toast: ToastItem = {
        id,
        message,
        type: options.type || 'info',
        duration: options.duration ?? 4000
      };
      setToasts(prev => [...prev, toast]);
      if (toast.duration > 0) {
        setTimeout(() => removeToast(id), toast.duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast toast--${t.type}`}
            role="alert"
            onClick={() => removeToast(t.id)}
          >
            <span className="toast__message">{t.message}</span>
            <button className="toast__close" aria-label="Close" onClick={() => removeToast(t.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
