import { appDb } from '../../storage/db';

/**
 * Counsel question ids created for a document (Dexie uiState `questions:{docId}`): finding key ->
 * Worker question id. Export creates the questions once in a batch; an answer recorded later reuses
 * the id, so a question is never created twice for the same finding.
 */
const key = (docId: string) => `questions:${docId}`;

export async function readQuestionIds(docId: string): Promise<Record<string, string>> {
  const db = appDb();
  if (!db) return {};
  try {
    const v = (await db.uiState.get(key(docId)))?.value;
    if (!v || typeof v !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, id] of Object.entries(v as Record<string, unknown>))
      if (typeof id === 'string') out[k] = id;
    return out;
  } catch {
    return {};
  }
}

export async function saveQuestionIds(docId: string, ids: Record<string, string>): Promise<void> {
  const db = appDb();
  if (!db) return;
  try {
    const prev = await readQuestionIds(docId);
    await db.uiState.put({ key: key(docId), value: { ...prev, ...ids }, updatedAt: Date.now() });
  } catch {
    /* ids stay unknown: the next answer creates its question at send time */
  }
}
