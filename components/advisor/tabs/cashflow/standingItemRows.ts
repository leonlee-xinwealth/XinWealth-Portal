// Pure view-model helpers for the CFP P2b standing-items UI (常设项目).
// Kept framework-free (no React) so this can be unit tested without mounting
// the component tree — CashflowTab.tsx and its sibling panels are the only
// importers. spec docs/superpowers/specs/2026-09-25-cfp-p2b-standing-items-design.md.

import {
  isActiveAt,
  monthStart,
  type StandingItem,
} from '../../../../supabase/functions/_shared/cashflow/items';

/** A cashflow_items row as read back from Supabase — always has an id. */
export type StandingItemRow = StandingItem & { id: string };

/**
 * Items of one direction, filtered for the plan table.
 *
 * `includeInactive=false` (the default view) shows only what's in force at
 * `asOf` — the plan as it stands today. Flipping "显示已结束/历史版本" asks
 * for the full history instead: every version of every item, ended or not,
 * so an advisor can see a raise's before/after or a cancelled subscription.
 *
 * One-off items are excluded here regardless — they belong in the separate
 * "一次性项目" list (决策 4), never mixed into the recurring table.
 *
 * Sorted by category, then by effective_from DESCENDING within a category so
 * the latest version of a changed item (决策 3's 「变更」) reads first.
 */
export function visibleStandingItems(
  items: readonly StandingItemRow[],
  direction: 'inflow' | 'outflow',
  asOf: Date | string,
  includeInactive: boolean,
): StandingItemRow[] {
  const byDirection = (items ?? []).filter(
    (it) => it.direction === direction && it.frequency !== 'one_off',
  );
  const scoped = includeInactive
    ? byDirection
    : byDirection.filter((it) => isActiveAt(it, asOf));
  return scoped.slice().sort((a, b) => {
    if (a.category !== b.category) return a.category < b.category ? -1 : 1;
    if (a.effective_from !== b.effective_from) return a.effective_from > b.effective_from ? -1 : 1;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });
}

/** An item that has a defined effective_to strictly before `asOf`'s month —
 *  shown greyed out when history is visible, and excluded from the default
 *  (active-only) view regardless. */
export function isItemEnded(item: { effective_to?: string | null }, asOf: Date | string): boolean {
  if (item.effective_to == null) return false;
  return item.effective_to < monthStart(asOf);
}

/** 'YYYY-MM' out of a 'YYYY-MM-01' (or any 'YYYY-MM-...') string; '' for a
 *  missing/unusable value so a caller can safely test truthiness. */
export function monthLabel(month: string | null | undefined): string {
  const m = /^(\d{4}-\d{2})/.exec(String(month ?? ''));
  return m ? m[1] : '';
}
