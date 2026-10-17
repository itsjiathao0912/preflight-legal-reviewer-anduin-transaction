import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../../src/live/common';
import { DEFAULT_VIEWS, mustBlock, outDir, parseViews } from '../../src/screenshots/shots-live';

const LIVE = 'https://aduin-transaction-web.giathaowork.workers.dev';

describe('shots:live', () => {
  it('is read-only: blocks every non-GET /api call plus AI, OCR and session', () => {
    expect(mustBlock('POST', `${LIVE}/api/runs`, LIVE)).toBe(true);
    expect(mustBlock('POST', `${LIVE}/api/ai`, LIVE)).toBe(true);
    expect(mustBlock('GET', `${LIVE}/api/session`, LIVE)).toBe(true);
    expect(mustBlock('GET', `${LIVE}/api/quota`, LIVE)).toBe(false);
    expect(mustBlock('GET', `${LIVE}/assets/app.js`, LIVE)).toBe(false);
  });
  it('validates views and keeps output under docs/demo', () => {
    expect(parseViews(undefined)).toEqual([...DEFAULT_VIEWS]);
    expect(parseViews('findings, memory')).toEqual(['findings', 'memory']);
    expect(() => parseViews('../x')).toThrow();
    expect(outDir(undefined)).toBe(join(ROOT, 'docs', 'demo', 'img'));
    expect(() => outDir(join(ROOT, 'docs', 'demo-x'))).toThrow();
    expect(() => outDir('/tmp/shots')).toThrow();
  });
});
