// Joint (household) planning: merge two spouses' CfpData into one household
// view. Design decision (2026-08-17): the merged result keeps the plain
// single-client CfpData shape so all eight module calculators run unchanged;
// the per-spouse slices ride along in `household` for the ones that must
// analyse each life separately (insurance CNA) and for the PDF's owner column.
//
// Merge rules that are NOT plain concatenation — each exists to stop a
// double-count, and each is pinned by household.test.ts:
//   * dependants  → max(), not sum: the same children belong to both parents
//   * goals       → deduped on goal_type+name+target_year: one child's
//                   education fund entered on both records is one goal
//   * demographics→ the primary client's (age drives the retirement timeline;
//                   the partner's age is reported separately on the baseline)
// Joint assets are NOT deduplicated. The house recorded under both spouses is
// indistinguishable from two genuinely separate RM300k holdings, so guessing
// would silently corrupt net worth. detectDuplicateHoldings flags the
// suspicion instead and the advisor resolves it in the data.

import type {
  CfpData,
  ClientGoalRow,
  DuplicateHolding,
  PersonSlice,
} from "./types.ts";

export function toPersonSlice(
  data: CfpData,
  role: "primary" | "partner",
): PersonSlice {
  return {
    role,
    client: data.client,
    cashflow: data.cashflow,
    assets: data.assets,
    liabilities: data.liabilities,
    policies: data.policies,
  };
}

/** Same asset/liability type AND same amount on both spouses — the signature of
 * one jointly-owned item recorded twice. */
export function detectDuplicateHoldings(
  primary: CfpData,
  partner: CfpData,
): DuplicateHolding[] {
  const out: DuplicateHolding[] = [];

  const scan = <T>(
    kind: DuplicateHolding["kind"],
    a: T[],
    b: T[],
    typeOf: (r: T) => string,
    amountOf: (r: T) => number,
  ) => {
    // Count-based matching so two identical rows on one side pair with two on
    // the other, rather than reporting the same match repeatedly.
    const counts = new Map<string, number>();
    for (const r of a) {
      const k = `${typeOf(r)}|${amountOf(r)}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const r of b) {
      const k = `${typeOf(r)}|${amountOf(r)}`;
      const left = counts.get(k) ?? 0;
      if (left > 0) {
        counts.set(k, left - 1);
        out.push({ kind, type: typeOf(r), amount: amountOf(r) });
      }
    }
  };

  scan(
    "asset",
    primary.assets,
    partner.assets,
    (r) => r.asset_type,
    (r) => r.current_value ?? 0,
  );
  scan(
    "liability",
    primary.liabilities,
    partner.liabilities,
    (r) => r.liability_type,
    (r) => r.outstanding_balance ?? 0,
  );

  return out;
}

function mergeGoals(a: ClientGoalRow[], b: ClientGoalRow[]): ClientGoalRow[] {
  const seen = new Set(a.map((g) => `${g.goal_type}|${g.name}|${g.target_year}`));
  return [
    ...a,
    ...b.filter((g) =>
      !seen.has(`${g.goal_type}|${g.name}|${g.target_year}`)
    ),
  ];
}

/** Merge two spouses into a single household CfpData. `primary` owns the
 * report, so its demographics drive the plan's timeline. */
export function mergeHousehold(primary: CfpData, partner: CfpData): CfpData {
  return {
    client: {
      ...primary.client,
      // The couple shares its children — summing would double the dependants.
      number_of_dependants: Math.max(
        primary.client.number_of_dependants ?? 0,
        partner.client.number_of_dependants ?? 0,
      ),
      marital_status: "married",
      has_epf_account: primary.client.has_epf_account ||
        partner.client.has_epf_account,
      has_prs_account: primary.client.has_prs_account ||
        partner.client.has_prs_account,
    },
    cashflow: [...primary.cashflow, ...partner.cashflow],
    assets: [...primary.assets, ...partner.assets],
    liabilities: [...primary.liabilities, ...partner.liabilities],
    policies: [...primary.policies, ...partner.policies],
    investment_accounts: [
      ...primary.investment_accounts,
      ...partner.investment_accounts,
    ],
    holdings: [...primary.holdings, ...partner.holdings],
    goals: mergeGoals(primary.goals, partner.goals),
    household: {
      primary: toPersonSlice(primary, "primary"),
      partner: toPersonSlice(partner, "partner"),
      duplicates: detectDuplicateHoldings(primary, partner),
    },
  };
}
