import { htmlToLines } from './adapters/html';
import { buildGraph, type DocGraph } from './graph/graph';
import { detectors as registry, type Detector } from './detectors/registry';
import { compareFindings } from './findings/ids';
import type { Finding } from './findings/schema';
import type { Doc, Line } from './model/types';
import { structure } from './structure/structurer';

export interface EngineSettings {
  /** Restrict to these detector ids (default: all registered). */
  detectorIds?: string[];
  /**
   * Receives one entry per detector that threw. The entry carries the detector id and the error
   * class name only — never the message or any document text (F1 isolation).
   */
  diagnostics?: DetectorFailure[];
}

export interface DetectorFailure {
  stage: 'detector';
  detectorId: string;
  code: string;
}

/** Lines -> DocGraph (structure + graph). A structurer exception yields a partial Doc with stage_failed. */
export function buildDocGraph(
  docHash: string,
  lines: Line[],
  meta: Doc['meta'],
  source: Doc['source'] = 'html',
): DocGraph {
  try {
    const s = structure(docHash, lines);
    const graph = buildGraph(s);
    const doc: Doc = { id: docHash, source, blocks: s.blocks, graph, meta };
    return { doc, structure: s, graph };
  } catch {
    const s = structure(docHash, []);
    const graph = { nodes: [], edges: [] };
    const doc: Doc = { id: docHash, source, blocks: [], graph, stage_failed: 'structure', meta };
    return { doc, structure: s, graph };
  }
}

/** HTML bytes/string -> DocGraph. Oversize input throws CoreError('payload_too_large'); no partial model. */
export function analyzeHtml(input: string | Uint8Array): DocGraph {
  const r = htmlToLines(input);
  return buildDocGraph(r.docHash, r.lines, { bytes: r.bytes, adapter_ms: r.adapter_ms });
}

/** Run the registered detectors; findings are de-duplicated by id and stable-ordered (AC8). */
export function runDeterministic(
  g: DocGraph,
  settings: EngineSettings = {},
  list: readonly Detector[] = registry,
): Finding[] {
  const selected = settings.detectorIds
    ? list.filter((d) => settings.detectorIds!.includes(d.id))
    : list;
  const all: Finding[] = [];
  for (const d of selected) {
    try {
      all.push(...d.run(g));
    } catch (e) {
      // one failing detector must not drop every other detector's findings
      settings.diagnostics?.push({
        stage: 'detector',
        detectorId: d.id,
        code: e instanceof Error ? e.name : 'unknown',
      });
    }
  }
  const seen = new Set<string>();
  const unique: Finding[] = [];
  for (const f of all) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    unique.push(f);
  }
  return unique.sort(compareFindings);
}
