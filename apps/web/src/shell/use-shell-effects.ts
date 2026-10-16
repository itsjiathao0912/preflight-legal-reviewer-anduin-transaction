import { useEffect } from 'react';
import { isRoute, RAIL_QUERY, useShell } from '../state/shell';

/**
 * Shell side effects: auto-rail below 1200 px (matchMedia) and hash routing.
 * The route is never persisted: on load the app always lands on #findings.
 */
export function useShellEffects() {
  const setNarrow = useShell((s) => s.setNarrow);
  const setRoute = useShell((s) => s.setRoute);
  const route = useShell((s) => s.route);

  useEffect(() => {
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia(RAIL_QUERY) : null;
    if (!mq) return;
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [setNarrow]);

  useEffect(() => {
    try {
      if (location.hash !== '#findings') history.replaceState(null, '', '#findings');
    } catch {
      /* ignore */
    }
    const onHash = () => {
      const h = location.hash.slice(1);
      if (isRoute(h)) setRoute(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [setRoute]);

  useEffect(() => {
    try {
      if (location.hash !== `#${route}`) location.hash = `#${route}`;
    } catch {
      /* ignore */
    }
  }, [route]);
}
