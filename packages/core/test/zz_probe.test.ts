import { it } from 'vitest';
import { htmlToLines } from '../src/adapters/html';
it('probe', { timeout: 300000 }, () => {
  for (const [name, mk] of Object.entries({
    bnest: (n: number) => '<b>a'.repeat(n),
    divnest: (n: number) => '<div>a'.repeat(n),
    unmatchedClose: (n: number) => '<b>'.repeat(n/2) + '</x>'.repeat(n/2),
  })) {
    for (const n of [20000, 40000, 80000]) {
      const t0 = performance.now();
      htmlToLines(mk(n));
      console.log(name, n, (performance.now() - t0).toFixed(0), 'ms');
    }
  }
});
