/** Form logic outline schema id (bump the suffix on any breaking schema change). */
export const OUTLINE_SCHEMA_ID = 'form-logic-outline/v1' as const;

/** Fixed disclaimer carried by every outline: the export is a reference, not a generated form. */
export const OUTLINE_DISCLAIMER = 'Reference outline only; not a generated form.' as const;

/** Longest free-text value in an outline (mask first, then clip). */
export const OUTLINE_TEXT_MAX = 300;

/** Longest masked document name. */
export const OUTLINE_NAME_MAX = 120;
