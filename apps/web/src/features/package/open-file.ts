import type { PackageDocType } from '@aduin/core';
import { useRefView } from '../../state/ref-view';
import { TYPE_LABELS } from '../open-document/PackageConfirmTable';
import type { PackageDocView, PackageView } from './contract';

/** Short label of a package document type ("LPA", "PPM", "Subscription agreement"). */
export function typeLabel(t: PackageDocType): string {
  return TYPE_LABELS[t];
}

/** "LPA (02-NG3-LPA-Definitions-and-Key-Terms.docx)". */
export function fileLabel(d: Pick<PackageDocView, 'type' | 'name'>): string {
  return `${TYPE_LABELS[d.type]} (${d.name})`;
}

/**
 * Source File: show a package file in the reading pane (read-only), scrolled to `blockIndex`.
 * The open document does not change; the bar's Back button returns to it.
 */
export function openPackageFile(view: PackageView, docId: string, blockIndex: number | null): void {
  const d = view.documents.find((x) => x.id === docId);
  if (!d || d.isPrimary) return;
  const primary = view.documents.find((x) => x.isPrimary);
  void useRefView.getState().open({
    docId,
    label: TYPE_LABELS[d.type],
    name: d.name,
    backLabel: primary ? TYPE_LABELS[primary.type] : 'the document',
    blockIndex,
  });
}
