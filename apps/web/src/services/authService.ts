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
import { isGraphQLEnabled, APPSYNC_GRAPHQL_URL } from '@/config/appsync';

const configureAmplify = () => {
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;

  if (!userPoolId || !userPoolClientId) {
    console.error('Missing Cognito configuration. Please set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID');
    return;
  }

  try {
    const config: Record<string, unknown> = {
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId,
        },
      },
    };
    if (isGraphQLEnabled && APPSYNC_GRAPHQL_URL) {
      config.API = {
        GraphQL: {
          endpoint: APPSYNC_GRAPHQL_URL,
          region: import.meta.env.VITE_APPSYNC_REGION || 'us-east-1',
          defaultAuthMode: 'userPool' as const,
        },
      };
    }
    Amplify.configure(config);
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
          given_name: name, // Cognito standard attribute for first name
          name: name, // Also send as 'name' since it's required in Cognito
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
    // Cognito requires both given_name and name attributes, so we'll use default values
    // since we don't collect names during password reset
    return confirmSignIn({
      challengeResponse: newPassword,
      options: {
        userAttributes: {
          given_name: 'User', // Default value since we don't collect names
          name: 'User', // Also required by Cognito
        },
      },
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

  /**
   * Get JWT for API calls. Use forceRefresh when retrying after 401.
   * Returns id token (Cognito); backend accepts it for sub claim.
   */
  async getJWT(forceRefresh = false): Promise<string | null> {
    try {
      const session = await fetchAuthSession({ forceRefresh });
      const token = session.tokens?.idToken?.toString() || null;
      if (import.meta.env.DEV && token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const exp = payload.exp ? new Date(payload.exp * 1000) : null;
          console.debug('[auth] Token present, exp:', exp?.toISOString() ?? 'n/a');
        } catch {
          // ignore decode errors
        }
      }
      return token;
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
