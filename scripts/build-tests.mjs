import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('.test-dist', { recursive: true });
await build({ entryPoints: ['shared/core/index.ts'], outfile: '.test-dist/core.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node18' });
await build({ entryPoints: ['shared/validators/index.ts'], outfile: '.test-dist/validators.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node18' });
