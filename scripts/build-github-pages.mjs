import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const template = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const defaultUrl = template.match(/<link rel="canonical" href="([^"]+)">/)[1];
const target = new URL(process.env.PUBLIC_APP_URL || defaultUrl);
if (target.protocol !== 'https:' || target.username || target.password || target.href !== target.origin + '/' || target.hostname.endsWith('.github.io')) {
  throw new Error('PUBLIC_APP_URL must be the HTTPS root URL of the live Worker or Cloudflare Pages site.');
}

async function request(path, status, options) {
  const response = await fetch(new URL(path, target), {
    ...options,
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status !== status) throw new Error(`${path} returned HTTP ${response.status}; expected ${status}.`);
  return response;
}

const home = await request('/', 200);
if (!home.headers.get('content-type')?.startsWith('text/html') || !(await home.text()).includes('id="noteForm"')) {
  throw new Error('The public homepage did not return the convenience-note form.');
}
const dataset = await (await request('/api/dataset', 200)).json();
if (dataset.schemaVersion !== 1 || !Array.isArray(dataset.data) || !Array.isArray(dataset.roster)) {
  throw new Error('The public dataset did not return the expected format.');
}

// A valid request with empty names reaches form validation without creating a live note.
const validation = await (await request('/api/notes', 422, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-small-step-write': '1', origin: target.origin },
  body: JSON.stringify({ id: randomUUID(), sender: '', helper: '', beneficiary: '', content: '' }),
})).json();
if (!validation.invalidFields?.some(field => field.field === 'sender')) {
  throw new Error('The public submission API did not return the expected field validation.');
}

const output = new URL('../dist/github-pages/', import.meta.url);
const link = target.href.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const html = template.replaceAll(defaultUrl, () => link);
await mkdir(new URL('login/', output), { recursive: true });
await Promise.all(['index.html', 'login.html', 'login/index.html'].map(path => writeFile(new URL(path, output), html)));
