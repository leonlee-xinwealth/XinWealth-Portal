import React, { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { SECTION_META, type CfpSectionType } from './sectionMeta';
import { runGenerateAll, type GenerateAllResult } from './generateAll';
import { TwoStepButton, type T } from './primitives';
import type { ReviewSummary } from './reviewState';

// 一键生成. The sequencing rules and why they matter live in generateAll.ts;
// this component is the button, the progress label and the summary.

export default function GenerateAllButton({
  reportId, summary, t, onSectionDone, onFinished,
}: {
  reportId: string;
  summary: ReviewSummary;
  t: T;
  /** called after each section lands, so the page can refresh incrementally */
  onSectionDone: () => Promise<void> | void;
  onFinished?: (r: GenerateAllResult) => void;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ section: CfpSectionType; i: number; n: number } | null>(null);
  const [result, setResult] = useState<GenerateAllResult | null>(null);

  const pendingCount = summary.blocking.length;

  async function run() {
    setRunning(true);
    setResult(null);
    const r = await runGenerateAll({
      isApproved: (s) => summary.states[s] === 'approved',
      invoke: (section) =>
        supabase.functions.invoke('cfp-brain', {
          body: { mode: 'generate_section', report_id: reportId, section_type: section },
        }),
      onStart: (section, i, n) => setProgress({ section, i, n }),
      onSettled: () => onSectionDone(),
    });
    setProgress(null);
    setRunning(false);
    setResult(r);
    onFinished?.(r);
  }

  const label = t(
    `Generate all ${pendingCount} outstanding sections`,
    `一键生成剩余 ${pendingCount} 个板块`,
  );

  return (
    <div className="space-y-2">
      <TwoStepButton
        label={<>🧠 {label}</>}
        confirmLabel={
          <>🧠 {t(
            `Run ${pendingCount} generations? (~${pendingCount * 20}s)`,
            `确认生成 ${pendingCount} 个板块？约 ${pendingCount * 20} 秒`,
          )}</>
        }
        onConfirm={run}
        disabled={running || pendingCount === 0}
        className="bg-xin-blue text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-blueLight transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {running && progress && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-xin-blue" />
          {t(
            `${progress.i + 1}/${progress.n} · ${SECTION_META[progress.section].en}…`,
            `${progress.i + 1}/${progress.n} · ${SECTION_META[progress.section].zh}…`,
          )}
          <span className="text-slate-300">
            {t('one at a time, so the shared budget stays consistent', '逐个执行，确保共用预算一致')}
          </span>
        </div>
      )}

      {result && !running && <ResultSummary r={result} t={t} />}
    </div>
  );
}

function ResultSummary({ r, t }: { r: GenerateAllResult; t: T }) {
  const parts: string[] = [
    t(`${r.generated.length} generated`, `已生成 ${r.generated.length}`),
  ];
  if (r.skipped.length) {
    parts.push(t(`${r.skipped.length} skipped (approved)`, `跳过 ${r.skipped.length}（已定稿）`));
  }
  const names = r.failed
    .map(f => t(SECTION_META[f.section].en, SECTION_META[f.section].zh))
    .join(t(', ', '、'));

  return (
    <div
      className={`text-xs px-3 py-2 rounded-lg ${
        r.failed.length ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'
      }`}
    >
      {parts.join(t(' · ', ' · '))}
      {r.failed.length > 0 && (
        <>
          {t(' · failed: ', ' · 失败：')}
          <span className="font-semibold">{names}</span>
          {/* The batch deliberately continues past a failure, so the advisor
              has to be told which one to retry — otherwise a single outage
              silently leaves a hole in the report. */}
          <div className="mt-1 text-amber-700">
            {r.failed.map(f => (
              <div key={f.section}>
                {t(SECTION_META[f.section].en, SECTION_META[f.section].zh)}: {f.message}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
