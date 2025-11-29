/**
 * Authentication Context
 * Manages user authentication state, login, logout, and token validation
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { User } from '../../types';
import { authService, AuthResponse, LoginRequest, RegisterRequest } from '../services';

// Authentication state interface
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Authentication actions
export type AuthAction =
  | { type: 'AUTH_LOADING' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_ERROR'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'CLEAR_ERROR' };

// Initial state
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Authentication reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_LOADING':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case 'AUTH_ERROR':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };

    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };

    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
}

// Context interface
interface AuthContextType {
  state: AuthState;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string, newPassword: string) => Promise<void>;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  uploadProfileImage: (imageFile: File) => Promise<string>;
  resendVerification: (email: string) => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
  becomeHost: () => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType | null>(null);

// Provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Authentication provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize authentication state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = authService.getToken();
      const user = authService.getCurrentUser();

      if (token && user) {
        // Validate token with server
        dispatch({ type: 'AUTH_LOADING' });
        try {
          const validation = await authService.validateToken();
          if (validation.valid && validation.user) {
            let validatedUser = validation.user;
            // If profile_image_url missing, fetch full profile
            if (!validatedUser.profile_image_url) {
              try {
                validatedUser = await authService.fetchFullProfile();
              } catch (profileErr) {
                console.warn('Full profile fetch failed:', profileErr);
              }
            }
            dispatch({
              type: 'AUTH_SUCCESS',
              payload: { user: validatedUser, token },
            });
          } else {
            // Token is invalid, clear storage
            dispatch({ type: 'AUTH_LOGOUT' });
          }
        } catch (error) {
          console.error('Token validation failed:', error);
          dispatch({ type: 'AUTH_LOGOUT' });
        }
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (credentials: LoginRequest): Promise<void> => {
    dispatch({ type: 'AUTH_LOADING' });
    try {
      const authResponse: AuthResponse = await authService.login(credentials);
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: authResponse.user,
          token: authResponse.token,
        },
      });
    } catch (error: any) {
      dispatch({
        type: 'AUTH_ERROR',
        payload: error.message || 'Login failed',
      });
      throw error;
    }
  };

  // Register function
  const register = async (userData: RegisterRequest): Promise<void> => {
    dispatch({ type: 'AUTH_LOADING' });
    try {
      const authResponse: AuthResponse = await authService.register(userData);
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: authResponse.user,
          token: authResponse.token,
        },
      });
    } catch (error: any) {
      dispatch({
        type: 'AUTH_ERROR',
        payload: error.message || 'Registration failed',
      });
      throw error;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    dispatch({ type: 'AUTH_LOADING' });
    try {
      await authService.logout();
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  };

  // Reset password function
  const resetPassword = async (email: string, newPassword: string): Promise<void> => {
    dispatch({ type: 'AUTH_LOADING' });
    try {
      await authService.resetPassword({ email, new_password: newPassword });
      // Don't change auth state for password reset
      dispatch({ type: 'CLEAR_ERROR' });
    } catch (error: any) {
      dispatch({
        type: 'AUTH_ERROR',
        payload: error.message || 'Password reset failed',
      });
      throw error;
    }
  };

  // Update profile function
  const updateProfile = async (userData: Partial<User>): Promise<void> => {
    try {
      const updatedUser = await authService.updateProfile(userData);
      dispatch({ type: 'UPDATE_USER', payload: updatedUser });
    } catch (error: any) {
      dispatch({
        type: 'AUTH_ERROR',
        payload: error.message || 'Profile update failed',
      });
      throw error;
    }
  };

  // Upload profile image function
  const uploadProfileImage = async (imageFile: File): Promise<string> => {
    try {
      const result = await authService.uploadProfileImage(imageFile);
      if (state.user) {
        const updatedUser = { ...state.user, profile_image_url: result.image_url };
        dispatch({ type: 'UPDATE_USER', payload: updatedUser });
      }
      return result.image_url;
    } catch (error: any) {
      dispatch({
        type: 'AUTH_ERROR',
        payload: error.message || 'Image upload failed',
      });
      throw error;
    }
  };

  // Clear error function
  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Refresh user data function
  const refreshUser = async (): Promise<void> => {
    try {
      const updatedUser = await authService.refreshUser();
      dispatch({ type: 'UPDATE_USER', payload: updatedUser });
    } catch (error: any) {
      dispatch({
        type: 'AUTH_ERROR',
        payload: error.message || 'Failed to refresh user data',
      });
      throw error;
    }
  };

  // Become host (upgrade existing account)
  const becomeHost = async (): Promise<void> => {
    dispatch({ type: 'AUTH_LOADING' });
    try {
      const updatedUser = await authService.becomeHost();
      dispatch({ type: 'AUTH_SUCCESS', payload: { user: updatedUser, token: state.token || authService.getToken() || '' } });
    } catch (error: any) {
      dispatch({ type: 'AUTH_ERROR', payload: error.message || 'Failed to become host' });
      throw error;
    }
  };

  const value: AuthContextType = {
    state,
    login,
    register,
    logout,
    resetPassword,
    updateProfile,
    uploadProfileImage,
    resendVerification: async (email: string) => { await authService.resendVerification(email); },
    clearError,
    refreshUser,
    becomeHost,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Selector hooks for specific auth state
export const useAuthState = () => {
  const { state } = useAuth();
  return state;
};

export const useAuthActions = () => {
  const { login, register, logout, resetPassword, updateProfile, uploadProfileImage, clearError, refreshUser } = useAuth();
  return { login, register, logout, resetPassword, updateProfile, uploadProfileImage, clearError, refreshUser };
};

export const useUser = () => {
  const { state } = useAuth();
  return state.user;
};

export const useIsAuthenticated = () => {
  const { state } = useAuth();
  return state.isAuthenticated;
};