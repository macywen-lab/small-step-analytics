import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const { chromium } = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON)('playwright');
const entry = new URL(process.env.PAGE_URL);
const browser = await chromium.launch({
  channel: 'chrome',
  ...(process.env.CHROMIUM_PATH && { channel: undefined, executablePath: process.env.CHROMIUM_PATH }),
});

let phase = 'open the GitHub Pages URL';
const navigation = [];
try {
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
    await embedded.locator('#' + field).fill(unknownName);
  }
  await embedded.locator('#noteContent').fill('公開入口驗證');

  // An invalid name exercises the real form and API without writing a note.
  phase = 'submit the form and verify the validation dialog';
  const responsePromise = page.waitForResponse(response =>
    response.url() === appOrigin + '/api/notes' && response.request().method() === 'POST');
  await button.click();
  const response = await responsePromise;
  assert.equal(response.status(), 422);
  assert((await response.json()).invalidFields.some(field => field.field === 'sender'));
  await embedded.locator('#noteNameDialog').waitFor({ state: 'visible' });
  assert.equal(page.url(), checkedUrl.href);

  phase = 'open admin sign-in in a separate tab';
  const adminLink = page.locator('footer a');
  const popupPromise = page.waitForEvent('popup');
  await adminLink.click();
  const adminPage = await popupPromise;
  await adminPage.locator('#adminLoginForm').waitFor({ state: 'attached' });
  assert.equal(adminPage.url(), appOrigin + '/admin.html');
  assert.equal(page.url(), checkedUrl.href);
  console.log('The form kept the GitHub Pages address, and admin sign-in opened in its own tab.');
} catch (error) {
  const details = `Could not ${phase}. ${error.name}. ${navigation.join(' | ')}`;
  const reports = [];
  if (process.env.GITHUB_OUTPUT) reports.push(appendFile(process.env.GITHUB_OUTPUT, `diagnosis=${details}\n`));
  if (process.env.GITHUB_STEP_SUMMARY) {
    reports.push(appendFile(process.env.GITHUB_STEP_SUMMARY, `### Pages browser check\n\n${details}\n`));
  }
  await Promise.all(reports);
  throw error;
} finally {
  await browser.close();
}
