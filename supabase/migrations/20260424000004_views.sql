-- =========================================================================
-- Views：把前端 larkService.ts 里的计算搬到数据库层
-- Migration: 20260424000004_views.sql
-- =========================================================================
-- VIEW 是"虚拟表"，每次查询时实时计算。适合简单聚合。
-- 复杂计算（XIRR 等）可以做成 Materialized View 按天刷新。
-- =========================================================================

-- -------------------------------------------------------------------------
-- 某客户"最近 N 个月"的收入支出合计（按月）
-- -------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_monthly_cashflow AS
SELECT
  profile_id,
  period_month,
  SUM(CASE WHEN src = 'income'  THEN amount ELSE 0 END) AS total_income,
  SUM(CASE WHEN src = 'expense' THEN amount ELSE 0 END) AS total_expense,
  SUM(CASE WHEN src = 'income'  THEN amount ELSE 0 END)
    - SUM(CASE WHEN src = 'expense' THEN amount ELSE 0 END) AS net_cashflow
FROM (
  SELECT profile_id, period_month, amount, 'income'  AS src FROM incomes
  UNION ALL
  SELECT profile_id, period_month, amount, 'expense' AS src FROM expenses
) t
GROUP BY profile_id, period_month;

-- -------------------------------------------------------------------------
-- 净值快照：当前资产 - 当前负债
-- -------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_current_net_worth AS
SELECT
  p.id AS profile_id,
  COALESCE(a.total_assets, 0)      AS total_assets,
  COALESCE(l.total_liabilities, 0) AS total_liabilities,
  COALESCE(a.total_assets, 0) - COALESCE(l.total_liabilities, 0) AS net_worth
FROM profiles p
LEFT JOIN (
  SELECT profile_id, SUM(value) AS total_assets
  FROM assets GROUP BY profile_id
) a ON a.profile_id = p.id
LEFT JOIN (
  SELECT profile_id, SUM(balance) AS total_liabilities
  FROM liabilities GROUP BY profile_id
) l ON l.profile_id = p.id;

-- -------------------------------------------------------------------------
-- 最近一次 KYC（方便前端直接读"最新版本"）
-- -------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_latest_kyc AS
SELECT DISTINCT ON (profile_id)
  profile_id, id AS kyc_id, version, status, raw_payload, submitted_at
FROM kyc_submissions
ORDER BY profile_id, version DESC;
