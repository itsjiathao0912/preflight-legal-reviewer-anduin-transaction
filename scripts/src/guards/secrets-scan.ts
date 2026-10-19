import { pathToFileURL } from 'node:url';
import { type Finding, inScope, lineOf, listFiles, readText, report } from './scan-files';

// Log-redaction rule for later phases: never log request/response headers or bodies that may
// carry keys (Authorization, X-Auth-Key, cf-turnstile tokens); log route, status, timing only.

const OPENROUTER_PREFIX = ['sk', 'or', ''].join('-');
/**
 * OpenAI key shapes (`sk-...` legacy, `sk-proj-...` project keys). The left boundary stops false
 * hits inside words such as `risk-evidence-pack-validator`; matches that start with the
 * OpenRouter prefix stay rule `openrouter-key-prefix`. Built at runtime (no key-shaped literal).
 */
export const OPENAI_KEY_RE = new RegExp(
  ['(?<![A-Za-z0-9_-])sk', '(proj-)?[A-Za-z0-9_-]{20,}'].join('-'),
  'g',
);
const SECRET_FILE = /(^|\/)(\.dev\.vars(\..*)?|\.env(\..*)?)$/;
const SECRET_FILE_ALLOW = /\.example$/;
/** FOO_KEY / FOO_SECRET / FOO_TOKEN assigned a long hex or base64-ish literal. */
const ASSIGNMENT =
  /\b[A-Z0-9_]*(_KEY|_SECRET|_TOKEN)\b["']?\s*[:=]\s*["']?([A-Za-z0-9+/=_-]{32,})["']?/g;

export function scanText(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  let i = text.indexOf(OPENROUTER_PREFIX);
  while (i !== -1) {
    findings.push({ file, line: lineOf(text, i), rule: 'openrouter-key-prefix' });
    i = text.indexOf(OPENROUTER_PREFIX, i + 1);
  }
  for (const m of text.matchAll(OPENAI_KEY_RE)) {
    if (m[0].startsWith(OPENROUTER_PREFIX)) continue;
    findings.push({ file, line: lineOf(text, m.index ?? 0), rule: 'openai-key' });
  }
  for (const m of text.matchAll(ASSIGNMENT)) {
    findings.push({
      file,
      line: lineOf(text, m.index ?? 0),
      rule: `literal${m[1]?.toLowerCase()}`,
    });
  }
  return findings;
}

export function secretsScan(root: string): Finding[] {
  const files = listFiles(root);
  const tracked = files
    .filter((f) => SECRET_FILE.test(f) && !SECRET_FILE_ALLOW.test(f))
    .map((file) => ({ file, line: 0, rule: 'secret-file-tracked' }));
  const content = files.filter(inScope).flatMap((file) => {
    const text = readText(root, file);
    return text === null ? [] : scanText(file, text);
  });
  return [...tracked, ...content];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = process.argv[2] ?? process.cwd().replace(/\/scripts$/, '');
  process.exit(report('secrets:scan', secretsScan(root)));
}
