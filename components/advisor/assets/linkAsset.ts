// Pure helper for NetworthTab's 「关联资产」 default-selection on Add Liability:
// certain liability types practically only ever finance one kind of asset —
// when the client has exactly one such asset already on file, preselect it
// instead of making the advisor hunt for it in the dropdown. Any other
// combination (zero or multiple candidates, or a liability type with no
// obvious asset class) leaves the picker on 「不关联」 so the advisor chooses
// explicitly rather than guessing wrong.

export interface LinkableAsset {
  id: string;
  asset_type: string;
}

// liability_type -> the asset_type(s) it's assumed to finance.
const DEFAULT_ASSET_TYPES_BY_LIABILITY: Readonly<Record<string, readonly string[]>> = {
  car_loan: ['vehicle'],
  mortgage: ['own_residence', 'investment_property'],
};

export function defaultLinkedAssetId(
  liabilityType: string | null | undefined,
  assets: readonly LinkableAsset[] | null | undefined,
): string | null {
  const eligibleTypes = liabilityType ? DEFAULT_ASSET_TYPES_BY_LIABILITY[liabilityType] : undefined;
  if (!eligibleTypes || !assets) return null;
  const candidates = assets.filter((a) => eligibleTypes.includes(a.asset_type));
  return candidates.length === 1 ? candidates[0].id : null;
}
