export function isLocalOrDevEnvironment(): boolean {
  return import.meta.env.DEV || String(import.meta.env.MODE || '').toLowerCase() !== 'production';
}

export function sportsLayerDevLog(): void {
  if (!isLocalOrDevEnvironment()) return;
  console.log('Sports Event Layer loaded in local/dev mode');
}
