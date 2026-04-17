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
  signInWithRedirect,
  resendSignUpCode,
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
    try {
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
    } catch (e: unknown) {
      const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : '';
      const msg = e instanceof Error ? e.message : String(e);
      if (
        name === 'UsernameExistsException' ||
        name === 'AliasExistsException' ||
        /already exists|An account with the given email already exists/i.test(msg)
      ) {
        throw new Error('An account with this email already exists. Sign in instead.');
      }
      throw e;
    }
    return { username };
  },

  async resendSignupVerificationCode(username: string): Promise<void> {
    await resendSignUpCode({ username });
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

  /**
   * Cognito Hosted UI (Google IdP). Requires OAuth domain + redirect URLs in the user pool.
   * Returns false if redirect was not started (misconfiguration or unsupported).
   */
  async signInWithGoogle(): Promise<{ started: boolean; error?: string }> {
    if (!isConfigured) {
      return { started: false, error: 'Auth not configured' };
    }
    try {
      await signInWithRedirect({ provider: 'Google' });
      return { started: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Google sign-in failed';
      console.warn('[Auth] signInWithRedirect Google:', msg);
      return { started: false, error: msg };
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
   * Forces a Cognito token refresh. If the user was deleted, disabled, or refresh tokens were revoked,
   * this fails and returns false — use on app bootstrap so the UI does not stay "logged in" from cache alone.
   * Returns true on transient/network errors so we do not sign everyone out when offline.
   */
  async isRefreshSessionValid(): Promise<boolean> {
    try {
      const session = await fetchAuthSession({ forceRefresh: true });
      return Boolean(session.tokens?.accessToken);
    } catch (e: unknown) {
      const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : '';
      if (
        name === 'NotAuthorizedException' ||
        name === 'UserUnAuthenticatedException' ||
        name === 'InvalidRefreshTokenException' ||
        name === 'UserNotFoundException'
      ) {
        return false;
      }
      if (import.meta.env.DEV) {
        console.warn('[auth] fetchAuthSession(forceRefresh) failed (treating as transient):', name || e);
      }
      return true;
    }
  },

  /**
   * Get token for API calls. Use forceRefresh when retrying after 401.
   * Returns ACCESS token - backend validates via Cognito GetUser API.
   */
  async getJWT(forceRefresh = false): Promise<string | null> {
    try {
      const session = await fetchAuthSession({ forceRefresh });
      const raw = session.tokens?.accessToken;
      const token =
        raw == null
          ? null
          : typeof raw === 'string'
            ? raw
            : typeof (raw as { toString?: () => string }).toString === 'function'
              ? String((raw as { toString: () => string }).toString())
              : null;
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
