import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';

/** Shared Playwright helpers for the Phase 03 preview specs (stub memory API, e2e build). */
export const rowsLoc = (page: Page) => page.getByTestId('finding-row');
export const row = (page: Page, id: string) =>
  page.locator(`[data-testid="finding-row"][data-finding-id="${id}"]`);

export async function openDialog(page: Page) {
  await page.getByTestId('doc-switcher').click();
  await page.getByTestId('open-another').click();
  await expect(page.getByTestId('open-document-dialog')).toBeVisible();
}

/**
 * Open a bundled HTML sample and wait for the checks stage. The single-sample picker is gone
 * (0c3a6a2), so this uploads the same bytes through the dialog (`uploadSample`).
 */
export async function openSample(page: Page, id: string) {
  await uploadSample(page, id);
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

/** Findings panel views (the Document map screen is folded into Findings): Issues, Form flow, Sources. */
export async function openFindingsView(page: Page, view: 'issues' | 'flow' | 'sources') {
  // the request drawer is a global overlay: close it when open
  if (await page.getByTestId('request-drawer').count()) {
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('request-drawer')).toHaveCount(0);
  }
  await page.getByTestId('nav-findings').click();
  await page.getByTestId(`findings-view-${view}`).click();
  // the Issues view has no tab panel of its own (see `knownAxeIssue`): its progress header marks it
  await expect(
    page.getByTestId(view === 'issues' ? 'progress-header' : `findings-panel-${view}`),
  ).toBeVisible();
}

/**
 * The Type (All / Errors / Changes) segment and the severity chips live in the Findings filter
 * menu now; open it when it is closed (idempotent).
 */
export async function openFilterMenu(page: Page) {
  if (!(await page.getByTestId('filter-menu').isVisible()))
    await page.getByTestId('filter-button').click();
  await expect(page.getByTestId('filter-menu')).toBeVisible();
}

/**
 * Known APP defect, not a stale test (reported in the F7b hand-over note): the Findings view
 * switch's Issues tab has `aria-controls="fv-view-panel"`, but that panel only exists in the Form
 * flow and Sources views, so axe reports `aria-valid-attr-value` (critical) on `#fv-tab-issues`.
 * The a11y specs filter exactly that one finding out; remove this when the app is fixed.
 */
export const knownAxeIssue = (v: { id: string; nodes: { target: unknown[] }[] }): boolean =>
  v.id === 'aria-valid-attr-value' && v.nodes.every((n) => n.target.join(' ') === '#fv-tab-issues');

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

const PUBLIC_SAMPLES = resolve(import.meta.dirname, '..', '..', 'public', 'samples');

/** Law firm names the manifest's firm ids map to in the dialog's firm combobox. */
const SAMPLE_FIRM_NAME: Record<string, string> = {
  'partners-group': 'Partners Group',
  'hartwell-crane': 'Hartwell & Crane LLP',
};

interface SampleManifestEntry {
  id: string;
  title: string;
  file: string | null;
  firmId: string | null;
  fund: string;
  version: string;
}

function sampleEntry(id: string): SampleManifestEntry & { file: string } {
  const manifest = JSON.parse(readFileSync(resolve(PUBLIC_SAMPLES, 'manifest.json'), 'utf8')) as {
    samples: SampleManifestEntry[];
  };
  const e = manifest.samples.find((x) => x.id === id);
  if (!e?.file) throw new Error(`no HTML sample ${id} in the manifest`);
  return e as SampleManifestEntry & { file: string };
}

/**
 * The dialog's file input appends to the picked files; remove every picked file so the next
 * `setInputFiles` starts from an empty list (sequential refusal checks in one dialog).
 */
export async function clearPickedFiles(page: Page) {
  const rm = page.locator('.od-rm');
  while (await rm.count()) {
    const n = await rm.count();
    await rm.first().click();
    await expect(rm).toHaveCount(n - 1);
  }
}

/**
 * With the Open a document dialog already open: upload a bundled HTML sample and submit, without
 * waiting for the checks (specs that time or intercept the open). Tagged with the firm, fund and
 * version the old sample picker used (manifest); the file is named by the manifest title.
 */
export async function submitSample(page: Page, id: string) {
  const e = sampleEntry(id);
  await page.getByTestId('upload-input').setInputFiles({
    // the old picker named the document by its manifest title; vh-* titles have punctuation
    name: e.id.startsWith('vh-') ? e.file : `${e.title}${e.file.slice(e.file.lastIndexOf('.'))}`,
    mimeType: 'text/html',
    buffer: readFileSync(resolve(PUBLIC_SAMPLES, e.file)),
  });
  await page
    .getByTestId('firm-combobox')
    .fill(e.firmId ? (SAMPLE_FIRM_NAME[e.firmId] ?? 'Other / no firm') : 'Other / no firm');
  await page.getByTestId('fund-input').fill(e.fund);
  const version = page.getByTestId('version-input');
  if (await version.count()) await version.fill(e.version);
  await page.getByTestId('privacy-ack').check();
  await page.getByTestId('open-submit').click();
}

/**
 * Upload a bundled HTML sample (same bytes as the demo copy, so the same doc hash and precomputed
 * file) through the Open a document dialog and wait for the checks. The single-sample picker was
 * replaced by demo packages (0c3a6a2).
 */
export async function uploadSample(page: Page, id: string) {
  await openDialog(page);
  await submitSample(page, id);
  await expect(page.getByTestId('stage-status-button')).toContainText(/Checks done|failed/, {
    timeout: 30_000,
  });
  await expect(page.getByTestId('loading-state')).toHaveCount(0);
  await memorySettled(page);
}
