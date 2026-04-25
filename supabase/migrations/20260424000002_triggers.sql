-- =========================================================================
-- Triggers & Helper Functions
-- Migration: 20260424000002_triggers.sql
-- =========================================================================
-- 这里只放"自动化"的数据库逻辑：时间戳、审计、用户注册。
-- 业务逻辑（比如算 TWR）放到 VIEW 或 Edge Function，不放 trigger。
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. 自动更新 updated_at 字段
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 批量挂载到所有带 updated_at 的表
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      tbl, tbl
    );
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- 2. 用户注册时自动创建 profiles 行
--    这样前端只要调 supabase.auth.signUp() 就行，不用再写一次 INSERT
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, family_name, given_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'family_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'given_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- -------------------------------------------------------------------------
-- 3. 通用审计 trigger：写入 audit_log
--    想审计哪张表，就给它加一个 trigger 即可
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION write_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  actor UUID;
BEGIN
  actor := auth.uid();   -- 可能为 NULL（系统操作）

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(actor_id, entity_table, entity_id, action, diff)
    VALUES (actor, TG_TABLE_NAME, NEW.id, 'insert', to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(actor_id, entity_table, entity_id, action, diff)
    VALUES (actor, TG_TABLE_NAME, NEW.id, 'update',
            jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW)));
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(actor_id, entity_table, entity_id, action, diff)
    VALUES (actor, TG_TABLE_NAME, OLD.id, 'delete', to_jsonb(OLD));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- 挂到关键业务表（可按需增减）
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER audit_kyc
  AFTER INSERT OR UPDATE OR DELETE ON kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER audit_assets
  AFTER INSERT OR UPDATE OR DELETE ON assets
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER audit_liabilities
  AFTER INSERT OR UPDATE OR DELETE ON liabilities
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER audit_investments
  AFTER INSERT OR UPDATE OR DELETE ON investments
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();
