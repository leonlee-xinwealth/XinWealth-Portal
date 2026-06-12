// pdf/__tests__/fillEngine.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { buildDataForPdf, mergePdfs, ALL_PRS_MAPPINGS } from '../generatePrsPack';
import { samplePrsData } from '../sampleData';
import { fillForm, resolveValue } from '../fillEngine';
import type { FormMapping } from '../mappingTypes';
import { initialPrsFormData, type PrsFormData } from '../../types/prs';

const data: PrsFormData = {
  ...initialPrsFormData,
  full_name: 'Tan Ah Kow',
  nric: '900101-14-5678',
  date_of_birth: '1990-01-01',
  gender: 'male',
  nominees: initialPrsFormData.nominees.map((n, i) =>
    i === 0 ? { ...n, name: 'Tan Mei Mei', percentage: '100' } : n),
};

const mapping: FormMapping = {
  id: 'declaration', templateFile: 'declaration.pdf',
  labelEn: 'Test', labelZh: '测试', version: 'test',
  recommendedKeys: ['full_name'],
  fields: [
    { key: 'full_name', page: 1, x: 100, y: 200, maxWidth: 200 },
    { type: 'comb', key: 'nric', page: 1, x: 100, y: 180, cellWidth: 14, cells: 12, strip: /[\s-]/g },
    { type: 'checkbox', key: 'gender', page: 1, x: 100, y: 160, when: d => d.gender === 'male' },
    { type: 'date-split', key: 'date_of_birth', page: 1, x: 100, y: 140, cellWidth: 14 },
    { key: 'nominees.0.name', page: 1, x: 100, y: 120 },
  ],
};

describe('resolveValue', () => {
  it('顶层键', () => expect(resolveValue(data, 'full_name')).toBe('Tan Ah Kow'));
  it('点路径', () => expect(resolveValue(data, 'nominees.0.percentage')).toBe('100'));
  it('空值返回空字符串', () => expect(resolveValue(data, 'email')).toBe(''));
  it('returns empty string for boolean values', () => {
    const boolData = { ...data, rsp_enabled: true } as any;
    expect(resolveValue(boolData, 'rsp_enabled')).toBe('');
  });
});

describe('fillForm', () => {
  it('用真实模板填充不抛错且产出有效 PDF', async () => {
    const tpl = readFileSync('public/forms/prs/declaration.pdf');
    const { bytes, warnings } = await fillForm(tpl, mapping, data);
    expect(warnings).toEqual([]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
  });

  it('页码越界产生警告而非抛错', async () => {
    const tpl = readFileSync('public/forms/prs/declaration.pdf');
    const bad: FormMapping = { ...mapping, fields: [{ key: 'full_name', page: 99, x: 0, y: 0 }] };
    const { warnings } = await fillForm(tpl, bad, data);
    expect(warnings.length).toBe(1);
  });

  it('文字超长且缩到下限仍放不下时警告', async () => {
    const tpl = readFileSync('public/forms/prs/declaration.pdf');
    const longData = { ...data, full_name: 'X'.repeat(200) };
    const tight: FormMapping = { ...mapping, fields: [{ key: 'full_name', page: 1, x: 100, y: 200, maxWidth: 30 }] };
    const { warnings } = await fillForm(tpl, tight, longData);
    expect(warnings.length).toBe(1);
  });

  it('comb 格数不足时警告含 截断', async () => {
    const tpl = readFileSync('public/forms/prs/declaration.pdf');
    // nric 去掉分隔符后有 12 个字符，但只给 3 格 → 触发截断警告
    const combMapping: FormMapping = {
      ...mapping,
      fields: [{ type: 'comb', key: 'nric', page: 1, x: 100, y: 180, cellWidth: 14, cells: 3, strip: /[\s-]/g }],
    };
    const { warnings } = await fillForm(tpl, combMapping, data);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('截断');
  });

  it('date-split 日期格式无效时警告含 日期格式无效 且不抛错', async () => {
    const tpl = readFileSync('public/forms/prs/declaration.pdf');
    const badDateData = { ...data, date_of_birth: 'not-a-date' };
    const dateMapping: FormMapping = {
      ...mapping,
      fields: [{ type: 'date-split', key: 'date_of_birth', page: 1, x: 100, y: 140, cellWidth: 14 }],
    };
    const { warnings } = await fillForm(tpl, dateMapping, badDateData);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('日期格式无效');
  });
});

// ── Task 11 additions ──

describe('buildDataForPdf', () => {
  it('injects __isa_total derived key', () => {
    // samplePrsData: isa_q1=3, q2=3, q3=3, q4=3, q5=5, q6=3 → total 20
    const d = buildDataForPdf(samplePrsData);
    expect((d as any).__isa_total).toBe('20');
  });

  it('flattens dim_allocations into __dim_pct_* keys', () => {
    const withDim = {
      ...samplePrsData,
      dim_allocations: [{ fund: 'Principal RetireEasy 2050', percent: '100' }],
    };
    const d = buildDataForPdf(withDim);
    expect((d as any).__dim_pct_principal_retireeasy_2050).toBe('100');
  });

  it('leaves __isa_total empty string when any ISA question is blank', () => {
    const noScore = { ...samplePrsData, isa_q1_age: '' as const };
    const d = buildDataForPdf(noScore);
    expect((d as any).__isa_total).toBe('');
  });
});

describe('mergePdfs', () => {
  it('merged page count equals sum of all form page counts', async () => {
    // acc-opening=12, isa-individual=3, ppa-nomination=4, declaration=2, top-up=2 → total 23
    const enriched = buildDataForPdf(samplePrsData);
    const all = await Promise.all(
      ALL_PRS_MAPPINGS.map(async m => {
        const tpl = readFileSync(`public/forms/prs/${m.templateFile}`);
        return (await fillForm(tpl, m, enriched)).bytes;
      }),
    );
    const merged = await mergePdfs(all);
    const doc = await PDFDocument.load(merged);
    expect(doc.getPageCount()).toBe(23);
  });
});
