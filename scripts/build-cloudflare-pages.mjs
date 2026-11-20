import { copyFile, mkdir } from 'node:fs/promises';

const output = new URL('../dist/cloudflare-pages/', import.meta.url);
await mkdir(output, { recursive: true });
await copyFile(new URL('../dist/server/index.js', import.meta.url), new URL('_worker.js', output));
