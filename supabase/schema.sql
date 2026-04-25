-- Enable pgcrypto for UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables to recreate with new schema
DROP TABLE IF EXISTS public.monthly_snapshots CASCADE;
DROP TABLE IF EXISTS public.insurance CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.investments CASCADE;
DROP TABLE IF EXISTS public.networth CASCADE;
DROP TABLE IF EXISTS public.incomes CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;

-- Create clients table
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  family_name text,
  given_name text,
  email text UNIQUE NOT NULL,
  nric text,
  contact_number text,
  date_of_birth date,
  age int,
  retirement_age int,
  gender text,
  marital_status text,
  nationality text,
  residency text,
  occupation text,
  employment_status text,
  tax_status text,
  advisor text,
  epf_account_number text,
  ppa_account_number text,
  correspondence_address text,
  correspondence_city text,
  correspondence_state text,
  correspondence_postal_code text,
  pdpa_accepted boolean DEFAULT false,
  submission_date timestamptz DEFAULT now(),
  custom_fields jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create incomes table
CREATE TABLE public.incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text,
  amount numeric NOT NULL,
  month int NOT NULL,
  year int NOT NULL,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create networth table
CREATE TABLE public.networth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type in ('Asset','Liability')),
  category text NOT NULL,
  description text,
  value numeric NOT NULL,
  original_purchase_price numeric,
  original_loan_amount numeric,
  month int NOT NULL,
  year int NOT NULL,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create investments table
CREATE TABLE public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text,
  amount numeric NOT NULL,
  end_value numeric,
  cashflow numeric,
  fd_comparison numeric,
  invested_date date,
  month int NOT NULL,
  year int NOT NULL,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create expenses table
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  category text NOT NULL,
  type text,
  amount numeric NOT NULL,
  month int NOT NULL,
  year int NOT NULL,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create insurance table
CREATE TABLE public.insurance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  coverage text,
  sum_assured numeric,
  premium numeric,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create monthly_snapshots table
CREATE TABLE public.monthly_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  networth_id uuid REFERENCES public.networth(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  current_value numeric,
  cashflow numeric,
  monthly_income numeric,
  monthly_expenses numeric,
  monthly_repayment numeric,
  snapshot_date date NOT NULL,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create Indexes
CREATE INDEX ON public.incomes (client_id, year, month);
CREATE INDEX ON public.networth (client_id, year, month);
CREATE INDEX ON public.investments (client_id, year, month);
CREATE INDEX ON public.expenses (client_id, year, month);
CREATE INDEX ON public.monthly_snapshots (client_id, snapshot_date);

-- Enable Row Level Security
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.networth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_snapshots ENABLE ROW LEVEL SECURITY;

-- Create Policies
-- clients
CREATE POLICY "client reads own row" ON public.clients
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "client updates own row" ON public.clients
  FOR UPDATE USING (auth.uid() = user_id);

-- incomes
CREATE POLICY "client reads own incomes" ON public.incomes
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- networth
CREATE POLICY "client reads own networth" ON public.networth
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- investments
CREATE POLICY "client reads own investments" ON public.investments
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- expenses
CREATE POLICY "client reads own expenses" ON public.expenses
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- insurance
CREATE POLICY "client reads own insurance" ON public.insurance
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- monthly_snapshots
CREATE POLICY "client reads own snapshots" ON public.monthly_snapshots
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
