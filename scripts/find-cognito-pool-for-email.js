#!/usr/bin/env node
/**
 * Find which Cognito User Pool contains a given email.
 * Use this when login works on Amplify but not localhost ("No account found").
 *
 * Usage: node scripts/find-cognito-pool-for-email.js <email>
 * Example: node scripts/find-cognito-pool-for-email.js mykantor@bellsouth.net
 */

const { execSync } = require('child_process');
const REGION = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1';

const email = process.argv[2] || process.env.FIND_EMAIL;
if (!email) {
  console.error('Usage: node scripts/find-cognito-pool-for-email.js <email>');
  console.error('Example: node scripts/find-cognito-pool-for-email.js mykantor@bellsouth.net');
  process.exit(1);
}

function listUserPools() {
  try {
    const out = execSync(
      `aws cognito-idp list-user-pools --max-results 20 --region ${REGION} --output json`,
      { encoding: 'utf8' }
    );
    return JSON.parse(out).UserPools || [];
  } catch (e) {
    console.error('Failed to list user pools. Ensure AWS CLI is configured (aws configure).', e.message);
    process.exit(1);
  }
}

function listUsersInPool(userPoolId) {
  try {
    const out = execSync(
      `aws cognito-idp list-users --user-pool-id ${userPoolId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    );
    return JSON.parse(out).Users || [];
  } catch (e) {
    return [];
  }
}

function userEmail(user) {
  const attrs = user.Attributes || [];
  const a = attrs.find((x) => x.Name === 'email');
  return a ? a.Value : '';
}

function getAppClients(userPoolId) {
  try {
    const out = execSync(
      `aws cognito-idp list-user-pool-clients --user-pool-id ${userPoolId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    );
    return JSON.parse(out).UserPoolClients || [];
  } catch (e) {
    return [];
  }
}

const pools = listUserPools();
if (pools.length === 0) {
  console.log('No Cognito user pools found in region', REGION);
  process.exit(0);
}

console.log(`Searching for "${email}" in ${pools.length} user pool(s) in ${REGION}...\n`);

const emailLower = email.trim().toLowerCase();
for (const pool of pools) {
  const users = listUsersInPool(pool.Id).filter((u) => userEmail(u).toLowerCase() === emailLower);
  if (users.length > 0) {
    const clients = getAppClients(pool.Id);
    const clientId = clients.find((c) => c.ClientName?.includes('web') || c.ClientName?.includes('gettrainmate'))?.ClientId || clients[0]?.ClientId;
    console.log('Found your user in this pool:');
    console.log('  Name:', pool.Name);
    console.log('  User pool ID:', pool.Id);
    if (clientId) console.log('  App client ID:', clientId);
    console.log('');
    console.log('Add to apps/web/.env (then restart dev server):');
    console.log(`  VITE_COGNITO_USER_POOL_ID=${pool.Id}`);
    console.log(`  VITE_COGNITO_CLIENT_ID=${clientId || 'GET_FROM_COGNITO_APP_CLIENT_LIST'}`);
    console.log(`  VITE_COGNITO_REGION=${REGION}`);
    console.log('');
    process.exit(0);
  }
}

console.log(`No user with email "${email}" found in any pool in ${REGION}.`);
console.log('If you sign in on Amplify, the pool Amplify uses may be in a different region or account.');
process.exit(1);
