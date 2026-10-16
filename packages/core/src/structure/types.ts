import type { Anchor, Block, Reference } from '../model/types';

/** Internal structure model (consumed by graph + detectors; not a wire contract). */

export type ScopeKind = 'body' | 'instructions' | 'terms' | 'signature' | 'appendix' | 'part';

export interface Scope {
  id: string;
  kind: ScopeKind;
  title: string;
  ordinal: number;
  startBlock: number;
  sections: Section[];
}

export interface Part {
  letter: string;
  /** Text after "Part X –" up to the first "(" or 120 chars. */
  label: string;
  blockIndex: number;
}

export interface Section {
  /** e.g. "12", "4A". */
  number: string;
  num: number;
  title: string;
  scopeId: string;
  blockIndex: number;
  parts: Part[];
  gap?: boolean;
}

export interface BlockInfo {
  index: number;
  /** Section index within its scope (accepted section enclosing this block). */
  section?: Section;
  part?: Part;
  scope: Scope;
  /** Own list number for list items ("9." -> "9"). */
  listNumber?: string;
}

export type RefForm = 'this_section' | 'part_of_section' | 'section' | 'rule' | 'usc_cfr';

export interface RefInfo {
  ref: Reference;
  form: RefForm;
  blockIndex: number;
  start: number;
  end: number;
  sectionNumber?: string;
  part?: string;
  /** L-form verb (indicated|specified|set forth|described). */
  verb?: string;
  /** Explicit scope qualifier text ("Subscription Agreement Signature Pages"). */
  qualifier?: string;
  /** Statutory rule that classified the ref (audit). */
  rule?: string;
}

export interface DefinedTerm {
  term: string;
  blockIndex: number;
  start: number;
  end: number;
  form: 'paren' | 'means';
}

export interface Conditional {
  id: string;
  blockIndex: number;
  start: number;
  end: number;
  text: string;
  trigger: string;
  action: 'complete' | 'skip' | 'proceed' | 'provide' | 'see';
  negative: boolean;
  targets: string[];
  role?: string;
}

export interface OptionItem {
  label: string;
  checked: boolean;
  blockIndex: number;
}

export interface OptionGroup {
  id: string;
  blockIndices: number[];
  options: OptionItem[];
  exclusive: boolean;
  cue?: string;
}

export interface Field {
  id: string;
  label: string;
  blockIndex: number;
}

export interface Structure {
  docHash: string;
  blocks: Block[];
  info: BlockInfo[];
  scopes: Scope[];
  references: RefInfo[];
  definedTerms: DefinedTerm[];
  conditionals: Conditional[];
  optionGroups: OptionGroup[];
  fields: Field[];
}

export type { Anchor };
