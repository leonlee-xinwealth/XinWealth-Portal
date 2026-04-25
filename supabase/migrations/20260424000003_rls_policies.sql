-- =========================================================================
-- Row Level Security (RLS) Policies
-- Migration: 20260424000003_rls_policies.sql
-- =========================================================================
-- 核心规则：
--   · client 只能看/改自己的数据（id = auth.uid() 或 profile_id = auth.uid()）
--   · advisor 可以看自己的客户的数据（通过 profiles.advisor_id 关联）
--   · admin 可以看所有数据
--
-- RLS 是 Supabase 最重要的安全机制。开启后没有 policy = 什么都查不到。
-- =========================================================================

-- -------------------------------------------------------------------------
-- 工具函数：判断当前用户角色
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_advisor_of(client_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
     WHERE id = client_id AND advisor_id = auth.uid()
  );
$$;

-- -------------------------------------------------------------------------
-- 开启 RLS
-- -------------------------------------------------------------------------
ALTER TABLE profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_submissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE incomes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE liabilities             ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_policies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_snapshots        ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_states           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log               ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- profiles：看自己 + 顾问看客户 + admin
-- -------------------------------------------------------------------------
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR advisor_id = auth.uid()
    OR is_admin()
  );

CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE
  USING (id = auth.uid() OR is_admin())
  WITH CHECK (id = auth.uid() OR is_admin());

-- 注册时 trigger 自动插入，所以普通 INSERT 不开放给客户端
CREATE POLICY "profiles_insert_admin" ON profiles FOR INSERT
  WITH CHECK (is_admin());

-- -------------------------------------------------------------------------
-- 通用模式：所有 profile_id 挂钩的表
-- 用一个 DO 块批量生成 policy，后面加新表只要再调一次
-- -------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'kyc_submissions', 'incomes', 'expenses',
    'assets', 'liabilities', 'investments', 'investment_transactions',
    'insurance_policies',
    'portfolio_snapshots', 'health_snapshots', 'player_states'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_select" ON %1$I FOR SELECT
        USING (profile_id = auth.uid() OR is_advisor_of(profile_id) OR is_admin());
      CREATE POLICY "%1$s_insert" ON %1$I FOR INSERT
        WITH CHECK (profile_id = auth.uid() OR is_advisor_of(profile_id) OR is_admin());
      CREATE POLICY "%1$s_update" ON %1$I FOR UPDATE
        USING (profile_id = auth.uid() OR is_advisor_of(profile_id) OR is_admin())
        WITH CHECK (profile_id = auth.uid() OR is_advisor_of(profile_id) OR is_admin());
      CREATE POLICY "%1$s_delete" ON %1$I FOR DELETE
        USING (profile_id = auth.uid() OR is_advisor_of(profile_id) OR is_admin());
    $f$, tbl);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- audit_log：只读，只能看自己相关的
-- -------------------------------------------------------------------------
CREATE POLICY "audit_select_own" ON audit_log FOR SELECT
  USING (actor_id = auth.uid() OR is_admin());
