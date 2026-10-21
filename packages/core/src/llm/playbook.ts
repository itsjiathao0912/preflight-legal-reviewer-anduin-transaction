/**
 * Review playbook shared by the clause-judgment and reference-target prompts (frozen prompt text:
 * any change here moves both input hashes, so bump both prompt versions).
 *
 * Leakage rule: the examples are synthetic paraphrases (keys X1 to X6) with different section
 * letters, wording and fund names than the verified EDGAR defects used by the defect bench. The
 * `playbook` unit test greps this text for every ground-truth anchor and fails on a hit, so live
 * recall measures the model, not memorization.
 */
export const REVIEW_PLAYBOOK = [
  'REVIEW PLAYBOOK (how an analyst reviews a subscription document before digitization).',
  'State facts with evidence from the excerpt; never propose the fix (counsel decides fixes).',
  '',
  'DEFECT KINDS',
  'K1 Wrong-target pointer: a routing sentence sends a reader to a section, part, annex or question that exists but is meant for a different investor type (for example an entity-only or plan-only section) or holds unrelated content.',
  'K2 Missing target: a routing sentence names a section or part of this document that does not exist.',
  'K3 Wrong document role: a sentence names a part of one form (for example a questionnaire) when that part is really a different document role (for example the agreement itself).',
  'K4 Broken conditional: an if/then or skip instruction whose condition or destination cannot be followed.',
  'K5 Defined-term issue: a capitalised term used but never defined in the document, or defined twice with a DIFFERENT scope.',
  'K6 Ambiguity, contradiction or meaning-changing typo inside one clause or one investor path.',
  '',
  'SYNTHETIC EXAMPLES (illustrations only; never quote them)',
  'X1 (K1) "Trustees of a grantor trust should next complete Section K." where Section K is headed "Additional Data for Employee Benefit Plans Only". The pointer sends a trust to a plan-only section: report it as broken_cross_reference.',
  'X2 (K1) "Every partnership investor should answer Part 7." where Part 7 is headed "Questions for Natural Persons". Entity routed to an individual-only part: report it.',
  'X3 (K2) "Use the figures given in Schedule Q of the Investor Questionnaire." where the questionnaire has only Schedules M, N and P: the target does not exist; report it.',
  'X4 (K3) "Attach the details given in Annex 2 of the Eligibility Questionnaire." where Annex 2 is the purchase agreement, not part of the questionnaire: report it.',
  'X5 (not a defect) "the Harbor Ridge Fund is relying on Section 3(c)(1) of the Investment Company Act": an external statute citation, not a pointer inside this document.',
  'X6 (not a defect) "Capitalised words here have the meanings set out in the Harbor Ridge offering memorandum": terms defined by reference to another document are not undefined.',
  '',
  'NOT-A-DEFECT LIST (never report these)',
  'N1 Statute or regulation citations (Investment Company Act sections, Internal Revenue Code sections, Rules, C.F.R. citations): they are external, not references to this document.',
  'N2 Terms defined by reference to another document ("has the meaning given in" the PPM, Memorandum or Bylaws): they are not undefined.',
  'N3 IRS form text such as an instruction to complete a Part of a W-8 or W-9 form: it refers to the IRS form, not to this document.',
  'N4 Identical re-definitions of the same term in a combined two-form file (for example an entity form and an individual form in one file): only a re-definition with a different scope is a defect.',
  'N5 Instructions-vs-body scoping: a pointer inside an instructions block that names a part of a different form in the same file.',
  'N6 A term defined but never used again: minor, do not report.',
  '',
  'WHEN UNSURE, do not report. One finding per real problem.',
].join('\n');
