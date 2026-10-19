import { useAiLaneEffects } from '../features/ai/ai-lane';
import { CounselJoinDialog } from '../features/counsel/CounselJoinDialog';
import { useCounselEffects, useShare } from '../features/counsel/counsel-share';
import { featureFor } from '../features/registry';
import { OpenDocumentDialog } from '../features/open-document/OpenDocumentDialog';
import { PrivacyPrompt } from '../features/open-document/PrivacyPrompt';
import { UndoToast } from '../features/review/components/UndoToast';
import { IconSprite } from '../icons/sprite';
import { isRail, useShell } from '../state/shell';
import { Sidebar } from './Sidebar';
import { useShellEffects } from './use-shell-effects';

export function AppShell() {
  useShellEffects();
  useAiLaneEffects();
  const rail = useShell(isRail);
  useCounselEffects();
  const counselMode = useShare((s) => s.role === 'counsel');
  const shellRoute = useShell((s) => s.route);
  // counsel share link: counsel mode has the Findings screen only
  const route = counselMode ? 'findings' : shellRoute;
  const View = featureFor(route)?.component ?? featureFor('findings')!.component;
  return (
    <>
      <IconSprite />
      <a
        className="skip"
        href="#stage"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById(`h-${route}`)?.focus();
        }}
      >
        Skip to content
      </a>
      <div className={rail ? 'app rail' : 'app'} id="app" data-testid="app-shell">
        <Sidebar />
        <main className="stagearea" id="stage">
          <View key={route} />
        </main>
      </div>
      {counselMode ? null : (
        <>
          <OpenDocumentDialog />
          <PrivacyPrompt />
        </>
      )}
      <CounselJoinDialog />
      <UndoToast />
    </>
  );
}
