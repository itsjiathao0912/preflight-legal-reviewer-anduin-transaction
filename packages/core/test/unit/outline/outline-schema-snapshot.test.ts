import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { OutlineSchema } from '../../../src/outline/index';

/** AC63: the v1 JSON Schema must not drift from the committed fixture (bump the version instead). */
const FIXTURE = new URL('../../../../../fixtures/outline/schema.v1.json', import.meta.url);

function outlineJsonSchemaText(): string {
  return JSON.stringify(z.toJSONSchema(OutlineSchema), null, 2) + '\n';
}

describe('outline-schema-snapshot (AC63)', () => {
  test('should match the committed JSON Schema fixture', () => {
    expect(JSON.parse(outlineJsonSchemaText())).toEqual(JSON.parse(readFileSync(FIXTURE, 'utf8')));
  });

  test('should state that investor paths are heuristic', () => {
    expect(readFileSync(FIXTURE, 'utf8')).toMatch(/heuristic/);
  });
});
