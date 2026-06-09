-- supabase/migrations/20260609_portfolios.sql

-- 1. portfolios metadata table
CREATE TABLE IF NOT EXISTS portfolios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'SGD',
  capital_injection NUMERIC(15,2) NOT NULL DEFAULT 0,
  injection_date   DATE NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. portfolio_history monthly snapshot table
CREATE TABLE IF NOT EXISTS portfolio_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id  UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  end_value     NUMERIC(15,2) NOT NULL,
  cashflow      NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, snapshot_date)
);

-- 3. RLS
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_history ENABLE ROW LEVEL SECURITY;

-- clients read their own portfolios (email fallback, no auth_user_id on clients)
CREATE POLICY "clients_read_own_portfolios" ON portfolios
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- advisors read portfolios for their clients (advisors has no auth_user_id, use email)
CREATE POLICY "advisors_read_portfolios" ON portfolios
  FOR SELECT USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN advisors a ON a.id = c.advisor_id
      WHERE a.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- portfolio_history readable if the parent portfolio is readable
CREATE POLICY "read_portfolio_history" ON portfolio_history
  FOR SELECT USING (
    portfolio_id IN (SELECT id FROM portfolios)
  );
