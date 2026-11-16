import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setProjectsDbForTest, useProjects } from '../../state/projects';
import * as h from '../review/v2/test-helpers';
import { ProjectsPage } from './ProjectsPage';
import { buildSeedProjects } from './seed';
import { ProjectContext, projectInitials } from './ProjectContext';
import { useShell } from '../../state/shell';

const q = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const qa = (id: string) => [
  ...document.body.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`),
];
let mounted: { unmount(): void } | null = null;
const SEEDS = buildSeedProjects(
  ['northgate-iii', 'lotus-bay-asia-ii', 'redwood-ridge-i'].map((id) => ({
    id,
    title: id,
    firmId: null,
    fund: 'F',
    version: 'v1',
    members: [{ kind: 'sample' as const, sampleId: '01' }],
  })),
);

beforeEach(() => {
  h.installDomStubs();
  document.body.replaceChildren();
  setProjectsDbForTest(null);
  useProjects.setState({ projects: SEEDS, loaded: true, viewAs: 'approver', view: 'projects' });
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  setProjectsDbForTest(undefined);
});

function setInput(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ProjectsPage', () => {
  it('should list rows with name, description, gate, open items, activity and members', () => {
    mounted = h.renderV2(<ProjectsPage onOpen={() => undefined} />);
    const rows = qa('project-row');
    expect(rows).toHaveLength(3);
    const first = rows.find((r) => r.dataset.projectId === 'seed-northgate-iii')!;
    expect(first.querySelector('[data-testid="project-name"]')?.textContent).toBe(
      'Northgate Capital Fund III',
    );
    expect(first.querySelector('[data-testid="project-description"]')?.textContent).toMatch(
      /third/,
    );
    expect(first.querySelector('[data-testid="project-gate"]')?.textContent).toContain('Blocked');
    expect(first.querySelector('[data-testid="project-open-items"]')?.textContent).toBe('7 open');
    expect(first.querySelector('[data-testid="project-activity"]')?.textContent).toMatch(/ago/);
    expect(first.querySelectorAll('.pj-av')).toHaveLength(3);
    // emails are never rendered in the list
    expect(document.body.textContent).not.toContain('@example.com');
  });

  it('should filter on "Needs my action" for the current role', () => {
    mounted = h.renderV2(<ProjectsPage onOpen={() => undefined} />);
    act(() => q('projects-tab-mine')!.click());
    expect(qa('project-row').map((r) => r.dataset.projectId)).toEqual(['seed-lotus-bay-asia-ii']);
  });

  it('should open a project by id without putting anything in the URL', () => {
    const opened: string[] = [];
    const before = location.href;
    mounted = h.renderV2(<ProjectsPage onOpen={(id) => opened.push(id)} />);
    act(() => (qa('project-row')[0]!.querySelector('button') as HTMLButtonElement).click());
    expect(opened).toHaveLength(1);
    expect(location.href).toBe(before);
  });

  it('should validate and create a project from the dialog', async () => {
    mounted = h.renderV2(<ProjectsPage onOpen={() => undefined} />);
    act(() => q('new-project')!.click());
    expect(q('create-project-dialog')).not.toBeNull();
    await act(async () => q('create-project-submit')!.click());
    expect(q('create-project-error')?.textContent).toBe('Enter a project name.');
    act(() => {
      setInput(q('project-name-input') as HTMLInputElement, 'Fund IV');
      setInput(q('project-description-input') as HTMLTextAreaElement, 'New fund');
      setInput(q('member-name') as HTMLInputElement, 'Ann Lee');
      setInput(q('member-email') as HTMLInputElement, 'ann@example.com');
    });
    await act(async () => q('create-project-submit')!.click());
    expect(q('create-project-dialog')).toBeNull();
    const names = qa('project-name').map((e) => e.textContent);
    expect(names).toContain('Fund IV');
    expect(location.href).not.toContain('ann@example.com');
  });
});

describe('ProjectContext in the icon rail', () => {
  it('should keep back-to-projects, the project badge and View as reachable', () => {
    useShell.setState({ collapsed: true });
    useProjects.setState({ activeProjectId: 'seed-northgate-iii', view: 'project' });
    mounted = h.renderV2(<ProjectContext />);
    const back = q('back-to-projects')!;
    expect(back.getAttribute('aria-label')).toBe('All projects');
    const badge = q('project-context-name')!;
    expect(badge.getAttribute('title')).toBe('Northgate Capital Fund III');
    expect(badge.textContent).toBe('NC');
    const sel = q('view-as') as HTMLSelectElement;
    expect(sel.labels?.[0]?.textContent).toMatch(/^View as/);
    act(() => {
      sel.value = 'counsel';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(useProjects.getState().viewAs).toBe('counsel');
    act(() => back.click());
    expect(useProjects.getState().view).toBe('projects');
    useShell.setState({ collapsed: false });
  });

  it('should build up to two initials', () => {
    expect(projectInitials('Fund IV review')).toBe('FI');
    expect(projectInitials('  ')).toBe('?');
  });
});

describe('CreateProjectDialog labels', () => {
  it('should give the name and description fields an accessible name', () => {
    mounted = h.renderV2(<ProjectsPage onOpen={() => undefined} />);
    act(() => q('new-project')!.click());
    for (const [tid, text] of [
      ['project-name-input', 'Name'],
      ['project-description-input', 'Description (optional)'],
    ] as const) {
      const el = q(tid)!;
      const lbl = document.getElementById(el.getAttribute('aria-labelledby')!);
      expect(lbl?.textContent).toBe(text);
      expect((el as HTMLInputElement).labels?.[0]?.textContent).toContain(text);
    }
  });
});
