// CFP-mode data access: pulls a client's full financial picture with the
// service-role client. Read-only apart from policy_review_requests writes.

import type { CfpFinancials } from "../_shared/insurance/mapping.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

export async function fetchClientFinancials(
  db: Db,
  clientId: string,
): Promise<CfpFinancials | null> {
  const { data: client, error } = await db
    .from("clients")
    .select(
      "id, full_name, email, phone, date_of_birth, number_of_dependants, occupation, retirement_age, marital_status",
    )
    .eq("id", clientId)
    .single();
  if (error || !client) return null;

  const [inflowsRes, liabilitiesRes, assetsRes, policiesRes] = await Promise
    .all([
      db
        .from("cashflow_entries")
        .select("amount, frequency, category, period_month")
        .eq("client_id", clientId)
        .eq("direction", "inflow")
        .eq("is_recurring", true)
        .order("period_month", { ascending: false }),
      db
        .from("liabilities")
        .select("liability_type, name, outstanding_balance, monthly_payment")
        .eq("client_id", clientId),
      db
        .from("assets")
        .select("asset_type, current_value")
        .eq("client_id", clientId),
      db
        .from("insurance_policies")
        .select(
          "policy_type, provider, sum_assured, premium, premium_frequency, policy_number, cash_value, start_date, end_date, policy_riders(category, sum_assured, room_board_daily, annual_limit, lifetime_limit)",
        )
        .eq("client_id", clientId),
    ]);

  // Only the most recent period_month represents current recurring income.
  const allInflows = inflowsRes.data ?? [];
  const latestMonth = allInflows[0]?.period_month;
  const inflows = latestMonth
    ? allInflows.filter(
      (e: { period_month: string }) => e.period_month === latestMonth,
    )
    : [];

  return {
    client,
    inflows,
    liabilities: liabilitiesRes.data ?? [],
    assets: assetsRes.data ?? [],
    policies: policiesRes.data ?? [],
  };
}
