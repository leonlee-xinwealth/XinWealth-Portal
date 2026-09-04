import { describe, it, expect } from 'vitest';
import {
  nextPending,
  reviewStateOf,
  summarizeReview,
  type ReviewSection,
} from '../reviewState';
import { CFP_SECTION_ORDER } from '../sectionMeta';

const NOW = new Date('2026-08-20T12:00:00Z').getTime();

function section(over: Partial<ReviewSection> = {}): ReviewSection {
  return {
    section_type: 'cashflow_planning',
    status: 'draft',
    content: { version: 1 },
    error: null,
    updated_at: new Date(NOW - 1000).toISOString(),
    input_fingerprint: 'abc',
    stale_reason: null,
    stale_at: null,
    ...over,
  };
}

describe('a section\'s place in the review flow', () => {
  it('has nothing to review before it is generated', () => {
    expect(reviewStateOf(null, NOW)).toBe('missing');
    expect(reviewStateOf(section({ content: null, status: 'draft' }), NOW)).toBe('missing');
  });

  it('shows a fresh run as in flight', () => {
    expect(reviewStateOf(section({ status: 'generating' }), NOW)).toBe('generating');
  });

  it('releases a run that has been stuck far past any plausible runtime', () => {
    // Otherwise a crashed invocation leaves the section on a spinner with no
    // buttons — permanently unreachable.
    const stuck = section({
      status: 'generating',
      content: null,
      updated_at: new Date(NOW - 10 * 60 * 1000).toISOString(),
    });
    expect(reviewStateOf(stuck, NOW)).toBe('failed');
  });

  it('keeps a surviving draft visible when a rerun failed or hung', () => {
    // The server deliberately leaves content in place on failure; treating the
    // row as ungenerated here would undo that and show an empty screen.
    expect(reviewStateOf(section({ status: 'failed' }), NOW)).toBe('draft');
    expect(
      reviewStateOf(
        section({ status: 'generating', updated_at: new Date(NOW - 10 * 60 * 1000).toISOString() }),
        NOW,
      ),
    ).toBe('draft');
  });

  it('separates a plain draft from one whose basis moved', () => {
    expect(reviewStateOf(section(), NOW)).toBe('draft');
    expect(reviewStateOf(section({ stale_reason: 'basis_changed' }), NOW)).toBe('stale');
  });

  it('reports an approved section as approved', () => {
    expect(reviewStateOf(section({ status: 'approved' }), NOW)).toBe('approved');
  });
});

describe('the export gate', () => {
  const allApproved = CFP_SECTION_ORDER.map(t =>
    section({ section_type: t, status: 'approved' }));

  it('opens only when every one of the eight is approved', () => {
    const s = summarizeReview(allApproved, NOW);
    expect(s.approvedCount).toBe(8);
    expect(s.canExport).toBe(true);
    expect(s.blocking).toEqual([]);
  });

  it('closes on a single outstanding section and names it', () => {
    const one = allApproved.map(s =>
      s.section_type === 'tax_planning' ? { ...s, status: 'draft' as const } : s);
    const s = summarizeReview(one, NOW);
    expect(s.canExport).toBe(false);
    expect(s.blocking).toEqual(['tax_planning']);
  });

  it('counts a section that was demoted for a changed basis as outstanding', () => {
    // The whole point of demoting it: the gate has to close again.
    const staled = allApproved.map(s =>
      s.section_type === 'retirement_planning'
        ? { ...s, status: 'draft' as const, stale_reason: 'basis_changed' }
        : s);
    const s = summarizeReview(staled, NOW);
    expect(s.states.retirement_planning).toBe('stale');
    expect(s.canExport).toBe(false);
  });

  it('treats an empty report as eight outstanding sections, not as ready', () => {
    const s = summarizeReview([], NOW);
    expect(s.blocking).toEqual([...CFP_SECTION_ORDER]);
    expect(s.canExport).toBe(false);
    expect(s.hasAnyContent).toBe(false);
  });

  it('lists outstanding sections in review order, not database order', () => {
    const shuffled = [
      section({ section_type: 'financial_health', status: 'draft' }),
      section({ section_type: 'cashflow_planning', status: 'draft' }),
    ];
    expect(summarizeReview(shuffled, NOW).blocking).toEqual([...CFP_SECTION_ORDER]);
  });

  it('notices content even while nothing is approved, so a draft preview can be offered', () => {
    expect(summarizeReview([section()], NOW).hasAnyContent).toBe(true);
  });
});

describe('approve and continue', () => {
  const drafts = CFP_SECTION_ORDER.map(t => section({ section_type: t }));

  it('advances to the next section that still needs attention', () => {
    const s = summarizeReview(drafts, NOW);
    expect(nextPending(s, 'cashflow_planning')).toBe('goals_planning');
  });

  it('wraps around to pick up sections skipped earlier', () => {
    const one = drafts.map(d =>
      d.section_type === 'goals_planning' ? d : { ...d, status: 'approved' as const });
    const s = summarizeReview(one, NOW);
    expect(nextPending(s, 'legacy_planning')).toBe('goals_planning');
  });

  it('returns null once nothing is left, so the page can send the advisor to export', () => {
    const s = summarizeReview(
      drafts.map(d => ({ ...d, status: 'approved' as const })), NOW);
    expect(nextPending(s, 'cashflow_planning')).toBeNull();
  });

  it('does not point back at the section just approved when it is the only one left', () => {
    const one = drafts.map(d =>
      d.section_type === 'tax_planning' ? d : { ...d, status: 'approved' as const });
    expect(nextPending(summarizeReview(one, NOW), 'tax_planning')).toBeNull();
  });
});
