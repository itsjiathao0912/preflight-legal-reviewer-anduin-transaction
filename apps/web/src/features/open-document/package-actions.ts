import { usePackage, type PackageMemberInput, type PrepareResult } from '../../state/package';
import { useShell } from '../../state/shell';
import type { PackageTag } from '../package/contract';
import { loadDemoPackages, type DemoPackage } from './demo-packages';
import { rememberDemoPackage } from './demo-refs';
import { loadFirms, loadManifest, scanPagesOf } from './samples';

/** Intake Phase 2: package entry points used by the Upload modal. */

/** Uploaded files -> draft (limits are checked again in the store; nothing is stored here). */
export async function prepareUploadDraft(
  files: readonly File[],
  tag: PackageTag,
): Promise<PrepareResult> {
  const members: PackageMemberInput[] = [];
  for (const f of files)
    members.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
  return usePackage.getState().prepareDraft(members, tag);
}

/** Member bytes of one demo package (bundled files, `sample:NN`, `scan:NN` with precomputed OCR). */
export async function demoMembers(p: DemoPackage): Promise<PackageMemberInput[]> {
  const manifest = await loadManifest();
  const out: PackageMemberInput[] = [];
  for (const m of p.members) {
    if (m.kind === 'file') {
      const res = await fetch(m.url);
      if (!res.ok) continue;
      out.push({ name: m.name, bytes: new Uint8Array(await res.arrayBuffer()), sampleRef: m.url });
      continue;
    }
    const entry = manifest.find((s) => s.id === m.sampleId);
    if (!entry) continue;
    if (m.kind === 'scan') {
      const pages = scanPagesOf(entry);
      if (!pages.length) continue;
      out.push({
        name: entry.title,
        sampleRef: `scan:${entry.id}`,
        sampleId: entry.id,
        scan: {
          pages: pages.map((pg) => ({
            n: pg.n,
            url: `/samples/${pg.file}`,
            sourceHash: pg.sourceHash,
          })),
        },
      });
      continue;
    }
    if (!entry.file) continue;
    const res = await fetch(`/samples/${entry.file}`);
    if (!res.ok) continue;
    out.push({
      name: entry.file,
      bytes: new Uint8Array(await res.arrayBuffer()),
      sampleRef: entry.file,
      sampleId: entry.id,
    });
  }
  return out;
}

/** Open a demo package through the same prepareDraft path; auto-runs when the draft is ready. */
export async function openDemoPackage(id: string): Promise<PrepareResult> {
  const p = (await loadDemoPackages()).find((x) => x.id === id);
  if (!p) return { ok: false, message: 'This demo package is not available.' };
  const firms = await loadFirms();
  const firmName = p.firmId ? (firms.find((f) => f.id === p.firmId)?.name ?? p.firmId) : '';
  const members = await demoMembers(p);
  if (!members.length) return { ok: false, message: 'This demo package is not available.' };
  return usePackage
    .getState()
    .prepareDraft(
      members,
      { firmId: p.firmId, firmName, fund: p.fund, version: p.version },
      { demoId: p.id },
    );
}

/** Run the confirmed draft (findings screen opens; findings render before package analysis). */
export async function runPackageDraft(): Promise<void> {
  if (!usePackage.getState().draftReadiness().ok) return;
  const demoId = usePackage.getState().draft?.demoId;
  useShell.getState().setRoute('findings');
  await usePackage.getState().runDraft();
  // counsel share link: a demo package run keeps its bundled ref (Share works for it)
  const current = usePackage.getState().current;
  if (demoId && current) rememberDemoPackage(current.id, demoId);
}

/** Restore a stored package (24 h) and re-open its primary. */
export async function restorePackage(id: string): Promise<boolean> {
  useShell.getState().setRoute('findings');
  return usePackage.getState().restore(id);
}
