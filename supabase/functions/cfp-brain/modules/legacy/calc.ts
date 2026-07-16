// 传承顾问 (legacy_advisor) — deterministic estate liquidity & distribution
// calculator. Pure, no LLM. Malaysia has no estate duty, so this module is
// entirely about liquidity (can obligations be settled without a forced sale)
// and distribution readiness (will/nomination/faraid), never a tax estimate.

import type { CfpData, FinancialBaseline } from "../../types.ts";

export type EstateRegime = "conventional" | "syariah" | "unknown";
export type WillStatus = "has_will" | "no_will" | "unknown";

export interface LegacyInputs {
  regime?: EstateRegime;
  will_status?: WillStatus;
  epf_nomination?: boolean;
  insurance_nomination?: boolean;
  business_owner?: boolean;
  bankruptcy_risk?: boolean;
}

export interface DistributionShare {
  beneficiary: string;
  share: string;
}

export interface LegacyDet {
  life_cover_total: number;
  gross_estate: number;
  net_estate: number;
  settlement_costs_est: number;
  estate_obligations: number;
  estate_liquidity: {
    available: number;
    status: "covered" | "shortfall";
    shortfall: number;
  };
  distribution: {
    regime: EstateRegime;
    will_status: WillStatus;
    faraid_flagged: boolean;
    intestate_conventional_split: DistributionShare[] | null;
  };
  nominations: {
    epf: boolean | null;
    insurance: boolean | null;
  };
  trust_consideration: boolean;
  /** business owner (or self-employed) facing bankruptcy risk — creditor
   * isolation tools (policy absolute assignment, trust) deserve a mention. */
  asset_isolation_flag: boolean;
  insufficient_data: boolean;
}

const round = (n: number) => Math.round(n);

// Base plans (whole life / ILP) count their own sum assured as life cover;
// 'life' category riders on top of any plan add further cover.
const LIFE_POLICY_TYPES = ["life", "investment_linked"];
const SETTLEMENT_COST_RATE = 0.05;
const TRUST_CONSIDERATION_THRESHOLD = 500000;

export function computeLegacy(
  f: CfpData,
  b: FinancialBaseline,
  inputs: LegacyInputs = {},
): LegacyDet {
  const allRiders = f.policies.flatMap((p) => p.policy_riders ?? []);
  const riderLifeSum = allRiders
    .filter((r) => r.category === "life")
    .reduce((s, r) => s + (r.sum_assured ?? 0), 0);
  const basePolicyLifeSum = f.policies
    .filter((p) => LIFE_POLICY_TYPES.includes(p.policy_type))
    .reduce((s, p) => s + (p.sum_assured ?? 0), 0);
  const lifeCoverTotal = basePolicyLifeSum + riderLifeSum;

  const grossEstate = b.total_assets;
  const netEstate = b.net_worth + lifeCoverTotal;
  const settlementCostsEst = round(SETTLEMENT_COST_RATE * grossEstate);
  const estateObligations = b.total_liabilities + settlementCostsEst;

  const available = b.liquid_assets_total + lifeCoverTotal;
  const shortfall = Math.max(0, round(estateObligations - available));
  const status: "covered" | "shortfall" = available >= estateObligations
    ? "covered"
    : "shortfall";

  const regime = inputs.regime ?? "unknown";
  const willStatus = inputs.will_status ?? "unknown";

  let intestateSplit: DistributionShare[] | null = null;
  let faraidFlagged = false;

  if (regime === "syariah") {
    // Religious-law shares require a Syariah authority's ruling — this
    // deterministic calculator must NEVER compute faraid shares itself.
    faraidFlagged = true;
  } else if (regime === "conventional" && willStatus === "no_will") {
    const married = b.marital_status === "married";
    const hasDependents = b.dependents > 0;
    if (married && hasDependents) {
      // Distribution Act 1958, simplified — assumes no surviving parents.
      intestateSplit = [
        { beneficiary: "spouse", share: "1/3" },
        { beneficiary: "children", share: "2/3" },
      ];
    } else if (married && !hasDependents) {
      intestateSplit = [
        { beneficiary: "spouse", share: "1/2" },
        { beneficiary: "parents", share: "1/2" },
      ];
    } else {
      intestateSplit = [{ beneficiary: "parents", share: "100%" }];
    }
  }

  return {
    life_cover_total: round(lifeCoverTotal),
    gross_estate: grossEstate,
    net_estate: round(netEstate),
    settlement_costs_est: settlementCostsEst,
    estate_obligations: round(estateObligations),
    estate_liquidity: {
      available: round(available),
      status,
      shortfall,
    },
    distribution: {
      regime,
      will_status: willStatus,
      faraid_flagged: faraidFlagged,
      intestate_conventional_split: intestateSplit,
    },
    nominations: {
      epf: inputs.epf_nomination ?? null,
      insurance: inputs.insurance_nomination ?? null,
    },
    trust_consideration: b.dependents > 0 &&
      netEstate > TRUST_CONSIDERATION_THRESHOLD,
    asset_isolation_flag:
      (inputs.business_owner === true ||
        f.client.employment_status === "self_employed") &&
      inputs.bankruptcy_risk === true,
    insufficient_data: grossEstate <= 0,
  };
}
