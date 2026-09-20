import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * Regression test for the exact pitfall documented in src/config/env.ts:
 * `z.coerce.boolean()` calls `Boolean(value)` under the hood, so any
 * non-empty string — including the literal string "false" — coerces to
 * `true`. Confirmed still true in Zod 4 (colinhacks/zod#3924, #5501): this
 * upgrade did not fix it. If it ever does, MATOMO_ENABLED's workaround
 * schema would still be correct but redundant — this test exists so a
 * future `z.coerce.boolean()` "simplification" of that field gets caught
 * here instead of silently enabling Matomo tracking by default.
 */
describe('z.coerce.boolean() pitfall (Zod 4)', () => {
  it('still coerces the string "false" to true — do not use it for env flags', () => {
    const schema = z.coerce.boolean();
    expect(schema.parse('false')).toBe(true);
    expect(schema.parse('0')).toBe(true);
    expect(schema.parse('')).toBe(false);
  });
});

describe('enum + default + transform workaround (the pattern used by MATOMO_ENABLED)', () => {
  const flagSchema = z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true');

  it('parses "true" as boolean true', () => {
    expect(flagSchema.parse('true')).toBe(true);
  });

  it('parses "false" as boolean false', () => {
    expect(flagSchema.parse('false')).toBe(false);
  });

  it('defaults to boolean false when the input is undefined', () => {
    expect(flagSchema.parse(undefined)).toBe(false);
  });

  it('rejects any value outside the enum instead of silently coercing it', () => {
    expect(() => flagSchema.parse('yes')).toThrow();
  });
});
