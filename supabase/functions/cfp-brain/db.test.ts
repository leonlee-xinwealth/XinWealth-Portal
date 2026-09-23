import {
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { fetchCfpData } from "./db.ts";

/**
 * A minimal stand-in for the PostgREST builder: every method returns the chain,
 * and awaiting it yields the rows registered for that table. `.single()` /
 * `.maybeSingle()` yield the first row.
 */
// deno-lint-ignore no-explicit-any
function fakeDb(tables: Record<string, any[]>) {
  const selects: Record<string, string> = {};
  return {
    selects,
    from(table: string) {
      const rows = tables[table] ?? [];
      // deno-lint-ignore no-explicit-any
      const chain: any = {
        select(cols: string) {
          selects[table] = cols;
          return chain;
        },
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
        // deno-lint-ignore no-explicit-any
        then: (res: (v: any) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(res),
      };
      return chain;
    },
  };
}

const CLIENT = {
  id: "c-1",
  date_of_birth: "1990-03-18",
  marital_status: "married",
  number_of_dependants: 0,
  employment_status: "employed",
  occupation: "Insurance Agent",
  tax_residency: "resident",
  risk_profile: "balanced",
  retirement_age: 50,
  epf_account_number: "12345678",
  ppa_account_number: null,
  has_epf: true,
};

/**
 * The real shape that broke: five expenses captured in June, one more added in
 * July. Drawn from a live client whose RM 1,548/month of spending was reported
 * as RM 128.
 */
const CASHFLOW_ACROSS_TWO_MONTHS = [
  { direction: "outflow", amount: 128, frequency: "monthly", category: "household", period_month: "2026-07-01" },
  { direction: "outflow", amount: 580, frequency: "monthly", category: "personal", period_month: "2026-06-01" },
  { direction: "outflow", amount: 340, frequency: "monthly", category: "transportation", period_month: "2026-06-01" },
  { direction: "outflow", amount: 200, frequency: "monthly", category: "personal", period_month: "2026-06-01" },
  { direction: "outflow", amount: 200, frequency: "monthly", category: "miscellaneous", period_month: "2026-06-01" },
  { direction: "outflow", amount: 100, frequency: "monthly", category: "personal", period_month: "2026-06-01" },
  { direction: "inflow", amount: 2577, frequency: "monthly", category: "salary", period_month: "2026-06-01" },
];

function db(over: Record<string, unknown[]> = {}) {
  return fakeDb({
    clients: [CLIENT],
    cashflow_entries: CASHFLOW_ACROSS_TWO_MONTHS,
    assets: [],
    liabilities: [],
    insurance_policies: [],
    investment_accounts: [],
    portfolio_holdings: [],
    client_goals: [],
    cashflow_items: [],
    ...over,
  });
}

const SALARY_ITEM = {
  id: "i-1",
  client_id: "c-1",
  direction: "inflow",
  category: "salary_basic",
  name: "Salary",
  amount: 8000,
  frequency: "monthly",
  effective_from: "2026-04-01",
  effective_to: null,
  linked_asset_id: null,
  linked_liability_id: null,
  linked_policy_id: null,
  needs_review: false,
};

Deno.test("every month's rows survive the fetch", async () => {
  // The regression. cfp-brain used to keep only each direction's most recent
  // period_month and discard the rest. On real data one expense added in July
  // dropped the five entered in June: RM 1,548 of recorded spending became
  // RM 128, and every downstream figure — savings rate, emergency fund,
  // retirement capital, the budget waterfall — was computed from it.
  //
  // The fetch now returns every month. Choosing WHICH months a plan is built on
  // is a separate, visible decision made in the calculation layer.
  const f = await fetchCfpData(db(), "c-1");
  const outflow = f!.cashflow.filter((r) => r.direction === "outflow");

  assertEquals(outflow.length, 6, "every recorded expense must survive the fetch");
  assertEquals(
    outflow.reduce((s, r) => s + r.amount, 0),
    1548,
    "June's five rows and July's one, all of them",
  );
  // And each row still knows which month it belongs to.
  assertEquals(
    outflow.filter((r) => r.period_month === "2026-06-01").length,
    5,
  );
});

Deno.test("income recorded in an earlier month than expenses still counts", async () => {
  // The mirror case, and the more dangerous one: a client whose income was
  // captured in a different month from their expenses used to be shown as
  // deeply cash-flow negative.
  const f = await fetchCfpData(db(), "c-1");
  assertEquals(
    f!.cashflow.filter((r) => r.direction === "inflow").reduce((s, r) => s + r.amount, 0),
    2577,
  );
});

Deno.test("period_month IS fetched — it is the dimension the plan is built on", async () => {
  // A row records ONE MONTH'S actual amount, so which month it belongs to has
  // to reach the calculation layer. What must never happen is filtering by it
  // HERE: that is the original defect, and _shared/cashflow/periods.ts is where
  // the choice of months belongs.
  const d = db();
  await fetchCfpData(d, "c-1");
  assertEquals(d.selects.cashflow_entries.includes("period_month"), true);
});

Deno.test("portfolio_holdings KEEPS its snapshot semantics", async () => {
  // Holdings genuinely are a monthly restatement of the whole portfolio, so
  // summing across months would multiply the client's investments. The fix to
  // cashflow must not be applied here.
  const holdings = [
    { snapshot_month: "2026-07-01", instrument_code: "A", market_value: 500, cost_basis: 400 },
    { snapshot_month: "2026-07-01", instrument_code: "B", market_value: 300, cost_basis: 300 },
    { snapshot_month: "2026-06-01", instrument_code: "A", market_value: 450, cost_basis: 400 },
    { snapshot_month: "2026-06-01", instrument_code: "B", market_value: 280, cost_basis: 300 },
  ];
  const f = await fetchCfpData(db({ portfolio_holdings: holdings }), "c-1");
  assertEquals(f!.holdings.length, 2);
  assertEquals(
    f!.holdings.every((h) => h.snapshot_month === "2026-07-01"),
    true,
    "only the latest snapshot",
  );
  assertEquals(f!.holdings.reduce((s, h) => s + (h.market_value ?? 0), 0), 800);
});

Deno.test("a client with no cashflow at all yields an empty list, not a throw", async () => {
  const f = await fetchCfpData(db({ cashflow_entries: [] }), "c-1");
  assertEquals(f!.cashflow, []);
});

Deno.test("account numbers degrade to booleans at the fetch boundary", async () => {
  // Pre-existing PII discipline; pinned here because this file is now tested.
  const f = await fetchCfpData(db(), "c-1");
  assertEquals(f!.client.has_epf_account, true);
  assertEquals(f!.client.has_prs_account, false);
  assertEquals(
    Object.keys(f!.client).some((k) => k.includes("account_number")),
    false,
  );
});

// ---------------------------------------------------------------------------
// P2b — cashflow_items (常设项目) and clients.has_epf
// ---------------------------------------------------------------------------

Deno.test("cashflow_items: every version is fetched for the client", async () => {
  const f = await fetchCfpData(db({ cashflow_items: [SALARY_ITEM] }), "c-1");
  assertEquals(f!.items.length, 1);
  assertEquals(f!.items[0].category, "salary_basic");
  assertEquals(f!.items[0].effective_from, "2026-04-01");
});

Deno.test("cashflow_items: a client with none yields an empty list, not a throw", async () => {
  const f = await fetchCfpData(db(), "c-1");
  assertEquals(f!.items, []);
});

Deno.test("clients.has_epf reaches CfpClient.has_epf verbatim (true/false/null)", async () => {
  const truthy = await fetchCfpData(db(), "c-1");
  assertEquals(truthy!.client.has_epf, true);

  const falsy = await fetchCfpData(db({ clients: [{ ...CLIENT, has_epf: false }] }), "c-1");
  assertEquals(falsy!.client.has_epf, false);

  const unset = await fetchCfpData(db({ clients: [{ ...CLIENT, has_epf: null }] }), "c-1");
  assertEquals(unset!.client.has_epf, null);
});

Deno.test("cashflow_items select includes every column planCashflow/statutory need", async () => {
  const d = db();
  await fetchCfpData(d, "c-1");
  for (
    const col of [
      "client_id",
      "direction",
      "category",
      "amount",
      "frequency",
      "effective_from",
      "effective_to",
      "linked_asset_id",
      "linked_liability_id",
      "linked_policy_id",
      "needs_review",
    ]
  ) {
    assertEquals(d.selects.cashflow_items.includes(col), true, `missing column: ${col}`);
  }
});
