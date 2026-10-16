import { useEffect } from 'react';
import { AppShell } from './shell/AppShell';
import { appDb, purgeExpired } from './storage/db';
import { useSession } from './state/session';

export function App() {
  const refreshAllowance = useSession((s) => s.refreshAllowance);
  useEffect(() => {
    const db = appDb();
    if (db) void purgeExpired(db).catch(() => undefined);
    void refreshAllowance();
  }, [refreshAllowance]);
  return <AppShell />;
}
