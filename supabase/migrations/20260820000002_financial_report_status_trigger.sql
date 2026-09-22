-- Review pipeline, part 2: make financial_reports.status mean something.
--
-- The column has existed since the first migration and nothing has ever written
-- it — every report sits at 'in_progress' forever. The obvious fix is to set it
-- from the export handler, but that only holds until a second export path shows
-- up (the draft preview already is one), at which point it silently goes back
-- to being decorative.
--
-- Deriving it from the section rows instead means it cannot drift: the same
-- condition the export gate checks in the UI is the condition that sets the
-- column, and it re-evaluates on approve, on reopen, on regenerate, and on the
-- staleness sweep withdrawing an approval — including from the edge function's
-- service-role writes, which never touch the UI.

create or replace function public.sync_financial_report_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid           uuid;
  approved_count int;
  next_status   text;
begin
  rid := coalesce(new.report_id, old.report_id);
  if rid is null then
    return null;
  end if;

  -- The eight CFP sections and only those. 'asset_allocation' is retired but
  -- may still exist on old rows, and it must not count toward completion.
  select count(*) into approved_count
  from public.report_sections
  where report_id = rid
    and status = 'approved'
    and section_type in (
      'cashflow_planning','goals_planning','insurance_planning',
      'investment_planning','retirement_planning','tax_planning',
      'legacy_planning','financial_health');

  next_status := case when approved_count >= 8 then 'completed' else 'in_progress' end;

  update public.financial_reports
     set status = next_status
   where id = rid
     and status is distinct from next_status;

  return null;
end;
$$;

comment on function public.sync_financial_report_status() is
  'Derives financial_reports.status from its section rows: completed once all 8 CFP sections are approved, in_progress otherwise. Do not write the column directly.';

drop trigger if exists report_sections_sync_report_status on public.report_sections;

create trigger report_sections_sync_report_status
  after insert or update or delete on public.report_sections
  for each row execute function public.sync_financial_report_status();

-- Backfill: reports whose sections are already all approved should not have to
-- wait for the next edit to catch up.
update public.financial_reports fr
   set status = 'completed'
 where fr.status <> 'completed'
   and (
     select count(*) from public.report_sections rs
      where rs.report_id = fr.id
        and rs.status = 'approved'
        and rs.section_type in (
          'cashflow_planning','goals_planning','insurance_planning',
          'investment_planning','retirement_planning','tax_planning',
          'legacy_planning','financial_health')
   ) >= 8;
