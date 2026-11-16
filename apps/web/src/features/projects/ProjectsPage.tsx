import { useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { IconSprite } from '../../icons/sprite';
import { needsMyAction, useProjects } from '../../state/projects';
import { CreateProjectDialog } from './CreateProjectDialog';
import { ProjectRow } from './ProjectRow';
import { ViewAsSwitch } from './ViewAsSwitch';
import { NotificationBell } from '../notifications/NotificationBell';

type Tab = 'mine' | 'all';

/** Projects landing page: list with filter tabs and the New project dialog. */
export function ProjectsPage({ onOpen }: { onOpen: (id: string) => void }) {
  const projects = useProjects((s) => s.projects);
  const loaded = useProjects((s) => s.loaded);
  const viewAs = useProjects((s) => s.viewAs);
  const [tab, setTab] = useState<Tab>('all');
  const [creating, setCreating] = useState(false);
  const mine = projects.filter((p) => needsMyAction(p, viewAs));
  const list = tab === 'mine' ? mine : projects;
  return (
    <>
      <IconSprite />
      <div className="pj-page" id="app" data-testid="projects-page">
        <header className="pj-head">
          <div className="brand">
            <svg className="i brand-logo" aria-hidden="true">
              <use href="#logo" />
            </svg>
            <span>Preflight</span>
          </div>
          <div className="pj-head-tools">
            <NotificationBell />
            <ViewAsSwitch />
          </div>
        </header>
        <main className="pj-main-area">
          <div className="pj-titlebar">
            <h1 id="h-projects" tabIndex={-1}>
              Projects
            </h1>
            <button
              type="button"
              className="btn pri"
              data-testid="new-project"
              onClick={() => setCreating(true)}
            >
              <Icon name="plus" />
              New project
            </button>
          </div>
          <div className="pj-tabs" role="tablist" aria-label="Filter projects">
            {(
              [
                ['mine', `Needs my action · ${mine.length}`],
                ['all', `All projects · ${projects.length}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                data-testid={`projects-tab-${id}`}
                className="pj-tab"
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {loaded && !list.length ? (
            <p className="pj-empty" data-testid="projects-empty">
              {tab === 'mine'
                ? 'Nothing needs your action.'
                : 'No projects yet. Create one to start.'}
            </p>
          ) : (
            <ul className="pj-list" aria-label="Projects" data-testid="projects-list">
              {list.map((p) => (
                <ProjectRow key={p.id} project={p} onOpen={onOpen} />
              ))}
            </ul>
          )}
        </main>
      </div>
      <CreateProjectDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
