-- =========================================================================
-- Phase 0: Compliance & Data Hygiene
-- =========================================================================

-- Keep the existing audit_log shape working while adding the fields required
-- by the Phase 0 acceptance checklist.
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS table_name TEXT,
  ADD COLUMN IF NOT EXISTS record_id UUID,
  ADD COLUMN IF NOT EXISTS operation TEXT,
  ADD COLUMN IF NOT EXISTS changed_by UUID,
  ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS old_values JSONB,
  ADD COLUMN IF NOT EXISTS new_values JSONB;

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_operation_check
  CHECK (
    operation IS NULL
    OR operation IN ('insert', 'update', 'delete', 'view_sensitive_field')
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record
  ON audit_log(table_name, record_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by
  ON audit_log(changed_by, changed_at DESC);

CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID;
  row_id UUID;
  op TEXT;
  old_json JSONB;
  new_json JSONB;
BEGIN
  actor := auth.uid();
  op := lower(TG_OP);
  old_json := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  new_json := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  row_id := COALESCE((new_json->>'id')::UUID, (old_json->>'id')::UUID);

  INSERT INTO audit_log(
    actor_id,
    entity_table,
    entity_id,
    action,
    diff,
    occurred_at,
    table_name,
    record_id,
    operation,
    changed_by,
    changed_at,
    old_values,
    new_values
  )
  VALUES (
    actor,
    TG_TABLE_NAME,
    row_id,
    op,
    jsonb_build_object('before', old_json, 'after', new_json),
    NOW(),
    TG_TABLE_NAME,
    row_id,
    op,
    actor,
    NOW(),
    old_json,
    new_json
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'clients',
    'assets',
    'liabilities',
    'insurance_policies',
    'investment_accounts',
    'cashflow_entries'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I', tbl, tbl);
      EXECUTE format(
        'CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.write_audit_log()',
        tbl,
        tbl
      );
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.log_sensitive_field_access(
  p_client_id UUID,
  p_field_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID;
  allowed BOOLEAN;
BEGIN
  actor := auth.uid();
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_field_name NOT IN ('nric', 'bank_account_number') THEN
    RAISE EXCEPTION 'Unsupported sensitive field: %', p_field_name;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM advisors a
    JOIN clients c ON c.advisor_id = a.id
    WHERE a.user_id = actor
      AND c.id = p_client_id
  ) INTO allowed;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Not allowed to view this client field';
  END IF;

  INSERT INTO audit_log(
    actor_id,
    entity_table,
    entity_id,
    action,
    diff,
    occurred_at,
    table_name,
    record_id,
    operation,
    changed_by,
    changed_at,
    old_values,
    new_values
  )
  VALUES (
    actor,
    'clients',
    p_client_id,
    'view_sensitive_field',
    jsonb_build_object('field', p_field_name),
    NOW(),
    'clients',
    p_client_id,
    'view_sensitive_field',
    actor,
    NOW(),
    NULL,
    jsonb_build_object('field', p_field_name)
  );
END;
$$;
