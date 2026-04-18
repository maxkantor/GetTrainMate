/**
 * Husky pre-commit: if any staged file touches apps/api (excluding build outputs),
 * run `npm run zip` so deploy/gettrainmate-api-lambda.zip is always fresh for backend work.
 */
const { execSync } = require('child_process');
const path = require('path');

if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
  process.exit(0);
}

const root = path.resolve(__dirname, '..');
let names;
try {
  names = execSync('git diff --cached --name-only --diff-filter=ACM', {
    encoding: 'utf8',
    cwd: root,
  });
} catch {
  process.exit(0);
}

const lines = names.split(/\r?\n/).filter(Boolean);
const skip = (f) =>
  f.startsWith('apps/api/obj/') ||
  f.startsWith('apps/api/bin/') ||
  f.startsWith('apps/api/publish/');

const touchesApi = lines.some((f) => f.startsWith('apps/api/') && !skip(f));

if (!touchesApi) {
  process.exit(0);
}

console.log('[pre-commit] apps/api changed — running npm run zip…');
execSync('npm run zip', { stdio: 'inherit', cwd: root });
