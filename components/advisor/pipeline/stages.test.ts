import { describe, it, expect } from 'vitest';
import { getLeadSource, LEAD_SOURCES } from './stages';

describe('website_quiz lead source', () => {
  it('exists in LEAD_SOURCES with bilingual labels', () => {
    const src = LEAD_SOURCES.find(s => s.key === 'website_quiz');
    expect(src).toBeDefined();
    expect(src!.zh).toBe('网站测评');
    expect(src!.en).toBe('Website Quiz');
  });
  it('getLeadSource resolves website_quiz', () => {
    expect(getLeadSource('website_quiz')?.zh).toBe('网站测评');
  });
});
