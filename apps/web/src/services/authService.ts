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

let isConfigured = false;

const configureAmplify = (): boolean => {
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  const region = import.meta.env.VITE_COGNITO_REGION || 'us-east-1';

  if (!userPoolId || !userPoolClientId) {
    console.error(
      'Auth UserPool not configured. Create apps/web/.env with:\n' +
        '  VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXX  (from CDK output UserPoolId)\n' +
        '  VITE_COGNITO_CLIENT_ID=XXXXX               (from CDK output UserPoolClientId or AWS Cognito Console)\n' +
        '  VITE_COGNITO_REGION=us-east-1'
    );
    return false;
  }

  try {
    const config: Record<string, unknown> = {
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId,
          userPoolRegion: region,
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
    isConfigured = true;
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.log('[Auth] Using Cognito User Pool:', userPoolId, '| Client:', userPoolClientId?.slice(0, 8) + '...', '| Region:', region);
    }
    return true;
  } catch (error) {
    console.error('Failed to configure Amplify:', error);
    return false;
  }
};

export const isAuthConfigured = (): boolean => isConfigured;

/** Dev only: which pool we're using (for debugging "works on Amplify, not localhost") */
export const getAuthPoolDebug = (): string | null => {
  if (!import.meta.env.DEV || !isConfigured) return null;
  const id = import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined;
  if (!id) return null;
  const parts = id.split('_');
  return parts.length >= 2 ? `${parts[0]}_••••${id.slice(-4)}` : '••••';
};

export const authService = {
  configure: configureAmplify,

  /**
   * Sign up with Cognito. Sends all attributes your pool requires (we can't remove required
   * attributes in Cognito). Includes: email, name, given_name, updated_at (current time).
   * - Username: UUID (required when pool uses email-as-alias).
   */
  async signup(email: string, password: string, fullName: string): Promise<{ username: string }> {
    const username = crypto.randomUUID();
    const trimmedName = fullName.trim();
    await signUp({
      username,
      password,
      options: {
        userAttributes: {
          email: email.trim(),
          name: trimmedName,
          given_name: trimmedName,
          updated_at: String(Math.floor(Date.now() / 1000)),
        },
      },
    });
    return { username };
  },

  async confirmSignUp(username: string, code: string) {
    return confirmSignUp({
      username,
      confirmationCode: code.trim(),
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
   * Get token for API calls. Use forceRefresh when retrying after 401.
   * Returns ACCESS token - backend validates via Cognito GetUser API.
   */
  async getJWT(forceRefresh = false): Promise<string | null> {
    try {
      const session = await fetchAuthSession({ forceRefresh });
      const token = session.tokens?.accessToken?.toString() || null;
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
