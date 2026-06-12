// pdf/__tests__/fillEngine.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
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
});
