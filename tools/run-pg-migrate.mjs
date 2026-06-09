// @ts-check
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, '..');

// Parse .env manually — no dotenv dependency needed
const envPath = resolve(repoRoot, '.env');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => {
      const [key, ...rest] = line.split('=');
      return [key.trim(), rest.join('=').trim()];
    })
);

const databaseUrl = envVars.DIRECT_URL;
if (!databaseUrl) {
  console.error('DIRECT_URL not found in .env');
  process.exit(1);
}

const [, , command = 'up', ...passThroughArgs] = process.argv;
const migrationsDir = resolve(repoRoot, 'db', 'migrations');
const isWin = process.platform === 'win32';
const cliPath = resolve(
  repoRoot,
  'node_modules',
  '.bin',
  isWin ? 'node-pg-migrate.cmd' : 'node-pg-migrate'
);

const defaultCommandArgs = command === 'up' ? ['--create-schema', '--check-order=false'] : [];

const cliArgs = [
  command,
  '--migrations-dir', migrationsDir,
  '--schema', 'public',
  '--decamelize',
  ...defaultCommandArgs,
  ...passThroughArgs,
];

const result = spawnSync(cliPath, cliArgs, {
  stdio: 'inherit',
  shell: isWin,
  env: { ...process.env, DATABASE_URL: databaseUrl },
});

process.exit(result.status ?? 1);
