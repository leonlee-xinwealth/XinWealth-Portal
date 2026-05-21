-- =========================================================================
-- Phase 0: audit_log compatibility with the production schema
-- =========================================================================

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'view_sensitive_field';

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
    old_record,
    new_record,
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
    op::audit_action,
    old_json,
    new_json,
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
    old_record,
    new_record,
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
    'view_sensitive_field'::audit_action,
    NULL,
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
