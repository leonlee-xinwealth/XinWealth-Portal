import { describe, it, expect } from 'vitest';
import { fitTextSize, combChars, splitDateDDMMYYYY, MIN_FONT_SIZE } from '../textFit';

describe('fitTextSize', () => {
  // 宽度模型：每字符 0.5*size pt
  const widthAt = (text: string) => (size: number) => text.length * 0.5 * size;

  it('放得下时返回原字号', () => {
    expect(fitTextSize(widthAt('abc'), 9, 100)).toBe(9);
  });
  it('放不下时逐级缩小', () => {
    // 40 字符 * 0.5 * 9 = 180 > 100 → 需要 size <= 5 → 低于下限
    expect(fitTextSize(widthAt('a'.repeat(40)), 9, 100)).toBeNull();
    // 24 字符: size=8.5 → 102 > 100; size=8 → 96 ✓
    expect(fitTextSize(widthAt('a'.repeat(24)), 9, 100)).toBe(8);
  });
  it('下限为 MIN_FONT_SIZE', () => {
    expect(MIN_FONT_SIZE).toBe(6);
  });
});

describe('combChars', () => {
  it('默认原样拆字符', () => {
    expect(combChars('AB12')).toEqual(['A', 'B', '1', '2']);
  });
  it('strip 清洗 NRIC 连字符与空格', () => {
    expect(combChars('990101-14-1234', /[\s-]/g)).toEqual([...'990101141234']);
  });
});

describe('splitDateDDMMYYYY', () => {
  it('ISO 日期转 DDMMYYYY 字符', () => {
    expect(splitDateDDMMYYYY('1990-01-05')).toBe('05011990');
  });
  it('非法输入返回 null', () => {
    expect(splitDateDDMMYYYY('')).toBeNull();
    expect(splitDateDDMMYYYY('05/01/1990')).toBeNull();
  });
});
