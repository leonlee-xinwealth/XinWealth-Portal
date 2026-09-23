import { describe, expect, it } from 'vitest';
import { isMissingColumnError, isMissingTableError } from '../degrade';

describe('isMissingColumnError', () => {
  it('recognises the Postgres undefined_column code', () => {
    expect(isMissingColumnError({ code: '42703', message: 'column "asset_id" does not exist' })).toBe(true);
  });

  it('recognises PostgREST schema-cache-miss code', () => {
    expect(isMissingColumnError({ code: 'PGRST204' })).toBe(true);
  });

  it('recognises the message shape even without a matching code', () => {
    expect(isMissingColumnError({ message: "Could not find the 'asset_id' column of 'investment_accounts' in the schema cache" })).toBe(true);
  });

  it('is false for unrelated errors', () => {
    expect(isMissingColumnError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(false);
  });

  it('tolerates null/undefined', () => {
    expect(isMissingColumnError(null)).toBe(false);
    expect(isMissingColumnError(undefined)).toBe(false);
  });
});

describe('isMissingTableError', () => {
  it('recognises the Postgres undefined_table code', () => {
    expect(isMissingTableError({ code: '42P01' })).toBe(true);
  });

  it('recognises the message shape', () => {
    expect(isMissingTableError({ message: 'relation "public.asset_valuations" does not exist' })).toBe(true);
  });

  it('is false for unrelated errors', () => {
    expect(isMissingTableError({ code: '42703' })).toBe(false);
  });
});
