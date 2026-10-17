import { expect, type Page } from '@playwright/test';

/** Shared Playwright helpers for the Phase 03 preview specs (stub memory API, e2e build). */
export const sample = (page: Page, id: string) =>
  page.locator(`[data-testid="sample-option"][data-sample-id="${id}"]`);
export const rowsLoc = (page: Page) => page.getByTestId('finding-row');
export const row = (page: Page, id: string) =>
  page.locator(`[data-testid="finding-row"][data-finding-id="${id}"]`);

export async function openDialog(page: Page) {
  await page.getByTestId('doc-switcher').click();
  await page.getByTestId('open-another').click();
  await expect(page.getByTestId('open-document-dialog')).toBeVisible();
}

/** Open a bundled sample through the Open a document dialog and wait for the checks stage. */
export async function openSample(page: Page, id: string) {
  await openDialog(page);
  await sample(page, id).click();
  await expect(page.getByTestId('stage-status-button')).toContainText(/Checks done|failed/, {
    timeout: 30_000,
  });
  await expect(page.getByTestId('loading-state')).toHaveCount(0);
  await memorySettled(page);
}

/**
 * Findings render before memory (Phase 10 EVL fix): wait until the background memory lookup has
 * settled (labels applied or "Memory unavailable") before asserting on memory labels or sessions.
 */
export async function memorySettled(page: Page) {
  await expect(page.getByTestId('findings-column')).not.toHaveAttribute(
    'data-memory-state',
    'pending',
    { timeout: 30_000 },
  );
}

/** Document zoom storage key (`zoom-math.ts` DOCZOOM_KEY). */
export const DOCZOOM_KEY = 'ui:v1:doczoom';

/**
 * Open the app. The document zoom defaults to manual 100% for specs (stable geometry): the seed is
 * written only when the key is absent, so a reload keeps whatever zoom the test set. `zoom: 'fit'`
 * skips the seed (app default, fit width); a number seeds that manual percent.
 */
export async function gotoApp(page: Page, opts: { zoom?: 'fit' | number } = {}) {
  const zoom = opts.zoom ?? 100;
  if (zoom !== 'fit') {
    await page.addInitScript(
      ([key, value]) => {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
      },
      [DOCZOOM_KEY, JSON.stringify({ mode: 'manual', pct: zoom })] as const,
    );
  }
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await page.waitForFunction(() => '__aduinE2E' in window);
}

/** Rewrite every finding's severity before display (seeded gate scenarios). */
export async function forceSeverity(
  page: Page,
  severity: 'critical' | 'high' | 'medium',
  onlyIndex?: number,
) {
  await page.evaluate(
    ([sev, idx]) => {
      const h = (window as unknown as { __aduinE2E: { transform: (fn: unknown) => void } })
        .__aduinE2E;
      h.transform((fs: { severity: string }[]) =>
        fs.map((f, i) => (idx === null || i === idx ? { ...f, severity: sev } : f)),
      );
    },
    [severity, onlyIndex ?? null] as const,
  );
}

export async function clearTransform(page: Page) {
  await page.evaluate(() =>
    (
      window as unknown as { __aduinE2E: { transform: (fn: unknown) => void } }
    ).__aduinE2E.transform(null),
  );
}

export async function chooseReasonAndSave(page: Page, code = 'tool_false_alarm') {
  await page.locator(`[data-testid="dismiss-reason"][value="${code}"]`).check();
  await page.getByTestId('dismiss-save').click();
  await expect(page.getByTestId('dismiss-modal')).toBeHidden();
}

export async function sidebarWidth(page: Page): Promise<number> {
  return (await page.getByTestId('sidebar').boundingBox())!.width;
}
