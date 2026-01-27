import { Amplify } from 'aws-amplify';
import {
  signUp,
  signIn,
  signOut,
  confirmSignUp,
  confirmSignIn,
  resetPassword,
  confirmResetPassword,
  fetchAuthSession,
  getCurrentUser,
  updateUserAttributes,
  updatePassword,
} from 'aws-amplify/auth';

const configureAmplify = () => {
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;

  if (!userPoolId || !userPoolClientId) {
    console.error('Missing Cognito configuration. Please set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID');
    return;
  }

  try {
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId,
        },
      },
    });
    console.log('Amplify configured successfully');
  } catch (error) {
    console.error('Failed to configure Amplify:', error);
  }
};

export const authService = {
  configure: configureAmplify,

  async signup(email: string, password: string, name: string) {
    return signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          name,
        },
      },
    });
  },

  async confirmSignUp(email: string, code: string) {
    return confirmSignUp({
      username: email,
      confirmationCode: code,
    });
  },

  async confirmSignInWithNewPassword(newPassword: string) {
    return confirmSignIn({
      challengeResponse: newPassword,
    });
  },

  async login(email: string, password: string) {
    try {
      const result = await signIn({
        username: email,
        password,
      });
      return result;
    } catch (error: any) {
      console.error('SignIn error:', error);
      throw error;
    }
  },

  async logout() {
    return signOut();
  },

  async forgotPassword(email: string) {
    return resetPassword({
      username: email,
    });
  },

  async forgotPasswordSubmit(email: string, code: string, newPassword: string) {
    return confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword,
    });
  },

  async getCurrentUser() {
    try {
      const user = await getCurrentUser();
      return user;
    } catch {
      return null;
    }
  },

  async getJWT() {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() || null;
    } catch {
      return null;
    }
  },

  async updateUserAttributes(attributes: Record<string, string>) {
    return updateUserAttributes({
      userAttributes: attributes,
    });
  },

  async changePassword(oldPassword: string, newPassword: string) {
    return updatePassword({
      oldPassword,
      newPassword,
    });
  },
};
