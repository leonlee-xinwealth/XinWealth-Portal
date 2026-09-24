import { describe, expect, it } from 'vitest';
import {
  approveReview,
  rejectReview,
  type ApproveReviewContext,
  type ReviewRow,
  type SupabaseLike,
} from '../approveReview';

interface FakeError {
  code?: string | null;
  message?: string | null;
}

interface Call {
  table: string;
  op: 'upsert' | 'update';
  rows?: Record<string, unknown>[];
  options?: { onConflict?: string };
  fields?: Record<string, unknown>;
  eqCol?: string;
  eqVal?: unknown;
}

/** A minimal fake of the Supabase query-builder surface approveReview.ts
 *  calls, recording every call so tests can assert on the payload → DB
 *  writes mapping without a real database.
 *  `errorFor[table]` is either a fixed error (always returned for that
 *  table) or a function of the call, so a test can make e.g. only the FIRST
 *  upsert to a table fail (health_snapshots' column-degrade retry). */
function makeFakeSupabase(
  errorFor: Record<string, FakeError | null | ((call: Call) => FakeError | null)> = {},
) {
  const calls: Call[] = [];

  function resolveError(table: string, call: Call): FakeError | null {
    const spec = errorFor[table];
    if (typeof spec === 'function') return spec(call);
    return spec ?? null;
  }

  const from = (table: string) => ({
    upsert: async (rows: Record<string, unknown>[], options?: { onConflict?: string }) => {
      const call: Call = { table, op: 'upsert', rows, options };
      calls.push(call);
      return { data: null, error: resolveError(table, call) };
    },
    update: (fields: Record<string, unknown>) => ({
      eq: async (eqCol: string, eqVal: unknown) => {
        const call: Call = { table, op: 'update', fields, eqCol, eqVal };
        calls.push(call);
        return { data: null, error: resolveError(table, call) };
      },
    }),
  });

  return { calls, client: { from } as SupabaseLike };
}

function baseReview(overrides: Partial<ReviewRow> = {}): ReviewRow {
  return {
    id: 'r1',
    client_id: 'c1',
    kind: 'quarterly',
    period_end: '2026-09-30',
    status: 'submitted',
    payload: {
      assets: [{ asset_id: 'a1', prev_value: 10000, value: 12000 }],
      liabilities: [
        { liability_id: 'l1', prev_balance: 5000, balance: 4000, prev_rate: 8, interest_rate: 7.5, monthly_payment: 190 },
      ],
      notes: 'test note',
    },
    ...overrides,
  };
}

function baseContext(overrides: Partial<ApproveReviewContext> = {}): ApproveReviewContext {
  return {
    review: baseReview(),
    assets: [{ id: 'a1', asset_type: 'savings', current_value: 10000, ownership_pct: 100 }],
    liabilities: [{ id: 'l1', liability_type: 'personal_loan', outstanding_balance: 5000, interest_rate: 8, monthly_payment: 200 }],
    items: [],
    policies: [],
    client: {},
    previousSnapshot: { snapshot_date: '2026-06-30', net_worth: 5000 },
    valuationsByAsset: {},
    approvedBy: 'advisor-1',
    now: new Date('2026-10-01T00:00:00Z'),
    ...overrides,
  };
}

describe('approveReview — happy path', () => {
  it('writes valuations/balances, updates assets/liabilities, upserts a snapshot with reconciliation, and approves the review', async () => {
    const { calls, client } = makeFakeSupabase();
    const result = await approveReview(client, baseContext());

    expect(result.ok).toBe(true);
    expect(result.notes).toEqual([]);
    expect(result.snapshot?.net_worth).toBe(8000); // 12000 asset − 4000 liability
    expect(result.reconciliation).not.toBeNull();
    // savings is a liquid (class A) asset, excluded from market-change
    // reconcile. With no income/items the only plan cashflow is the
    // liability's own derived installment (planCashflow always derives one
    // from `liabilities`, regardless of items/rows): balance 4000 @ 7.5%
    // with a 190/mo payment → interest 25, principal 165, so
    // monthly_surplus = -190 and monthly_principal = 165 — over the 3
    // months between the two snapshots that's explained = 3×(-190+165) =
    // -75, leaving delta(3000) − (−75) = 3075 unexplained.
    expect(result.reconciliation?.delta_net_worth).toBe(3000);
    expect(result.reconciliation?.unexplained_gap).toBe(3075);

    const valuationCall = calls.find((c) => c.table === 'asset_valuations' && c.op === 'upsert');
    expect(valuationCall?.rows).toEqual([
      { asset_id: 'a1', client_id: 'c1', valuation_date: '2026-09-30', value: 12000, source: 'review' },
    ]);
    expect(valuationCall?.options).toEqual({ onConflict: 'asset_id,valuation_date' });

    const assetUpdateCall = calls.find((c) => c.table === 'assets' && c.op === 'update');
    expect(assetUpdateCall?.fields).toEqual({ current_value: 12000, valuation_date: '2026-09-30' });
    expect(assetUpdateCall?.eqCol).toBe('id');
    expect(assetUpdateCall?.eqVal).toBe('a1');

    const balanceCall = calls.find((c) => c.table === 'liability_balances' && c.op === 'upsert');
    expect(balanceCall?.rows).toEqual([
      { liability_id: 'l1', client_id: 'c1', balance_date: '2026-09-30', balance: 4000, interest_rate: 7.5, monthly_payment: 190, source: 'review' },
    ]);
    expect(balanceCall?.options).toEqual({ onConflict: 'liability_id,balance_date' });

    const liabUpdateCall = calls.find((c) => c.table === 'liabilities' && c.op === 'update');
    expect(liabUpdateCall?.fields).toEqual({ outstanding_balance: 4000, interest_rate: 7.5, monthly_payment: 190 });
    expect(liabUpdateCall?.eqVal).toBe('l1');

    const snapshotCall = calls.find((c) => c.table === 'health_snapshots' && c.op === 'upsert');
    expect(snapshotCall).toBeTruthy();
    const snapshotRow = snapshotCall!.rows![0];
    expect(snapshotRow.client_id).toBe('c1');
    expect(snapshotRow.snapshot_date).toBe('2026-09-30');
    expect(snapshotRow.net_worth).toBe(8000);
    expect(snapshotRow.review_id).toBe('r1');
    expect(snapshotRow.unexplained_gap).toBe(3075);
    expect((snapshotRow.raw_metrics as Record<string, unknown>).reconciliation).toBeTruthy();

    const reviewUpdateCall = calls.find((c) => c.table === 'reviews' && c.op === 'update');
    expect(reviewUpdateCall?.fields).toEqual({
      status: 'approved',
      approved_by: 'advisor-1',
      approved_at: '2026-10-01T00:00:00.000Z',
    });
    expect(reviewUpdateCall?.eqVal).toBe('r1');

    // Order matters (决策 2): valuations/balances are written before the
    // assets/liabilities they back, and the review is only flipped to
    // approved last.
    const order = calls.map((c) => c.table);
    expect(order.indexOf('asset_valuations')).toBeLessThan(order.indexOf('assets'));
    expect(order.indexOf('liability_balances')).toBeLessThan(order.indexOf('liabilities'));
    expect(order.indexOf('reviews')).toBe(order.length - 1);
  });

  it('skips reconciliation (and stores a null unexplained_gap) when there is no previous snapshot', async () => {
    const { calls, client } = makeFakeSupabase();
    const result = await approveReview(client, baseContext({ previousSnapshot: null }));

    expect(result.ok).toBe(true);
    expect(result.reconciliation).toBeNull();
    const snapshotCall = calls.find((c) => c.table === 'health_snapshots' && c.op === 'upsert');
    expect(snapshotCall!.rows![0].unexplained_gap).toBeNull();
  });

  it('only writes rows for assets/liabilities present in the payload', async () => {
    const { calls, client } = makeFakeSupabase();
    const ctx = baseContext({
      assets: [
        { id: 'a1', asset_type: 'savings', current_value: 10000 },
        { id: 'a2', asset_type: 'stock', current_value: 20000 },
      ],
      review: baseReview({
        payload: { assets: [{ asset_id: 'a1', prev_value: 10000, value: 11000 }], liabilities: [] },
      }),
    });
    const result = await approveReview(client, ctx);

    expect(result.ok).toBe(true);
    const assetUpdates = calls.filter((c) => c.table === 'assets' && c.op === 'update');
    expect(assetUpdates).toHaveLength(1);
    expect(assetUpdates[0].eqVal).toBe('a1');
    expect(calls.some((c) => c.table === 'liability_balances')).toBe(false);
    expect(calls.some((c) => c.table === 'liabilities')).toBe(false);
    // the untouched asset (a2) still counts toward the snapshot's net worth.
    expect(result.snapshot?.total_assets).toBe(11000 + 20000);
  });
});

describe('approveReview — duplicate and foreign ids (defence in depth)', () => {
  it('de-duplicates a repeated asset_id/liability_id in the payload, keeping the LAST entry (one row each)', async () => {
    const { calls, client } = makeFakeSupabase();
    const ctx = baseContext({
      review: baseReview({
        payload: {
          assets: [
            { asset_id: 'a1', prev_value: 10000, value: 11000 },
            { asset_id: 'a1', prev_value: 10000, value: 12500 },
          ],
          liabilities: [
            { liability_id: 'l1', prev_balance: 5000, balance: 4200, prev_rate: 8, interest_rate: 7, monthly_payment: 180 },
            { liability_id: 'l1', prev_balance: 5000, balance: 3900, prev_rate: 8, interest_rate: 7.5, monthly_payment: 190 },
          ],
        },
      }),
    });
    const result = await approveReview(client, ctx);

    expect(result.ok).toBe(true);

    const valuationCall = calls.find((c) => c.table === 'asset_valuations' && c.op === 'upsert');
    expect(valuationCall?.rows).toHaveLength(1);
    expect(valuationCall?.rows?.[0].value).toBe(12500);

    const assetUpdates = calls.filter((c) => c.table === 'assets' && c.op === 'update');
    expect(assetUpdates).toHaveLength(1);
    expect(assetUpdates[0].fields?.current_value).toBe(12500);

    const balanceCall = calls.find((c) => c.table === 'liability_balances' && c.op === 'upsert');
    expect(balanceCall?.rows).toHaveLength(1);
    expect(balanceCall?.rows?.[0].balance).toBe(3900);

    const liabUpdates = calls.filter((c) => c.table === 'liabilities' && c.op === 'update');
    expect(liabUpdates).toHaveLength(1);
    expect(liabUpdates[0].fields?.outstanding_balance).toBe(3900);
  });

  it('drops an asset_id/liability_id in the payload that does not belong to this client, and reports it in notes', async () => {
    const { calls, client } = makeFakeSupabase();
    const ctx = baseContext({
      review: baseReview({
        payload: {
          assets: [
            { asset_id: 'a1', prev_value: 10000, value: 11000 },
            { asset_id: 'a-foreign', prev_value: 5000, value: 9000 },
          ],
          liabilities: [
            { liability_id: 'l-foreign', prev_balance: 1000, balance: 500 },
          ],
        },
      }),
    });
    const result = await approveReview(client, ctx);

    expect(result.ok).toBe(true);
    expect(result.notes.some((n) => n.includes('a-foreign'))).toBe(true);
    expect(result.notes.some((n) => n.includes('l-foreign'))).toBe(true);

    const assetUpdates = calls.filter((c) => c.table === 'assets' && c.op === 'update');
    expect(assetUpdates.map((c) => c.eqVal)).toEqual(['a1']);
    expect(calls.some((c) => c.table === 'liabilities' && c.op === 'update')).toBe(false);
    expect(calls.some((c) => c.table === 'liability_balances')).toBe(false);
  });
});

describe('approveReview — graceful degradation', () => {
  it('degrades when asset_valuations does not exist yet, but still updates assets and completes', async () => {
    const { calls, client } = makeFakeSupabase({
      asset_valuations: { code: '42P01', message: 'relation "public.asset_valuations" does not exist' },
    });
    const result = await approveReview(client, baseContext());

    expect(result.ok).toBe(true);
    expect(result.notes).toContain('asset_valuations 表尚未升级，跳过估值历史记录');
    expect(calls.some((c) => c.table === 'assets' && c.op === 'update')).toBe(true);
    expect(calls.some((c) => c.table === 'reviews' && c.op === 'update')).toBe(true);
  });

  it('degrades when liability_balances does not exist yet, but still updates liabilities and completes', async () => {
    const { calls, client } = makeFakeSupabase({
      liability_balances: { code: '42P01', message: 'relation "public.liability_balances" does not exist' },
    });
    const result = await approveReview(client, baseContext());

    expect(result.ok).toBe(true);
    expect(result.notes).toContain('liability_balances 表尚未升级，跳过负债余额历史记录');
    expect(calls.some((c) => c.table === 'liabilities' && c.op === 'update')).toBe(true);
  });

  it('retries the health_snapshots upsert without review_id/unexplained_gap when those columns are missing', async () => {
    const { calls, client } = makeFakeSupabase({
      health_snapshots: (call) =>
        call.rows && 'review_id' in call.rows[0]
          ? { code: '42703', message: 'column "review_id" of relation "health_snapshots" does not exist' }
          : null,
    });
    const result = await approveReview(client, baseContext());

    expect(result.ok).toBe(true);
    expect(result.notes).toContain('health_snapshots.review_id/unexplained_gap 列尚未升级，快照已保存但未关联复检');
    const snapshotCalls = calls.filter((c) => c.table === 'health_snapshots' && c.op === 'upsert');
    expect(snapshotCalls).toHaveLength(2);
    expect('review_id' in snapshotCalls[0].rows![0]).toBe(true);
    expect('review_id' in snapshotCalls[1].rows![0]).toBe(false);
    expect('unexplained_gap' in snapshotCalls[1].rows![0]).toBe(false);
  });
});

describe('approveReview — guards and failures', () => {
  it('refuses to approve a review that is not submitted, without writing anything', async () => {
    const { calls, client } = makeFakeSupabase();
    const result = await approveReview(client, baseContext({ review: baseReview({ status: 'draft' }) }));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/submitted/);
    expect(calls).toHaveLength(0);
  });

  it('stops and reports a hard failure without approving the review', async () => {
    const { calls, client } = makeFakeSupabase({
      assets: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    const result = await approveReview(client, baseContext());

    expect(result.ok).toBe(false);
    expect(result.error).toContain('更新资产');
    expect(calls.some((c) => c.table === 'reviews')).toBe(false);
    expect(calls.some((c) => c.table === 'health_snapshots')).toBe(false);
  });
});

describe('rejectReview', () => {
  it('sets status to rejected and stores the advisor note', async () => {
    const { calls, client } = makeFakeSupabase();
    const result = await rejectReview(client, { reviewId: 'r1', note: 'balances look off, please re-check' });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      {
        table: 'reviews',
        op: 'update',
        fields: { status: 'rejected', advisor_note: 'balances look off, please re-check' },
        eqCol: 'id',
        eqVal: 'r1',
      },
    ]);
  });

  it('reports an error without throwing when the update fails', async () => {
    const { client } = makeFakeSupabase({ reviews: { code: '42501', message: 'permission denied' } });
    const result = await rejectReview(client, { reviewId: 'r1' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('permission denied');
  });
});
