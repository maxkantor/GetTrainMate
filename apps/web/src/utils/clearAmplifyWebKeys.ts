/**
 * Last-resort wipe of Amplify/Cognito browser storage when signOut is not enough (e.g. stale UI after admin delete).
 * Scoped to known key patterns for this app origin only.
 */
export function clearAmplifyAuthStorageKeys(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const drop: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith('CognitoIdentityServiceProvider.') ||
        k.startsWith('amplify-') ||
        k.includes('aws.cognito')
      ) {
        drop.push(k);
      }
    }
    drop.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  try {
    const dropS: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      if (k.startsWith('CognitoIdentityServiceProvider.') || k.startsWith('amplify-')) dropS.push(k);
    }
    dropS.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
