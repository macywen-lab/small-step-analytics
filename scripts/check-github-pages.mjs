import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const entry = new URL(process.env.PAGE_URL);
entry.searchParams.set('check', randomUUID());
const response = await fetch(entry, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
assert.equal(response.status, 200);
assert.equal(response.url, entry.href);
const html = await response.text();
assert.match(html, /<main id="source-only">/);
assert.doesNotMatch(html, /<iframe\b|chatgpt\.site|<script\b/i);
console.log('GitHub Pages serves the source-only page at its original address.');
