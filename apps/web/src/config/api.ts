/**
 * API base URL used by REST services.
 * Auto-corrects common env typos (e.g. us-cast-1 → us-east-1) from Amplify.
 */
const RAW = import.meta.env.VITE_API_URL || 'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

// Fix Amplify typo: us-cast-1 (invalid) → us-east-1
export const API_BASE_URL = RAW.replace('us-cast-1', 'us-east-1');
