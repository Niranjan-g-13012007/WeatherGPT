import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check current session on mount or after navigation
  const checkAuth = useCallback(async () => {
    try {
      const data = await authService.getCurrentUser();
      if (data && data.success && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Handle local signup
  const signup = async ({ name, email, password }) => {
    const data = await authService.signup({ name, email, password });
    if (data && data.user) {
      setUser(data.user);
    }
    return data;
  };

  // Handle local login
  const login = async ({ email, password }) => {
    const data = await authService.login({ email, password });
    if (data && data.user) {
      setUser(data.user);
    }
    return data;
  };

  // Handle logout
  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    signup,
    login,
    logout,
    checkAuth,
    loginWithGoogle: authService.loginWithGoogle,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
