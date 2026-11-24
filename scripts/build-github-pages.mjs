import { copyFile, mkdir } from 'node:fs/promises';

const source = new URL('../index.html', import.meta.url);
const output = new URL('../dist/github-pages/', import.meta.url);
await mkdir(new URL('login/', output), { recursive: true });
await Promise.all(['index.html', 'login.html', 'login/index.html'].map(path => copyFile(source, new URL(path, output))));
