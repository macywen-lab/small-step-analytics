import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

let browser;
let phase = 'launch Chrome';
const failureCodes = new Map([
  ['launch Chrome', 40],
  ['open the GitHub Pages URL', 41],
  ['find the embedded site at the Pages URL', 42],
  ['open the write form inside the embedded site', 43],
  ['verify the submission API from inside the embedded site', 44],
  ['open admin sign-in in a separate tab', 45],
]);
const navigation = [];
try {
  const { chromium } = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON)('playwright');
  const entry = new URL(process.env.PAGE_URL);
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  phase = 'open the GitHub Pages URL';
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(15_000);
  page.on('response', response => {
    const url = new URL(response.url());
    if (response.request().isNavigationRequest() || url.pathname.startsWith('/api/')) {
      navigation.push(`${response.status()} ${url.origin}${url.pathname}`);
    }
  });
  page.on('requestfailed', request => {
    if (request.isNavigationRequest()) {
      const url = new URL(request.url());
      navigation.push(`${request.failure()?.errorText} ${url.origin}${url.pathname}`);
    }
  });
  // A fresh query avoids the cached HTML of the preceding Pages deployment.
  const checkedUrl = new URL(entry);
  checkedUrl.searchParams.set('check', randomUUID());
  await page.goto(checkedUrl.href, { waitUntil: 'domcontentloaded' });

  phase = 'find the embedded site at the Pages URL';
  const app = page.locator('iframe[data-public-app]');
  const appOrigin = new URL(await app.getAttribute('src')).origin;
  assert.notEqual(appOrigin, entry.origin);
  assert.equal(page.url(), checkedUrl.href);
  const embedded = app.contentFrame();
  phase = 'open the write form inside the embedded site';
  await embedded.locator('#mainNav [data-view="write"]').click();
  const button = embedded.locator('#noteSubmit');
  await button.waitFor();
  const unknownName = `__pages-check-${randomUUID()}__`;
  for (const field of ['noteSender', 'noteHelper', 'noteBeneficiary']) {
    const input = embedded.locator('#' + field);
    await input.fill(unknownName);
    assert.equal(await input.inputValue(), unknownName);
  }
  const note = embedded.locator('#noteContent');
  await note.fill('公開入口驗證');
  assert.equal(await note.inputValue(), '公開入口驗證');
  assert.equal(page.url(), checkedUrl.href);

  // Exercise the API from the iframe with empty names so the production bucket is never modified.
  phase = 'verify the submission API from inside the embedded site';
  const response = await button.evaluate(async (_, id) => {
    const result = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-small-step-write': '1' },
      body: JSON.stringify({ id, sender: '', helper: '', beneficiary: '', content: '' }),
      signal: AbortSignal.timeout(10_000),
    });
    return { status: result.status, data: await result.json() };
  }, randomUUID());
  assert.equal(response.status, 422);
  assert(response.data.invalidFields.some(field => field.field === 'sender'));
  assert.equal(page.url(), checkedUrl.href);

  phase = 'open admin sign-in in a separate tab';
  const adminLink = page.locator('footer a');
  const [adminPage] = await Promise.all([page.context().waitForEvent('page'), adminLink.click()]);
  await adminPage.locator('#adminLoginForm').waitFor({ state: 'attached' });
  assert.equal(adminPage.url(), appOrigin + '/admin.html');
  assert.equal(page.url(), checkedUrl.href);
  console.log('The form kept the GitHub Pages address, and admin sign-in opened in its own tab.');
} catch (error) {
  const details = `Could not ${phase}. ${error.name}. ${navigation.join(' | ')}`;
  console.error(details, error);
  process.exitCode = failureCodes.get(phase);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Pages browser check\n\n${details}\n`);
  }
} finally {
  await browser?.close();
}
