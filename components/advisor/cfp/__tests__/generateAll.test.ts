import { describe, it, expect } from 'vitest';
import { runGenerateAll } from '../generateAll';
import { CFP_SECTION_ORDER, type CfpSectionType } from '../sectionMeta';

const never = () => false;
const ok = async () => ({ error: null });

describe('一键生成', () => {
  it('runs every section in review order', async () => {
    const seen: CfpSectionType[] = [];
    const r = await runGenerateAll({
      isApproved: never,
      invoke: async (s) => { seen.push(s); return { error: null }; },
    });
    expect(seen).toEqual([...CFP_SECTION_ORDER]);
    expect(r.generated).toEqual([...CFP_SECTION_ORDER]);
  });

  it('never overlaps two generations', async () => {
    // This is the test that matters. Every generate_section call rewrites
    // financial_reports.baseline, so two in flight at once is a lost update:
    // sections end up narrating a budget allocation that was never stored, and
    // each section looks perfectly fine on its own.
    let inFlight = 0;
    let maxInFlight = 0;
    await runGenerateAll({
      isApproved: never,
      invoke: async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight--;
        return { error: null };
      },
    });
    expect(maxInFlight).toBe(1);
  });

  it('leaves approved sections alone instead of overwriting them', async () => {
    const called: CfpSectionType[] = [];
    const r = await runGenerateAll({
      isApproved: (s) => s === 'insurance_planning' || s === 'tax_planning',
      invoke: async (s) => { called.push(s); return { error: null }; },
    });
    expect(r.skipped).toEqual(['insurance_planning', 'tax_planning']);
    expect(called).not.toContain('insurance_planning');
    expect(called).not.toContain('tax_planning');
    expect(r.generated).toHaveLength(6);
  });

  it('keeps going after a failure, and reports which one broke', async () => {
    // A tax outage must not keep the advisor from reviewing legacy planning.
    const r = await runGenerateAll({
      isApproved: never,
      invoke: async (s) =>
        s === 'tax_planning' ? { error: { message: 'Gemini 503' } } : { error: null },
    });
    expect(r.failed).toEqual([{ section: 'tax_planning', message: 'Gemini 503' }]);
    expect(r.generated).toHaveLength(7);
  });

  it('treats a thrown error the same as a returned one', async () => {
    const r = await runGenerateAll({
      isApproved: never,
      invoke: async (s) => {
        if (s === 'goals_planning') throw new Error('network down');
        return { error: null };
      },
    });
    expect(r.failed).toEqual([{ section: 'goals_planning', message: 'network down' }]);
    expect(r.generated).toHaveLength(7);
  });

  it('settles each section before starting the next, so the UI can refresh as it goes', async () => {
    const log: string[] = [];
    await runGenerateAll({
      isApproved: never,
      order: ['cashflow_planning', 'goals_planning'],
      invoke: async (s) => { log.push(`invoke:${s}`); return { error: null }; },
      onStart: (s) => log.push(`start:${s}`),
      onSettled: (s) => { log.push(`settled:${s}`); },
    });
    expect(log).toEqual([
      'start:cashflow_planning', 'invoke:cashflow_planning', 'settled:cashflow_planning',
      'start:goals_planning', 'invoke:goals_planning', 'settled:goals_planning',
    ]);
  });

  it('does not announce a section it is going to skip', async () => {
    const started: CfpSectionType[] = [];
    await runGenerateAll({
      isApproved: (s) => s === 'cashflow_planning',
      order: ['cashflow_planning', 'goals_planning'],
      invoke: ok,
      onStart: (s) => started.push(s),
    });
    expect(started).toEqual(['goals_planning']);
  });

  it('does nothing at all when the whole report is already approved', async () => {
    const r = await runGenerateAll({ isApproved: () => true, invoke: ok });
    expect(r.generated).toEqual([]);
    expect(r.failed).toEqual([]);
    expect(r.skipped).toHaveLength(8);
  });
});
