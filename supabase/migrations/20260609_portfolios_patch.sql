-- Patch: fix portfolio_history RLS policy and add missing indexes

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "read_portfolio_history" ON portfolio_history;

-- Re-create with proper identity check (client path)
CREATE POLICY "clients_read_portfolio_history" ON portfolio_history
  FOR SELECT USING (
    portfolio_id IN (
      SELECT id FROM portfolios
      WHERE client_id IN (
        SELECT id FROM clients
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- Advisor path
CREATE POLICY "advisors_read_portfolio_history" ON portfolio_history
  FOR SELECT USING (
    portfolio_id IN (
      SELECT p.id FROM portfolios p
      JOIN clients c ON c.id = p.client_id
      JOIN advisors a ON a.id = c.advisor_id
      WHERE a.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Missing indexes
CREATE INDEX IF NOT EXISTS idx_portfolios_client_id ON portfolios(client_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_history_portfolio_id ON portfolio_history(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_history_snapshot_date ON portfolio_history(snapshot_date);
