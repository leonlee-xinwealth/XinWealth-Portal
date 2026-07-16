// CFP data access: pulls a client's full financial picture with the service-
// role client. PII discipline: identifying fields (name/NRIC/email/phone/
// account numbers) are NEVER selected — account presence becomes a boolean.

import type { CfpData } from "./types.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

/** Keep only rows of the most recent period represented in `rows`. */
// deno-lint-ignore no-explicit-any
function latestPeriodOnly<T = any>(rows: any[], key: string): T[] {
  const latest = rows[0]?.[key];
  return latest ? rows.filter((r) => r[key] === latest) : [];
}

export async function fetchCfpData(
  db: Db,
  clientId: string,
): Promise<CfpData | null> {
  const { data: client, error } = await db
    .from("clients")
    .select(
      "id, date_of_birth, marital_status, number_of_dependants, employment_status, occupation, tax_residency, risk_profile, retirement_age, epf_account_number, ppa_account_number",
    )
    .eq("id", clientId)
    .single();
  if (error || !client) return null;

  const [cashflowRes, assetsRes, liabilitiesRes, policiesRes, acctRes, holdingsRes, goalsRes] =
    await Promise.all([
      db
        .from("cashflow_entries")
        .select(
          "direction, amount, frequency, category, period_month, linked_asset_id, linked_liability_id",
        )
        .eq("client_id", clientId)
        .eq("is_recurring", true)
        .order("period_month", { ascending: false }),
      db
        .from("assets")
        .select("asset_type, current_value, cost_value, ownership_type")
        .eq("client_id", clientId),
      db
        .from("liabilities")
        .select(
          "liability_type, outstanding_balance, interest_rate, monthly_payment, end_date",
        )
        .eq("client_id", clientId),
      db
        .from("insurance_policies")
        .select(
          "policy_type, provider, sum_assured, premium, premium_frequency, policy_number, cash_value, start_date, end_date, policy_riders(category, sum_assured, room_board_daily, annual_limit, lifetime_limit)",
        )
        .eq("client_id", clientId),
      db
        .from("investment_accounts")
        .select("account_type, prs_sub_account_a, prs_sub_account_b")
        .eq("client_id", clientId),
      db
        .from("portfolio_holdings")
        .select("snapshot_month, instrument_code, market_value, cost_basis")
        .eq("client_id", clientId)
        .order("snapshot_month", { ascending: false }),
      db
        .from("client_goals")
        .select(
          "id, goal_type, name, target_amount, target_year, current_saved, monthly_contribution, inflation_override, priority",
        )
        .eq("client_id", clientId)
        .order("priority", { ascending: true }),
    ]);

  // Income and expenses may be recorded in different months — take each
  // direction's own most recent period as "current".
  const cashflowAll = cashflowRes.data ?? [];
  const cashflow = [
    ...latestPeriodOnly(
      cashflowAll.filter((r: { direction: string }) => r.direction === "inflow"),
      "period_month",
    ),
    ...latestPeriodOnly(
      cashflowAll.filter((r: { direction: string }) => r.direction === "outflow"),
      "period_month",
    ),
  ];

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
    },
    cashflow,
    assets: assetsRes.data ?? [],
    liabilities: liabilitiesRes.data ?? [],
    policies: policiesRes.data ?? [],
    investment_accounts: acctRes.data ?? [],
    holdings: latestPeriodOnly(holdingsRes.data ?? [], "snapshot_month"),
    goals: goalsRes.data ?? [],
  };
}
