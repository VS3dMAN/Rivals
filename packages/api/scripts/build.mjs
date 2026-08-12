// Production bundle for the API.
//
// The API's tsconfig uses moduleResolution "Bundler", so tsc alone emits
// extensionless imports that Node's ESM loader cannot resolve. The @rivals/*
// workspace packages also ship raw TypeScript via their exports map. Bundling
// solves both: workspace code is inlined, node_modules stay external.
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const runtimeDeps = Object.keys(pkg.dependencies ?? {}).filter((d) => !d.startsWith('@rivals/'));
// Subpath imports (e.g. drizzle-orm/postgres-js) need their own external entry.
const external = [...runtimeDeps, ...runtimeDeps.map((d) => `${d}/*`)];

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  external,
  logLevel: 'info',
});
