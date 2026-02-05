/**
 * Centralized API error handling utility
 */

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  isNetworkError: boolean;
  isCorsError: boolean;
  isAuthError: boolean;
}

/** Ensure we never show [object Object] or non-string in UI. */
function ensureMessageString(msg: unknown): string {
  if (typeof msg !== 'string' || !msg) return 'An unexpected error occurred';
  if (msg.includes('[object Object]')) return 'An unexpected error occurred';
  // Backend resolver can throw "Unknown field: undefined.undefined" when event shape is wrong
  if (msg.includes('Unknown field: undefined')) return 'A server configuration error occurred. Please try again or contact support.';
  return msg;
}

export function handleApiError(error: any): ApiError {
  const apiError: ApiError = {
    message: 'An unexpected error occurred',
    isNetworkError: false,
    isCorsError: false,
    isAuthError: false,
  };

  // Normalize: Amplify/GraphQL sometimes throws an array of errors
  const err = Array.isArray(error) && error.length > 0 ? error[0] : error;

  // Axios errors
  if (err?.response) {
    // Server responded with error status
    apiError.status = err.response.status;
    apiError.code = err.response.data?.code;
    apiError.message = ensureMessageString(err.response.data?.message || err.response.data?.error || `Server error (${err.response.status})`);

    if (err.response.status === 401 || err.response.status === 403) {
      apiError.isAuthError = true;
      apiError.message = 'Authentication required. Please sign in again.';
    }
    if (err.response.status === 402 && err.response.data?.code === 'INSUFFICIENT_CREDITS') {
      apiError.message = ensureMessageString(err.response.data?.message) || 'Not enough credits. Get more on the Pricing page.';
    }
  } else if (err?.request) {
    // Request made but no response (network error)
    apiError.isNetworkError = true;
    const msg = err?.message;
    if (err?.code === 'ERR_NETWORK' || (typeof msg === 'string' && msg?.includes('Network Error'))) {
      apiError.message = 'Unable to connect to the server. Please check your internet connection and try again.';
      apiError.code = 'NETWORK_ERROR';
    } else if (typeof msg === 'string' && msg?.includes('ERR_CONNECTION_REFUSED')) {
      apiError.message = 'The API server is not available. Please contact support.';
      apiError.code = 'CONNECTION_REFUSED';
    } else if (typeof msg === 'string' && msg?.includes('CORS')) {
      apiError.isCorsError = true;
      apiError.message = 'CORS error: The API is not configured to allow requests from this domain.';
      apiError.code = 'CORS_ERROR';
    } else {
      apiError.message = 'Network error: Unable to reach the server.';
      apiError.code = 'NETWORK_ERROR';
    }
  } else if (err?.status != null || (err as { graphqlErrors?: unknown[] })?.graphqlErrors) {
    // GraphQL/AppSync-style error (e.g. GraphQLApiError from graphqlService)
    const status = err.status as number | undefined;
    const graphqlErrors = (err as { graphqlErrors?: Array<{ message?: string }> }).graphqlErrors;
    apiError.status = status;
    apiError.message = ensureMessageString(err?.message || graphqlErrors?.[0]?.message || `Request failed${status ? ` (${status})` : ''}`);
    if (status === 401 || status === 403) {
      apiError.isAuthError = true;
      apiError.message = 'Authentication required. Please sign in again.';
    }
  } else {
    apiError.message = ensureMessageString(err?.message);
  }

  return apiError;
}

export function getErrorMessage(error: any): string {
  return ensureMessageString(handleApiError(error).message);
}

export function isNetworkError(error: any): boolean {
  return handleApiError(error).isNetworkError || handleApiError(error).isCorsError;
}
