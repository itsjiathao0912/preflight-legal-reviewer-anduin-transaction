import { IS_E2E } from '../../e2e-flag';
import { isCounselMode } from '../../state/share-role';
import { useShare } from '../counsel/counsel-share';

export const WELCOME_SEEN_KEY = 'preflight.welcomeSeen';

// captured at module load (before main.tsx cleans `#counsel=` and the shell rewrites the hash)
const initialHash = typeof location === 'undefined' ? '' : location.hash;
const initialSearch = typeof location === 'undefined' ? '' : location.search;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function welcomeSeen(): boolean {
  try {
    return storage()?.getItem(WELCOME_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberWelcomeSeen(): void {
  try {
    storage()?.setItem(WELCOME_SEEN_KEY, '1');
  } catch {
    // storage blocked: the welcome shows again next visit, harmless
  }
}

/** Plain app entry only: no hash deep link other than the default Findings route. */
function isPlainEntry(hash: string): boolean {
  return hash === '' || hash === '#' || hash === '#findings';
}

export function shouldShowWelcome(
  hash: string = initialHash,
  search: string = initialSearch,
): boolean {
  if (IS_E2E) return false;
  if (isCounselMode()) return false;
  const share = useShare.getState();
  if (share.pendingToken || share.docRef) return false;
  if (/^#counsel=/.test(hash)) return false;
  if (new URLSearchParams(search).get('welcome') === '1') return true;
  if (!isPlainEntry(hash)) return false;
  return !welcomeSeen();
}
