// One reading of "where is this section in the review flow", shared by the
// section card, the progress strip, the review page and the export gate.
//
// These four used to each derive it from `status` inline, and they disagreed:
// the card treated a long-stuck `generating` row as retryable while a progress
// count would have called it in-flight, and nothing at all knew about the
// staleness flags the server writes. A gate is only as trustworthy as the
// weakest of the places that compute what it gates, so there is exactly one
// function now.

import { CFP_SECTION_ORDER, type CfpSectionType } from './sectionMeta';

export interface ReviewSection {
  section_type: string;
  status: 'generating' | 'draft' | 'approved' | 'failed';
  content: unknown;
  error: string | null;
  updated_at: string;
  /** null on rows generated before the review pipeline shipped */
  input_fingerprint?: string | null;
  stale_reason?: string | null;
  stale_at?: string | null;
}

export type ReviewState =
  /** no row, or a row that has never produced content */
  | 'missing'
  /** a run is in flight */
  | 'generating'
  /** nothing to show, and the last attempt errored */
  | 'failed'
  /** has content, but the numbers it was written against have moved */
  | 'stale'
  /** has content, awaiting the advisor */
  | 'draft'
  /** signed off */
  | 'approved';

/**
 * A generation that has sat in `generating` this long is not running any more —
 * the edge function's own wall-clock limit is far below it. Without this a
 * crashed invocation would leave the section unreachable forever, since the
 * generating branch shows a spinner and no buttons.
 */
const GENERATING_TIMEOUT_MS = 3 * 60 * 1000;

export function reviewStateOf(
  section: ReviewSection | null | undefined,
  now: number = Date.now(),
): ReviewState {
  if (!section) return 'missing';

  if (section.status === 'generating') {
    const started = new Date(section.updated_at).getTime();
    if (Number.isFinite(started) && now - started <= GENERATING_TIMEOUT_MS) {
      return 'generating';
    }
    // Timed out. Fall through: if a previous draft survives, it is still the
    // thing the advisor should be looking at.
    return section.content ? 'draft' : 'failed';
  }

  if (section.status === 'failed') return section.content ? 'draft' : 'failed';
  if (!section.content) return 'missing';
  if (section.status === 'approved') return 'approved';
  return section.stale_reason ? 'stale' : 'draft';
}

/** States that mean the advisor still has work to do before this can ship. */
export function isPending(state: ReviewState): boolean {
  return state !== 'approved';
}

export interface ReviewSummary {
  states: Record<CfpSectionType, ReviewState>;
  approvedCount: number;
  total: number;
  /** sections still standing between the advisor and an export, in review order */
  blocking: CfpSectionType[];
  canExport: boolean;
  /** any section at all has content — i.e. a draft preview is worth offering */
  hasAnyContent: boolean;
}

export function summarizeReview(
  sections: ReviewSection[],
  now: number = Date.now(),
): ReviewSummary {
  const byType = new Map(sections.map((s) => [s.section_type, s]));
  const states = {} as Record<CfpSectionType, ReviewState>;
  const blocking: CfpSectionType[] = [];
  let approvedCount = 0;
  let hasAnyContent = false;

  for (const type of CFP_SECTION_ORDER) {
    const section = byType.get(type) ?? null;
    const state = reviewStateOf(section, now);
    states[type] = state;
    if (state === 'approved') approvedCount++;
    else blocking.push(type);
    if (section?.content) hasAnyContent = true;
  }

  return {
    states,
    approvedCount,
    total: CFP_SECTION_ORDER.length,
    blocking,
    // Every section, no exceptions. A report that prints eight chapters is not
    // partially reviewed — an unreviewed chapter is a chapter the advisor is
    // putting their name to unread.
    canExport: blocking.length === 0,
    hasAnyContent,
  };
}

/** The next section that needs attention, for "approve and continue". */
export function nextPending(
  summary: ReviewSummary,
  after: CfpSectionType,
): CfpSectionType | null {
  const start = CFP_SECTION_ORDER.indexOf(after);
  for (let i = 1; i <= CFP_SECTION_ORDER.length; i++) {
    const type = CFP_SECTION_ORDER[(start + i) % CFP_SECTION_ORDER.length];
    if (type === after) break;
    if (isPending(summary.states[type])) return type;
  }
  return null;
}

export const STATE_META: Record<
  ReviewState,
  { en: string; zh: string; dot: string; chip: string }
> = {
  missing: { en: 'Not generated', zh: '未生成', dot: 'bg-slate-300', chip: 'bg-slate-100 text-slate-500' },
  generating: { en: 'Generating', zh: '生成中', dot: 'bg-sky-400', chip: 'bg-sky-50 text-sky-600' },
  failed: { en: 'Failed', zh: '生成失败', dot: 'bg-red-500', chip: 'bg-red-50 text-red-600' },
  stale: { en: 'Basis changed', zh: '依据已变更', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700' },
  draft: { en: 'Draft', zh: '草稿', dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600' },
  approved: { en: 'Approved', zh: '已定稿', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
};
