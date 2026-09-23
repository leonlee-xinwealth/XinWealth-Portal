-- CFP P3 — fold investment accounts and portfolios into assets (data only; idempotent).
-- Spec: docs/superpowers/specs/2026-09-26-cfp-p3-assets-portfolio-design.md 决策 1–2
-- APPLY ONLY AFTER the P3 code is deployed (Vercel + cfp-brain): the old code adds portfolio_holdings
-- on top of assets, so creating an asset for an account before then would count it twice.
-- Requires 20260926000002_asset_valuations.sql (its trigger records each new asset's first valuation).

-- 1. Every investment account without an asset gets one, valued at its latest holdings snapshot.
with latest as (
  select h.account_id, h.snapshot_month, sum(h.market_value) as value, sum(h.cost_basis) as cost
  from public.portfolio_holdings h
  where h.snapshot_month = (select max(h2.snapshot_month) from public.portfolio_holdings h2 where h2.account_id = h.account_id)
  group by h.account_id, h.snapshot_month
),
created as (
  insert into public.assets (client_id, asset_type, name, institution, account_number, current_value, cost_value,
                             currency, valuation_date, needs_review, review_reason, metadata)
  select a.client_id,
         (case
            when a.account_type ilike '%prs%' then 'prs'
            when a.account_type ilike '%unit%' or a.account_type ilike 'ut%' then 'unit_trust'
            when a.account_type ilike '%stock%' or a.account_type ilike '%share%' then 'stock'
            else 'other'
          end)::public.asset_type,
         coalesce(nullif(a.account_name, ''), nullif(a.platform, ''), '投资账户'),
         a.platform, a.account_number,
         coalesce(l.value, 0), l.cost, coalesce(a.currency, 'MYR'),
         coalesce(l.snapshot_month, a.opened_date, current_date),
         true, '由投资账户补建，请确认资产类型',
         jsonb_build_object('migrated_from_account', a.id, 'is_investment', true)
  from public.investment_accounts a
  left join latest l on l.account_id = a.id
  where a.asset_id is null
  returning id, (metadata->>'migrated_from_account')::uuid as account_id
)
update public.investment_accounts a
set asset_id = c.id
from created c
where a.id = c.account_id;

-- 2. Each holdings snapshot becomes a valuation of the account's asset.
insert into public.asset_valuations (asset_id, client_id, valuation_date, value, source, note)
select a.asset_id, a.client_id, h.snapshot_month, sum(h.market_value), 'migrated', '由持仓快照迁移'
from public.portfolio_holdings h
join public.investment_accounts a on a.id = h.account_id
where a.asset_id is not null
group by a.asset_id, a.client_id, h.snapshot_month
on conflict (asset_id, valuation_date) do update
  set source = 'migrated', value = excluded.value, note = excluded.note
  where public.asset_valuations.source = 'auto';

-- 3. Each portfolio becomes a unit-trust asset valued at its latest history point.
insert into public.assets (client_id, asset_type, name, current_value, cost_value, currency, valuation_date,
                           needs_review, review_reason, metadata)
select p.client_id, 'unit_trust'::public.asset_type, p.name,
       coalesce(h.end_value, p.capital_injection, 0), p.capital_injection, coalesce(p.currency, 'MYR'),
       coalesce(h.snapshot_date, p.injection_date, current_date),
       true, '由投资组合迁移，请确认资产类型',
       jsonb_build_object('migrated_from_portfolio', p.id, 'is_investment', true)
from public.portfolios p
left join lateral (
  select ph.end_value, ph.snapshot_date from public.portfolio_history ph
  where ph.portfolio_id = p.id order by ph.snapshot_date desc limit 1
) h on true
where not exists (
  select 1 from public.assets x where x.metadata->>'migrated_from_portfolio' = p.id::text
);

-- 4. Portfolio history becomes that asset's valuations (top-ups kept for time-weighted return).
insert into public.asset_valuations (asset_id, client_id, valuation_date, value, net_contribution, source, note)
select x.id, x.client_id, ph.snapshot_date, ph.end_value, coalesce(ph.cashflow, 0), 'migrated', '由投资组合历史迁移'
from public.portfolio_history ph
join public.assets x on x.metadata->>'migrated_from_portfolio' = ph.portfolio_id::text
where ph.end_value is not null
on conflict (asset_id, valuation_date) do update
  set source = 'migrated', value = excluded.value, net_contribution = excluded.net_contribution, note = excluded.note
  where public.asset_valuations.source = 'auto';

-- 5. Every other asset gets a first valuation at its current value.
insert into public.asset_valuations (asset_id, client_id, valuation_date, value, source, note)
select x.id, x.client_id, coalesce(x.valuation_date, x.updated_at::date, current_date), x.current_value, 'migrated', '初始估值'
from public.assets x
where x.current_value is not null and x.current_value >= 0
on conflict (asset_id, valuation_date) do nothing;
