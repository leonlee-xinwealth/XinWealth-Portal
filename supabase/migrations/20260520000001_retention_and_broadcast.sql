-- =========================================================================
-- Sprint 5/6: Retention & Broadcast
-- Migration: 20260520000001_retention_and_broadcast.sql
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- Part 1: last_contacted_at (Retention)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

-- Trigger: whenever a client_note is inserted, update last_contacted_at
CREATE OR REPLACE FUNCTION update_last_contacted_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE clients
    SET last_contacted_at = NOW()
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_client_note_inserted ON client_notes;
CREATE TRIGGER on_client_note_inserted
  AFTER INSERT ON client_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_last_contacted_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Part 2: broadcasts table (Sprint 6, defined here so it ships in one migration)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcasts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advisor_id       UUID NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  content          TEXT NOT NULL,
  recipient_filter JSONB NOT NULL DEFAULT '{"type":"all"}'::jsonb,
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'sent', 'scheduled')),
  scheduled_at     TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  recipient_count  INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_advisor
  ON broadcasts(advisor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled
  ON broadcasts(status, scheduled_at)
  WHERE status = 'scheduled';

CREATE TRIGGER broadcasts_updated_at
  BEFORE UPDATE ON broadcasts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
