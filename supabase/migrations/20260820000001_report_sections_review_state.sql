-- Review pipeline, part 1: give every section row enough state to answer
-- "is what the advisor approved still true?"
--
-- The 29-page report is only trustworthy if the prose the advisor signed off on
-- still describes the numbers being printed. Regenerating ANY section
-- recomputes the shared baseline — including 首席规划师's budget waterfall, which
-- reallocates the client's surplus across all eight sections. So approving
-- 退休规划 and later regenerating 现金流 can leave the approved retirement prose
-- quoting a budget line that no longer exists. The numbers are recomputed every
-- time and stay correct; the sentence the client reads is what goes wrong.
--
-- input_fingerprint records exactly what fed the section's prompt. staleness.ts
-- recomputes it after every generation and flips changed sections back to draft.
--
-- Pure additive: no defaults, no backfill. A null fingerprint means "unknown
-- provenance" and is NEVER auto-flipped — that is the compatibility gate for
-- every section approved before this migration.

alter table public.report_sections
  add column input_fingerprint text,
  add column stale_reason      text
    check (stale_reason is null or stale_reason in ('basis_changed')),
  add column stale_at          timestamptz,
  add column approved_by       uuid references public.advisors(id);

comment on column public.report_sections.input_fingerprint is
  'sha256 of the deterministic inputs behind this section''s narrative (its own det, its budget line, household demographics). Null = generated before the review pipeline; never auto-staled.';
comment on column public.report_sections.stale_reason is
  'Set when the basis moved under an approved section. Cleared on regenerate or re-approve.';
comment on column public.report_sections.approved_by is
  'Advisor who approved. Set alongside approved_at; both cleared when a section is staled or reopened.';
