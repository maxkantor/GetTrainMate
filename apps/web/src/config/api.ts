/**
 * API base URL used by REST services.
 * Auto-corrects common env typos from Amplify (wrong region string, wrong API id).
 */
const RAW = import.meta.env.VITE_API_URL || 'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

let url = RAW.replace('us-cast-1', 'us-east-1');
// Wrong API Gateway id (u vs w) → net::ERR_NAME_NOT_RESOLVED; correct id matches CDK output ApiUrl
url = url.replace('goskuvjzjg.execute-api', 'goskwzjzjg.execute-api');

export const API_BASE_URL = url;
