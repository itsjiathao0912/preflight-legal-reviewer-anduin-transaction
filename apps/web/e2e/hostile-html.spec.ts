import { expect, test } from '@playwright/test';
import { gotoApp, openDialog } from './fixtures/app';

const HOSTILE = `<html><head><script>window.__pwned = 'script';</script>
<link rel="stylesheet" href="https://evil.example/x.css"></head>
<body onload="window.__pwned='onload'">
<p>Section 1. Hostile paragraph with <b>markup</b> &lt;not a tag&gt;.</p>
<img src="https://evil.example/pixel.png">
<img src="x" onerror="window.__pwned='onerror'">
<iframe src="https://evil.example/frame"></iframe>
<p>&lt;script&gt;alert(1)&lt;/script&gt; shown as text.</p>
<a href="javascript:window.__pwned='href'">click</a>
</body></html>`;

test.describe('hostile-html', () => {
  test('should render hostile html as inert text', async ({ page, baseURL }) => {
    const host = new URL(baseURL!).host;
    const foreign: string[] = [];
    await page.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.host !== host && u.protocol.startsWith('http')) {
        foreign.push(u.href);
        return route.abort();
      }
      return route.continue();
    });
    await gotoApp(page);
    await openDialog(page);
    await page
      .getByTestId('upload-input')
      .setInputFiles({ name: 'hostile.html', mimeType: 'text/html', buffer: Buffer.from(HOSTILE) });
    await page.getByTestId('firm-combobox').fill('Other / no firm');
    await page.getByTestId('fund-input').fill('Hostile Fund');
    await page.getByTestId('privacy-ack').check();
    await page.getByTestId('open-submit').click();
    await expect(page.getByTestId('stage-status-button')).toContainText('Checks done');
    const pane = page.getByTestId('doc-pane');
    await expect(pane).toContainText('Hostile paragraph with markup <not a tag>.');
    await expect(pane).toContainText('<script>alert(1)</script> shown as text.');
    await expect(pane.locator('script, img, iframe, link, a[href^="javascript"], b')).toHaveCount(
      0,
    );
    await page.waitForTimeout(500);
    expect(
      await page.evaluate(() => (window as unknown as { __pwned?: string }).__pwned),
    ).toBeUndefined();
    expect(foreign.filter((u) => !/fonts\./.test(u))).toEqual([]);
    expect(foreign).toEqual([]);
  });
});
