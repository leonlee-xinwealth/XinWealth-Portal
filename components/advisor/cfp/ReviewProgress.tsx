import React from 'react';
import { CFP_SECTION_ORDER, SECTION_META, type CfpSectionType } from './sectionMeta';
import { STATE_META, type ReviewSummary } from './reviewState';
import type { T } from './primitives';

// Eight cells, one per section — the only place in the app that answers
// "how far through this report am I, and what is standing in the way".
//
// Status is never colour-alone: every cell carries the state word underneath.
// Advisors read this to decide whether to send a report to a client, and a
// red/green dot that a colour-blind reader cannot separate is a bad way to
// make that call.

export default function ReviewProgress({
  summary, current, onSelect, t, compact,
}: {
  summary: ReviewSummary;
  /** highlighted cell — the section being reviewed right now */
  current?: CfpSectionType | null;
  onSelect?: (section: CfpSectionType) => void;
  t: T;
  /** drops the state words; for the tab, where space is tight */
  compact?: boolean;
}) {
  return (
    <div className="flex items-stretch gap-1.5 flex-wrap">
      {CFP_SECTION_ORDER.map((type, i) => {
        const state = summary.states[type];
        const meta = SECTION_META[type];
        const sm = STATE_META[state];
        const active = current === type;
        return (
          <button
            key={type}
            onClick={onSelect ? () => onSelect(type) : undefined}
            disabled={!onSelect}
            title={`${i + 1}. ${t(meta.en, meta.zh)} — ${t(sm.en, sm.zh)}`}
            className={[
              'flex-1 min-w-[86px] text-left rounded-lg border px-2.5 py-2 transition-colors',
              active
                ? 'border-xin-blue bg-xin-blue/[0.04] ring-1 ring-xin-blue/30'
                : 'border-slate-200 bg-white',
              onSelect ? 'hover:border-xin-blue/50 cursor-pointer' : 'cursor-default',
            ].join(' ')}
          >
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${sm.dot}`} />
              <span className="text-[11px] font-semibold text-slate-600 truncate">
                {meta.emoji} {t(meta.en, meta.zh)}
              </span>
            </div>
            {!compact && (
              <div className="text-[10px] text-slate-400 mt-0.5 pl-3.5">{t(sm.en, sm.zh)}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** One-line "5 / 8 定稿" plus, when the gate is shut, exactly what is shutting it. */
export function ReviewGateNote({ summary, t }: { summary: ReviewSummary; t: T }) {
  if (summary.canExport) {
    return (
      <span className="text-xs text-emerald-700 font-semibold">
        ✓ {t('All 8 sections approved — ready to export.', '8 个板块已全部定稿，可以导出。')}
      </span>
    );
  }
  // Named, not hidden behind a tooltip: a disabled button with no visible
  // reason is the single most common way a gate turns into a support ticket.
  const names = summary.blocking
    .map(s => t(SECTION_META[s].en, SECTION_META[s].zh))
    .join(t(', ', '、'));
  return (
    <span className="text-xs text-slate-500">
      {t(
        `${summary.approvedCount}/${summary.total} approved. Still to review: `,
        `已定稿 ${summary.approvedCount}/${summary.total}，待审核：`,
      )}
      <span className="text-amber-700 font-semibold">{names}</span>
    </span>
  );
}
