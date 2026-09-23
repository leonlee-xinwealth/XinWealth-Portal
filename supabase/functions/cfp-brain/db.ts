// CFP data access: pulls a client's full financial picture with the service-
// role client. PII discipline: identifying fields (name/NRIC/email/phone/
// account numbers) are NEVER selected — account presence becomes a boolean.

import type { CfpData } from "./types.ts";
import { mergeHousehold } from "./household.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

/**
 * P3 决策 2: `asset_valuations` may not exist yet in every environment (the
 * migration ships separately from this code) — every read degrades to an
 * empty array instead of failing the whole fetch, exactly like a client with
 * no rows in the table yet.
 */
export async function fetchAssetValuationsGraceful(db: Db, clientId: string) {
  try {
    const { data, error } = await db
      .from("asset_valuations")
      .select("asset_id, valuation_date, value, net_contribution")
      .eq("client_id", clientId);
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

/**
 * Keep only rows of the most recent snapshot represented in `rows`.
 *
 * Correct for portfolio_holdings, which genuinely IS a monthly snapshot: each
 * month restates the whole portfolio, so summing across months would multiply
 * the client's holdings.
 *
 * Deliberately NOT used for cashflow_entries — see the comment there.
 */
// deno-lint-ignore no-explicit-any
function latestSnapshotOnly<T = any>(rows: any[], key: string): T[] {
  const latest = rows[0]?.[key];
  return latest ? rows.filter((r) => r[key] === latest) : [];
}

/** One client's own financial picture. Joint reports call this twice and merge
 * the results — see mergeHousehold. */
async function fetchPerson(
  db: Db,
  clientId: string,
): Promise<CfpData | null> {
  const { data: client, error } = await db
    .from("clients")
    .select(
      "id, date_of_birth, marital_status, number_of_dependants, employment_status, occupation, tax_residency, risk_profile, retirement_age, epf_account_number, ppa_account_number, has_epf",
    )
    .eq("id", clientId)
    .single();
  if (error || !client) return null;

  const [cashflowRes, assetsRes, liabilitiesRes, policiesRes, acctRes, holdingsRes, goalsRes, itemsRes, valuations] =
    await Promise.all([
      db
        .from("cashflow_entries")
        .select(
          "direction, amount, frequency, category, period_month, linked_asset_id, linked_liability_id",
        )
        .eq("client_id", clientId)
        .eq("is_recurring", true),
      db
        // P3: `id` feeds assessAssets (2×2) — matching this asset against its
        // linked standing items/liabilities/valuations. Not identifying.
        .from("assets")
        .select("id, asset_type, current_value, cost_value, ownership_type")
        .eq("client_id", clientId),
      db
        .from("liabilities")
        // id/name/original_principal/remaining_months/rate_type feed the D1
        // loan estimator and its dedupe check (_shared/finance/derived.ts) —
        // P2a. linked_asset_id (P3) feeds assessAssets's net-cash-flow. None
        // of these are identifying fields.
        .select(
          "id, name, liability_type, outstanding_balance, interest_rate, monthly_payment, original_principal, remaining_months, rate_type, end_date, linked_asset_id",
        )
        .eq("client_id", clientId),
      db
        .from("insurance_policies")
        // id/plan_name feed the P2a derived-premium item's dedupe key and
        // display name (a product name, not client PII).
        .select(
          "id, plan_name, policy_type, provider, sum_assured, premium, premium_frequency, policy_number, cash_value, start_date, end_date, policy_riders(category, sum_assured, room_board_daily, annual_limit, lifetime_limit)",
        )
        .eq("client_id", clientId),
      db
        // P3 决策 1: id/asset_id feed legacyHoldings (baseline.ts) — telling
        // whether this account's value has already been folded into `assets`.
        .from("investment_accounts")
        .select("id, asset_id, account_type, prs_sub_account_a, prs_sub_account_b")
        .eq("client_id", clientId),
      db
        // account_id (P3 决策 1) feeds legacyHoldings — see above.
        .from("portfolio_holdings")
        .select("account_id, snapshot_month, instrument_code, market_value, cost_basis")
        .eq("client_id", clientId)
        .order("snapshot_month", { ascending: false }),
      db
        .from("client_goals")
        .select(
          "id, goal_type, name, target_amount, target_year, current_saved, monthly_contribution, inflation_override, priority",
        )
        .eq("client_id", clientId)
        .order("priority", { ascending: true }),
      db
        .from("cashflow_items")
        // P2b 决策 1: every version of every standing item — planCashflow
        // itself decides which are active (决策 2) and picks a mode via
        // isSuperseded (决策 8). None of these are identifying fields.
        .select(
          "id, client_id, direction, category, name, amount, frequency, effective_from, effective_to, linked_asset_id, linked_liability_id, linked_policy_id, needs_review",
        )
        .eq("client_id", clientId),
      fetchAssetValuationsGraceful(db, clientId),
    ]);

  // EVERY row, across every month. Selecting a period here is exactly the bug
  // this used to have: it kept only each direction's most recent period_month
  // and dropped the rest, turning RM 1,548/month of a real client's spending
  // into RM 128 and reporting their retirement as fully funded.
  //
  // A row belongs to the month in `period_month` and records that month's
  // actual amount. Which months a plan is built on is a PLANNING decision the
  // advisor makes (planning_inputs.cashflow_basis), so it belongs in the
  // calculation layer — see _shared/cashflow/periods.ts. Filtering here would
  // fork the 口径 again and hide the choice from everyone downstream.
  const cashflow = cashflowRes.data ?? [];

  return {
    client: {
      id: client.id,
      date_of_birth: client.date_of_birth,
      marital_status: client.marital_status,
      number_of_dependants: client.number_of_dependants ?? 0,
      employment_status: client.employment_status,
      occupation: client.occupation,
      tax_residency: client.tax_residency,
      risk_profile: client.risk_profile,
      retirement_age: client.retirement_age,
      has_epf_account: !!client.epf_account_number,
      has_prs_account: !!client.ppa_account_number,
      has_epf: client.has_epf ?? null,
    },
    cashflow,
    assets: assetsRes.data ?? [],
    liabilities: liabilitiesRes.data ?? [],
    policies: policiesRes.data ?? [],
    investment_accounts: acctRes.data ?? [],
    holdings: latestSnapshotOnly(holdingsRes.data ?? [], "snapshot_month"),
    asset_valuations: valuations,
    goals: goalsRes.data ?? [],
    items: itemsRes.data ?? [],
  };
}

/** `partnerId` non-null = joint household report: both spouses are fetched and
 * merged into one household picture (top-level fields), with each person's own
 * figures preserved under `household`. Null/absent behaves exactly as before. */
export async function fetchCfpData(
  db: Db,
  clientId: string,
  partnerId?: string | null,
): Promise<CfpData | null> {
  if (!partnerId || partnerId === clientId) return await fetchPerson(db, clientId);

  const [primary, partner] = await Promise.all([
    fetchPerson(db, clientId),
    fetchPerson(db, partnerId),
  ]);
  if (!primary) return null;
  // A partner whose record vanished shouldn't kill the report — fall back to
  // the individual picture rather than failing the whole generation.
  if (!partner) return primary;

  return mergeHousehold(primary, partner);
}
