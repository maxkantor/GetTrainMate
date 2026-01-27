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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; requiresNewPassword?: boolean }>;
  confirmSignInWithNewPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  confirmSignUp: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  login: async () => ({ success: false }),
  confirmSignInWithNewPassword: async () => ({ success: false }),
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
    try {
      // Get groups from JWT token
      const session = await fetchAuthSession();
      const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || [];

      return {
        email: amplifyUser.signInDetails?.loginId || amplifyUser.username,
        name: amplifyUser.username,
        sub: amplifyUser.userId,
        groups,
      };
    } catch (error) {
      console.error('Error extracting user data:', error);
      // Return basic user data even if session fetch fails
      return {
        email: amplifyUser.signInDetails?.loginId || amplifyUser.username || '',
        name: amplifyUser.username || '',
        sub: amplifyUser.userId || '',
        groups: [],
      };
    }
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
      console.log('Attempting login for:', email);
      const result = await authService.login(email, password);
      console.log('SignIn result:', result);
      
      // Check if sign-in requires additional steps
      if (result.nextStep) {
        const nextStepType = result.nextStep.signInStep;
        console.log('SignIn nextStep:', nextStepType);
        
        if (nextStepType === 'CONFIRM_SIGN_IN_WITH_SMS_CODE' || 
            nextStepType === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
          return { 
            success: false, 
            error: `Additional authentication required: ${nextStepType}` 
          };
        }
        
        if (nextStepType === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
          return { 
            success: false, 
            requiresNewPassword: true,
            error: 'Please set a new password to continue' 
          };
        }
        
        if (nextStepType === 'DONE') {
          // Sign-in is complete, wait a moment for session to be established
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Fetch user data after successful login
          const currentUser = await authService.getCurrentUser();
          console.log('Current user after login:', currentUser);
          
          if (currentUser) {
            const userData = await extractUserData(currentUser);
            console.log('Extracted user data:', userData);
            setUser(userData);
            return { success: true };
          } else {
            return { success: false, error: 'Login completed but unable to fetch user data' };
          }
        }
      }
      
      // If no nextStep, try to get current user anyway (for backwards compatibility)
      await new Promise(resolve => setTimeout(resolve, 100));
      const currentUser = await authService.getCurrentUser();
      console.log('Current user (no nextStep):', currentUser);
      
      if (currentUser) {
        const userData = await extractUserData(currentUser);
        setUser(userData);
        return { success: true };
      }
      
      return { success: false, error: 'Login completed but unable to fetch user data' };
    } catch (error: any) {
      console.error('Login error:', error);
      const message = error.message || error.toString() || 'Login failed';
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

  const confirmSignInWithNewPassword = async (newPassword: string) => {
    try {
      setIsLoading(true);
      const result = await authService.confirmSignInWithNewPassword(newPassword);
      console.log('ConfirmSignIn result:', result);
      
      // Check if sign-in is now complete
      if (result.nextStep?.signInStep === 'DONE' || result.isSignedIn) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
          const userData = await extractUserData(currentUser);
          setUser(userData);
          return { success: true };
        }
      }
      
      return { success: false, error: 'Password updated but unable to complete sign-in' };
    } catch (error: any) {
      console.error('ConfirmSignIn error:', error);
      const message = error.message || 'Failed to set new password';
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
        confirmSignInWithNewPassword,
        logout,
        signup,
        confirmSignUp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
