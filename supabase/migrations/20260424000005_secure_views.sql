-- =========================================================================
-- 让 views 尊重调用者的 RLS
-- Migration: 20260424000005_secure_views.sql
-- =========================================================================
-- Postgres 15+ 的特性：security_invoker = on 让 view 按"谁查"的权限过滤，
-- 而不是"谁建"。Supabase 控制台里的 UNRESTRICTED 警告说的就是这个。
-- =========================================================================

ALTER VIEW v_monthly_cashflow   SET (security_invoker = on);
ALTER VIEW v_current_net_worth  SET (security_invoker = on);
ALTER VIEW v_latest_kyc         SET (security_invoker = on);
