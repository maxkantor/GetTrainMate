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

export function handleApiError(error: any): ApiError {
  const apiError: ApiError = {
    message: 'An unexpected error occurred',
    isNetworkError: false,
    isCorsError: false,
    isAuthError: false,
  };

  // Axios errors
  if (error.response) {
    // Server responded with error status
    apiError.status = error.response.status;
    apiError.code = error.response.data?.code;
    apiError.message = error.response.data?.message || error.response.data?.error || `Server error (${error.response.status})`;

    if (error.response.status === 401 || error.response.status === 403) {
      apiError.isAuthError = true;
      apiError.message = 'Authentication required. Please login again.';
    }
    if (error.response.status === 402 && error.response.data?.code === 'INSUFFICIENT_CREDITS') {
      apiError.message = error.response.data?.message || 'Not enough credits. Get more on the Pricing page.';
    }
  } else if (error.request) {
    // Request made but no response (network error)
    apiError.isNetworkError = true;
    
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      apiError.message = 'Unable to connect to the server. Please check your internet connection and try again.';
      apiError.code = 'NETWORK_ERROR';
    } else if (error.message?.includes('ERR_CONNECTION_REFUSED')) {
      apiError.message = 'The API server is not available. Please contact support.';
      apiError.code = 'CONNECTION_REFUSED';
    } else if (error.message?.includes('CORS')) {
      apiError.isCorsError = true;
      apiError.message = 'CORS error: The API is not configured to allow requests from this domain.';
      apiError.code = 'CORS_ERROR';
    } else {
      apiError.message = 'Network error: Unable to reach the server.';
      apiError.code = 'NETWORK_ERROR';
    }
  } else {
    // Something else happened
    apiError.message = error.message || 'An unexpected error occurred';
  }

  return apiError;
}

export function getErrorMessage(error: any): string {
  return handleApiError(error).message;
}

export function isNetworkError(error: any): boolean {
  return handleApiError(error).isNetworkError || handleApiError(error).isCorsError;
}
