// 一键生成: run all eight modules for a report.
//
// The loop is deliberately client-side and deliberately sequential. Two
// reasons, both load-bearing:
//
//   Not server-side. Eight LLM calls with their retries in one request sits
//   right at the edge function's wall-clock limit, and a timeout there loses
//   the whole batch with nothing landed. Driven from here, each section lands
//   as its own committed draft, so a failure costs one section and the advisor
//   can resume from where it stopped.
//
//   Never Promise.all. Every generate_section call recomputes and REWRITES
//   financial_reports.baseline. Run in parallel, the last write wins and the
//   sections end up narrated against baselines that no longer exist — the
//   classic lost-update race, except the damage is invisible because every
//   individual section looks fine. Sequential await is what makes the budget
//   waterfall each section quotes the same one that ends up stored.
//
// A single failure does not stop the batch: a tax-planning outage should not
// keep the advisor from reviewing legacy planning.

import { CFP_SECTION_ORDER, type CfpSectionType } from './sectionMeta';

export interface GenerateAllResult {
  generated: CfpSectionType[];
  /** already approved — left untouched rather than silently overwritten */
  skipped: CfpSectionType[];
  failed: Array<{ section: CfpSectionType; message: string }>;
}

export interface GenerateAllOptions {
  /** true when the section is approved and must not be regenerated */
  isApproved: (section: CfpSectionType) => boolean;
  /** resolves with an error rather than throwing, matching supabase-js */
  invoke: (section: CfpSectionType) => Promise<{ error?: { message?: string } | null }>;
  /** fired before each section starts, for the progress label */
  onStart?: (section: CfpSectionType, index: number, total: number) => void;
  /** fired after each section lands, so the caller can refresh as it goes */
  onSettled?: (section: CfpSectionType) => void | Promise<void>;
  order?: readonly CfpSectionType[];
}

export async function runGenerateAll(
  opts: GenerateAllOptions,
): Promise<GenerateAllResult> {
  const order = opts.order ?? CFP_SECTION_ORDER;
  const result: GenerateAllResult = { generated: [], skipped: [], failed: [] };

  for (let i = 0; i < order.length; i++) {
    const section = order[i];
    if (opts.isApproved(section)) {
      result.skipped.push(section);
      continue;
    }
    opts.onStart?.(section, i, order.length);
    try {
      const { error } = await opts.invoke(section);
      if (error) {
        result.failed.push({ section, message: error.message ?? 'Unknown error' });
      } else {
        result.generated.push(section);
      }
    } catch (e) {
      result.failed.push({
        section,
        message: (e as Error)?.message ?? 'Unknown error',
      });
    }
    await opts.onSettled?.(section);
  }

  return result;
}
