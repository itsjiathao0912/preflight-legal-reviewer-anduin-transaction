import { makeAnchor } from '../model/anchors';
import type { Block, BlockKind, Line } from '../model/types';
import { extractConditionals } from './conditionals';
import { extractDefinedTerms } from './defined-terms';
import { extractFields } from './fields';
import {
  HEADING_LIMITS,
  isListItemText,
  listNumberOf,
  partCandidate,
  sectionCandidate,
} from './headings';
import { newScope, scopeOpener } from './numbering-scopes';
import { extractOptionGroups } from './option-groups';
import { extractReferences } from './references';
import type { BlockInfo, Part, Scope, Section, Structure } from './types';

/**
 * Structurer: Line[] -> blocks, numbering scopes, sections/parts, references,
 * conditionals, option groups, defined terms, fields. Pure and deterministic.
 * Unknown heading styles become plain paragraphs (never a throw).
 */
export function structure(docHash: string, lines: Line[]): Structure {
  const blocks: Block[] = [];
  const info: BlockInfo[] = [];
  const scopes: Scope[] = [];
  let ordinal = 0;
  let scope = newScope('body', 'Document', ordinal, 0);
  scopes.push(scope);
  let section: Section | undefined;
  let part: Part | undefined;

  const openScope = (kind: Scope['kind'], title: string, at: number) => {
    ordinal++;
    scope = newScope(kind, title, ordinal, at);
    scopes.push(scope);
    section = undefined;
    part = undefined;
  };

  const sectionPath = (): string[] => {
    const p: string[] = [];
    if (scope.kind !== 'body') p.push(scope.title);
    if (section) p.push(`${section.number}. ${section.title}`.trim());
    if (part) p.push(`Part ${part.letter} – ${part.label}`);
    return p;
  };

  lines.forEach((line, i) => {
    const id = `b${i}`;
    let kind: BlockKind = 'paragraph';
    let listNumber: string | undefined;

    const opener = scopeOpener(line);
    const sc = opener ? null : sectionCandidate(line);
    const pc = opener || sc ? null : partCandidate(line);

    if (opener) {
      openScope(opener, line.text.trim(), i);
      kind = 'heading';
    } else if (sc && sc.titleOk) {
      const prev = scope.sections.at(-1);
      const prevNum = prev?.num ?? 0;
      let accept = false;
      let gap = false;
      let restatement = false;
      if (!prev) accept = true;
      else if (sc.num === prevNum + 1) accept = true;
      else if (sc.num === prevNum && sc.number !== prev.number)
        accept = true; // letter suffix (4 -> 4A)
      else if (sc.number === prev.number) restatement = true;
      else if (sc.num > prevNum + 1 && sc.num <= prevNum + HEADING_LIMITS.maxGap) {
        accept = true;
        gap = true;
      } else if (sc.num === 1 && prevNum > 1) {
        // numbering reset under a bold top-level heading after a larger number: new scope
        openScope('body', `${scope.title} (${ordinal + 1})`, i);
        accept = true;
      }
      if (restatement) {
        kind = 'heading';
      } else if (accept) {
        const s: Section = {
          number: sc.number,
          num: sc.num,
          title: sc.title,
          scopeId: scope.id,
          blockIndex: i,
          parts: [],
        };
        if (gap) s.gap = true;
        scope.sections.push(s);
        section = s;
        part = undefined;
        kind = 'heading';
      } else {
        kind = 'list_item';
        listNumber = sc.number;
      }
    } else if (pc && pc.titleOk) {
      if (section) {
        const p: Part = { letter: pc.letter, label: pc.label, blockIndex: i };
        section.parts.push(p);
        part = p;
        kind = 'heading';
      } else {
        openScope('part', line.text.trim(), i);
        kind = 'heading';
      }
    } else if (sc) {
      kind = 'list_item';
      listNumber = sc.number;
    } else if (/^\s*[☐☒]/.test(line.text)) {
      kind = 'option';
    } else if (isListItemText(line.text)) {
      kind = 'list_item';
      listNumber = listNumberOf(line.text);
    } else if (/_{3,}\s*$|:\s*$|\$\s*$/.test(line.text) && line.text.length <= 80) {
      kind = 'field';
    }

    const text = line.text;
    const block: Block = {
      id,
      kind,
      lines: [line],
      section_path: sectionPath(),
      scopeId: scope.id,
      anchor: makeAnchor(docHash, id, 0, text.length),
    };
    blocks.push(block);
    const bi: BlockInfo = { index: i, scope };
    if (section) bi.section = section;
    if (part) bi.part = part;
    if (listNumber) bi.listNumber = listNumber;
    info.push(bi);
  });

  const ctx = { blocks, info, scopes };
  return {
    docHash,
    blocks,
    info,
    scopes,
    references: extractReferences(ctx),
    definedTerms: extractDefinedTerms(blocks),
    conditionals: extractConditionals(blocks),
    optionGroups: extractOptionGroups(blocks),
    fields: extractFields(blocks),
  };
}
