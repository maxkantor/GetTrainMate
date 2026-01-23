import React, { createContext, useState, useEffect } from 'react';
import { authService } from '@/services/authService';
import { fetchAuthSession } from 'aws-amplify/auth';

interface AuthUser {
  email: string;
  name?: string;
  sub: string;
  groups?: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  confirmSignUp: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  login: async () => ({ success: false }),
  logout: async () => {},
  signup: async () => ({ success: false }),
  confirmSignUp: async () => ({ success: false }),
});

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to extract user data from Amplify user
  const extractUserData = async (amplifyUser: any): Promise<AuthUser> => {
    // Get groups from JWT token
    const session = await fetchAuthSession();
    const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || [];

    return {
      email: amplifyUser.signInDetails?.loginId || amplifyUser.username,
      name: amplifyUser.username,
      sub: amplifyUser.userId,
      groups,
    };
  };

  // Initialize auth on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
          const userData = await extractUserData(currentUser);
          setUser(userData);
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const result = await authService.login(email, password);
      
      // Fetch user data after successful login
      const currentUser = await authService.getCurrentUser();
      if (currentUser) {
        const userData = await extractUserData(currentUser);
        setUser(userData);
      }
      
      return { success: true };
    } catch (error: any) {
      const message = error.message || 'Login failed';
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    try {
      setIsLoading(true);
      await authService.signup(email, password, name);
      return { success: true };
    } catch (error: any) {
      const message = error.message || 'Signup failed';
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const confirmSignUp = async (email: string, code: string) => {
    try {
      setIsLoading(true);
      await authService.confirmSignUp(email, code);
      return { success: true };
    } catch (error: any) {
      const message = error.message || 'Confirmation failed';
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        signup,
        confirmSignUp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
