import { expect, type Page } from '@playwright/test';
import { row, rowsLoc } from './app';

/**
 * Findings v2 action helpers (Phase B). One sticky bar acts on the open row:
 * - Ask counsel on a blocking row records an accept (status `accepted`, it still needs counsel's
 *   answer); on any other row it records Needs counsel (status `counsel`).
 * - Close issue opens the reason modal; "Real issue" (non-blocking error rows only) accepts.
 * Helpers choose by the row's `data-severity` (E-B5) and always open the row first.
 */

/** Open a row (re-clicking an open row keeps it open). */
async function open(page: Page, id: string): Promise<void> {
  await row(page, id).click();
  await expect(row(page, id)).toHaveAttribute('aria-expanded', 'true');
}

async function isBlocking(page: Page, id: string): Promise<boolean> {
  return (await row(page, id).getAttribute('data-severity')) === 'block';
}

/** Open the first listed finding (optionally the first with a given severity) and return its id. */
export async function openFirstFinding(
  page: Page,
  severity?: 'block' | 'fix' | 'note',
): Promise<string> {
  const loc = severity
    ? page.locator(`[data-testid="finding-row"][data-severity="${severity}"]`)
    : rowsLoc(page);
  const id = (await loc.first().getAttribute('data-finding-id'))!;
  await open(page, id);
  return id;
}

/** Ask counsel on a row; returns the status it lands in (`accepted` for blocking, else `counsel`). */
export async function askCounsel(page: Page, id: string): Promise<'accepted' | 'counsel'> {
  await open(page, id);
  const status = (await isBlocking(page, id)) ? 'accepted' : 'counsel';
  await page.getByTestId('action-counsel').click();
  await expect(row(page, id)).toHaveAttribute('data-status', status);
  return status;
}

/** Close a non-blocking error row as a real issue (accept without a counsel question). */
export async function closeAsRealIssue(page: Page, id: string): Promise<void> {
  await open(page, id);
  expect(await isBlocking(page, id), 'Real issue is hidden on blocking rows').toBe(false);
  await page.getByTestId('action-dismiss').click();
  await page.locator('[data-testid="dismiss-reason"][data-reason="real_issue"]').check();
  await page.getByTestId('dismiss-save').click();
  await expect(page.getByTestId('dismiss-modal')).toBeHidden();
  await expect(row(page, id)).toHaveAttribute('data-status', 'accepted');
}

/** Close a row with a dismiss reason (optional note); the modal must close. */
export async function closeWithReason(
  page: Page,
  id: string,
  code = 'tool_false_alarm',
  note?: string,
): Promise<void> {
  await open(page, id);
  await page.getByTestId('action-dismiss').click();
  await page.locator(`[data-testid="dismiss-reason"][data-reason="${code}"]`).check();
  if (note !== undefined) await page.getByTestId('dismiss-note').fill(note);
  await page.getByTestId('dismiss-save').click();
  await expect(page.getByTestId('dismiss-modal')).toBeHidden();
}

/** Move a sent or closed row back to review (the row must be listed under the current filter). */
export async function moveBack(page: Page, id: string): Promise<void> {
  await open(page, id);
  await page.getByTestId('action-restore').click();
}

/** Mark a row `accepted`: Ask counsel on blocking rows, Close issue then Real issue otherwise. */
export async function acceptRow(page: Page, id: string): Promise<void> {
  if (await isBlocking(page, id)) await askCounsel(page, id);
  else await closeAsRealIssue(page, id);
}
