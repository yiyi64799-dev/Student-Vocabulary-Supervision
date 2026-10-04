import { build } from 'esbuild';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const cloudRoot = join(root, 'cloudfunctions');
const entries = (await readdir(cloudRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => ({
    name: entry.name,
    input: join(cloudRoot, entry.name, 'src', 'index.ts'),
    output: join(cloudRoot, entry.name, 'index.js'),
  }));

for (const entry of entries) {
  await build({
    entryPoints: [entry.input],
    outfile: entry.output,
    bundle: true,
    platform: 'node',
    target: 'node16',
    format: 'cjs',
    external: ['wx-server-sdk'],
    sourcemap: false,
    minify: false,
  });
  console.log(`built cloudfunctions/${entry.name}/index.js`);
}
