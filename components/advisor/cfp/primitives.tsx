import React from 'react';

// Shared building blocks for CFP section renderers. Editing discipline:
// narrative prose is editable in draft, deterministic numbers are read-only
// (change the client data and regenerate to move a number).

export type T = (en: string, zh: string) => string;

export const fmtRM = (n: number | null | undefined) =>
  n == null ? '—' : `RM ${Number(n).toLocaleString()}`;

export const fmtPct = (n: number | null | undefined, dp = 1) =>
  n == null ? '—' : `${(n * 100).toFixed(dp)}%`;

export function SectionHeading({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <h4 className="text-sm font-bold text-xin-blue border-l-4 border-xin-gold pl-2 mb-2">
      {children}
      {hint && <span className="text-xs font-normal text-slate-400"> ({hint})</span>}
    </h4>
  );
}

/** Editable multi-line narrative field. */
export function NarrativeBlock({
  label, value, onChange, readOnly, rows = 3,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  rows?: number;
}) {
  return (
    <div>
      {label && <label className="text-xs text-slate-500 block mb-1">{label}</label>}
      <textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        disabled={readOnly}
        rows={rows}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-xin-blue disabled:bg-slate-50 disabled:text-slate-500"
      />
    </div>
  );
}

/** The executive-summary row every section narrative carries. */
export function ExecutiveSummaryGrid({
  es, onChange, readOnly, t,
}: {
  es: Record<string, string> | undefined;
  onChange: (key: string, v: string) => void;
  readOnly: boolean;
  t: T;
}) {
  const fields: [string, string][] = [
    ['findings', t('Findings', '发现')],
    ['action_plan', t('Action Plan', '行动计划')],
    ['expected_completion_date', t('Expected Completion Date', '预计完成时间')],
    ['remarks', t('Remarks', '备注')],
  ];
  return (
    <div>
      <SectionHeading>{t('Executive Summary Row', '执行摘要行')}</SectionHeading>
      <div className="grid md:grid-cols-2 gap-3">
        {fields.map(([k, label]) => (
          <NarrativeBlock
            key={k}
            label={label}
            value={es?.[k] ?? ''}
            onChange={v => onChange(k, v)}
            readOnly={readOnly}
            rows={k === 'findings' || k === 'action_plan' ? 3 : 2}
          />
        ))}
      </div>
    </div>
  );
}

/** Editable prioritised recommendation list (same UX as the insurance card). */
export function RecommendationList({
  items, onChange, readOnly, t,
}: {
  items: Array<{ title: string; detail: string; priority: number }>;
  onChange: (items: Array<{ title: string; detail: string; priority: number }>) => void;
  readOnly: boolean;
  t: T;
}) {
  const set = (i: number, k: string, v: string | number) => {
    const arr = [...items];
    arr[i] = { ...arr[i], [k]: v };
    onChange(arr);
  };
  return (
    <div>
      <SectionHeading>{t('Recommendations', '建议')}</SectionHeading>
      <div className="space-y-2">
        {items.map((r, i) => (
          <div key={i} className="flex gap-2 items-start">
            <input
              type="number"
              min={1}
              value={r.priority}
              onChange={e => set(i, 'priority', parseInt(e.target.value) || 1)}
              disabled={readOnly}
              className="w-14 border border-slate-200 rounded-lg px-2 py-2 text-sm text-center shrink-0 disabled:bg-slate-50"
              title={t('Priority', '优先级')}
            />
            <div className="flex-1 space-y-1">
              <input
                value={r.title}
                onChange={e => set(i, 'title', e.target.value)}
                disabled={readOnly}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-xin-blue disabled:bg-slate-50 disabled:text-slate-500"
              />
              <textarea
                value={r.detail}
                onChange={e => set(i, 'detail', e.target.value)}
                disabled={readOnly}
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-xin-blue disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
            {!readOnly && (
              <button
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="text-slate-300 hover:text-red-500 pt-2"
                title={t('Remove', '删除')}
              >✕</button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button
            onClick={() => onChange([...items, { title: '', detail: '', priority: items.length + 1 }])}
            className="text-sm text-xin-blue font-semibold hover:underline"
          >
            + {t('Add recommendation', '添加建议')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Small read-only stat tile for deterministic figures. */
export function StatTile({
  label, value, tone = 'neutral', sub,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
  sub?: string;
}) {
  const toneCls = {
    neutral: 'text-xin-blue',
    good: 'text-emerald-600',
    warn: 'text-amber-600',
    bad: 'text-red-600',
  }[tone];
  return (
    <div className="border border-slate-100 rounded-xl p-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-sm font-bold ${toneCls}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

/** Need-vs-covered gap bar (deterministic, read-only). */
export function GapBar({
  label, need, covered, gap, t,
}: {
  label: string;
  need: number;
  covered: number;
  gap: number;
  t: T;
}) {
  const pct = need > 0 ? Math.min(100, Math.round((covered / need) * 100)) : 100;
  return (
    <div className="border border-slate-100 rounded-xl p-3">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{label}</span>
        <span>{t('Covered', '已覆盖')} {pct}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${gap > 0 ? 'bg-amber-400' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] mt-1">
        <span className="text-slate-400">{t('Need', '需求')} {fmtRM(need)}</span>
        <span className={gap > 0 ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>
          {gap > 0 ? `${t('Gap', '缺口')} ${fmtRM(gap)}` : `✓ ${t('Sufficient', '已足够')}`}
        </span>
      </div>
    </div>
  );
}

export function AssumptionsList({ items }: { items: string[] | undefined }) {
  if (!items?.length) return null;
  return <p className="text-[11px] text-slate-400 mt-2">{items.join(' · ')}</p>;
}

/** Simple read-only key/value table for deterministic rows. */
export function KVTable({
  rows,
}: {
  rows: Array<{ k: string; v: string; strong?: boolean }>;
}) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-50 last:border-0">
            <td className="py-1.5 pr-3 text-slate-500 text-xs">{r.k}</td>
            <td className={`py-1.5 text-right ${r.strong ? 'font-bold text-xin-blue' : ''}`}>{r.v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Generic layman client-view editor (all sections except insurance). */
export function GenericClientViewEditor({
  cv, onChange, readOnly, t,
}: {
  // deno-lint-ignore no-explicit-any
  cv: any;
  onChange: (key: string, v: unknown) => void;
  readOnly: boolean;
  t: T;
}) {
  if (!cv) return null;
  const setItem = (k: string, i: number, field: string, v: string) => {
    const arr = [...(cv[k] || [])];
    arr[i] = { ...arr[i], [field]: v };
    onChange(k, arr);
  };
  const listBlock = (k: string, label: string, titleField: string, plainField: string) =>
    !!(cv[k]?.length) && (
      <div key={k}>
        <label className="text-xs text-slate-500 block mb-1">{label}</label>
        <div className="space-y-2">
          {cv[k].map((item: Record<string, string>, i: number) => (
            <div key={i} className="flex gap-2">
              <input
                value={item[titleField] ?? ''}
                onChange={e => setItem(k, i, titleField, e.target.value)}
                disabled={readOnly}
                className="w-40 shrink-0 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-semibold text-xin-blue disabled:bg-slate-50"
              />
              <textarea
                value={item[plainField] ?? ''}
                onChange={e => setItem(k, i, plainField, e.target.value)}
                disabled={readOnly}
                rows={2}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm disabled:bg-slate-50"
              />
            </div>
          ))}
        </div>
      </div>
    );
  return (
    <div className="space-y-3 pt-1">
      <NarrativeBlock
        label={t('Intro', '引言')}
        value={cv.intro ?? ''}
        onChange={v => onChange('intro', v)}
        readOnly={readOnly}
        rows={2}
      />
      {listBlock('findings_plain', t('Key findings (plain)', '主要发现（通俗）'), 'title', 'plain')}
      {listBlock('recommendations_plain', t('Recommendations (plain)', '建议（通俗）'), 'title', 'plain')}
      {listBlock('glossary', t('Glossary', '术语表'), 'term', 'plain')}
      <NarrativeBlock
        label={t('Disclaimer', '免责声明')}
        value={cv.disclaimer ?? ''}
        onChange={v => onChange('disclaimer', v)}
        readOnly={readOnly}
        rows={2}
      />
    </div>
  );
}
