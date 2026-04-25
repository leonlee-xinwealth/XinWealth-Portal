-- =========================================================================
-- XinWealth Portal - Initial Database Schema
-- Migration: 20260424000001_initial_schema.sql
-- =========================================================================
-- 这是主数据表结构。设计目标：
--   1. 所有用户业务数据用 UUID 作主键，外键指向 auth.users
--   2. 时间序列（快照）独立成表，方便画历史曲线
--   3. KYC 原始提交用 JSONB 保留，规范化数据分散写入子表
--   4. 每张表带 created_at / updated_at，方便审计
--   5. 严格的 enum / check 约束，防止脏数据
-- =========================================================================

-- 开启必要扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------------------
-- Enum 类型：把 TypeScript 里硬编码的字符串落到数据库层面
-- -------------------------------------------------------------------------
CREATE TYPE role_type          AS ENUM ('client', 'advisor', 'admin');
CREATE TYPE gender_type        AS ENUM ('male', 'female', 'other');
CREATE TYPE marital_status     AS ENUM ('single', 'married', 'divorced', 'widowed');
CREATE TYPE employment_status  AS ENUM ('employed', 'self_employed', 'unemployed', 'retired', 'student');
CREATE TYPE tax_status         AS ENUM ('resident', 'non_resident');

CREATE TYPE income_type AS ENUM (
  'salary', 'bonus', 'director_fee', 'commission',
  'dividend_company', 'dividend_investment', 'rental', 'other'
);

CREATE TYPE expense_category AS ENUM (
  'household', 'transportation', 'dependants',
  'personal', 'miscellaneous', 'other'
);

CREATE TYPE asset_kind AS ENUM (
  'savings', 'fixed_deposit', 'money_market_fund',
  'epf_account_1', 'epf_account_2', 'epf_account_3',
  'property', 'vehicle', 'other'
);

CREATE TYPE liability_kind AS ENUM (
  'study_loan', 'personal_loan', 'renovation_loan',
  'mortgage', 'car_loan', 'credit_card', 'other'
);

CREATE TYPE investment_class AS ENUM (
  'etf', 'bond', 'stock', 'unit_trust',
  'fixed_deposit', 'forex', 'money_market', 'other'
);

-- -------------------------------------------------------------------------
-- 核心身份表：profiles 绑在 Supabase Auth 上
-- -------------------------------------------------------------------------
CREATE TABLE profiles (
  id                         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                       role_type NOT NULL DEFAULT 'client',
  advisor_id                 UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- 基本身份
  family_name                TEXT,
  given_name                 TEXT,
  salutation                 TEXT,
  email                      TEXT UNIQUE NOT NULL,
  nric                       TEXT UNIQUE,
  date_of_birth              DATE,
  gender                     gender_type,
  marital_status             marital_status,
  nationality                TEXT,
  residency                  TEXT,

  -- 职业 / 税务
  employment_status          employment_status,
  tax_status                 tax_status,
  occupation                 TEXT,
  retirement_age             INT CHECK (retirement_age BETWEEN 40 AND 100),

  -- 马来西亚专属账号
  epf_account_number         TEXT,
  ppa_account_number         TEXT,

  -- 通讯地址
  correspondence_address     TEXT,
  correspondence_postal_code TEXT,
  correspondence_city        TEXT,
  correspondence_state       TEXT,

  -- 偏好 & 合规
  locale                     TEXT DEFAULT 'en' CHECK (locale IN ('en', 'zh')),
  pdpa_accepted_at           TIMESTAMPTZ,

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_advisor ON profiles(advisor_id);
CREATE INDEX idx_profiles_role    ON profiles(role);

-- -------------------------------------------------------------------------
-- KYC 表单快照：每次提交都新建一个 version，永久保留原始 payload
-- -------------------------------------------------------------------------
CREATE TABLE kyc_submissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  version       INT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'submitted'
                CHECK (status IN ('draft', 'submitted', 'reviewed', 'approved')),
  raw_payload   JSONB NOT NULL,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, version)
);

CREATE INDEX idx_kyc_profile ON kyc_submissions(profile_id);

-- -------------------------------------------------------------------------
-- 收入 / 支出（按月份组织）
-- -------------------------------------------------------------------------
CREATE TABLE incomes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  income_type    income_type NOT NULL,
  amount         NUMERIC(18, 2) NOT NULL CHECK (amount >= 0),
  currency       TEXT NOT NULL DEFAULT 'MYR',
  period_month   DATE NOT NULL,       -- 统一用每月 1 号代表该月
  is_recurring   BOOLEAN NOT NULL DEFAULT TRUE,
  source_note    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incomes_profile_month ON incomes(profile_id, period_month DESC);

CREATE TABLE expenses (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category       expense_category NOT NULL,
  amount         NUMERIC(18, 2) NOT NULL CHECK (amount >= 0),
  currency       TEXT NOT NULL DEFAULT 'MYR',
  period_month   DATE NOT NULL,
  is_fixed       BOOLEAN NOT NULL DEFAULT TRUE,
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_profile_month ON expenses(profile_id, period_month DESC);

-- -------------------------------------------------------------------------
-- 资产 / 负债
-- -------------------------------------------------------------------------
CREATE TABLE assets (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind           asset_kind NOT NULL,
  name           TEXT NOT NULL,
  value          NUMERIC(18, 2) NOT NULL CHECK (value >= 0),
  currency       TEXT NOT NULL DEFAULT 'MYR',
  acquired_at    DATE,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,  -- 每种资产的附加字段
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assets_profile_kind ON assets(profile_id, kind);

CREATE TABLE liabilities (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind             liability_kind NOT NULL,
  name             TEXT NOT NULL,
  principal        NUMERIC(18, 2),
  balance          NUMERIC(18, 2) NOT NULL CHECK (balance >= 0),
  interest_rate    NUMERIC(6, 4),
  monthly_payment  NUMERIC(18, 2),
  start_date       DATE,
  end_date         DATE,
  linked_asset_id  UUID REFERENCES assets(id) ON DELETE SET NULL,  -- 房贷挂到房产
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_liabilities_profile ON liabilities(profile_id);

-- -------------------------------------------------------------------------
-- 投资持仓
-- -------------------------------------------------------------------------
CREATE TABLE investments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  asset_class    investment_class NOT NULL,
  ticker         TEXT,
  name           TEXT NOT NULL,
  units          NUMERIC(18, 6),
  cost_basis     NUMERIC(18, 2),
  current_value  NUMERIC(18, 2),
  currency       TEXT NOT NULL DEFAULT 'MYR',
  purchased_at   DATE,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_investments_profile_class ON investments(profile_id, asset_class);

-- 投资交易流水（用来算 TWR / MWR）
CREATE TABLE investment_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investment_id   UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL
                  CHECK (transaction_type IN ('buy','sell','dividend','deposit','withdrawal','fee')),
  amount          NUMERIC(18, 2) NOT NULL,
  units           NUMERIC(18, 6),
  price_per_unit  NUMERIC(18, 6),
  occurred_at     DATE NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tx_investment_date ON investment_transactions(investment_id, occurred_at);
CREATE INDEX idx_tx_profile_date    ON investment_transactions(profile_id, occurred_at);

-- -------------------------------------------------------------------------
-- 保险
-- -------------------------------------------------------------------------
CREATE TABLE insurance_policies (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  policy_type        TEXT NOT NULL,       -- life / medical / critical / general...
  provider           TEXT,
  policy_number      TEXT,
  sum_assured        NUMERIC(18, 2),
  premium            NUMERIC(18, 2),
  premium_frequency  TEXT CHECK (premium_frequency IN ('monthly','quarterly','semi_annual','annual')),
  start_date         DATE,
  end_date           DATE,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insurance_profile ON insurance_policies(profile_id);

-- -------------------------------------------------------------------------
-- 时间序列：三张快照表，都用 (profile_id, snapshot_date) 做复合主键
-- -------------------------------------------------------------------------
CREATE TABLE portfolio_snapshots (
  profile_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_date  DATE NOT NULL,
  market_value   NUMERIC(18, 2) NOT NULL,
  invested       NUMERIC(18, 2) NOT NULL,
  fd_benchmark   NUMERIC(18, 2),
  twr            NUMERIC(10, 6),
  mwr            NUMERIC(10, 6),
  PRIMARY KEY (profile_id, snapshot_date)
);

CREATE TABLE health_snapshots (
  profile_id                  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_date               DATE NOT NULL,
  basic_liquidity_ratio       NUMERIC(10, 4),
  liquid_asset_to_net_worth   NUMERIC(10, 4),
  solvency_ratio              NUMERIC(10, 4),
  debt_service_ratio          NUMERIC(10, 4),
  non_mortgage_dsr            NUMERIC(10, 4),
  life_insurance_coverage     NUMERIC(10, 4),
  savings_ratio               NUMERIC(10, 4),
  invest_assets_to_net_worth  NUMERIC(10, 4),
  passive_income_coverage     NUMERIC(10, 4),
  net_worth                   NUMERIC(18, 2),
  total_assets                NUMERIC(18, 2),
  total_liabilities           NUMERIC(18, 2),
  raw_metrics                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (profile_id, snapshot_date)
);

CREATE TABLE player_states (
  profile_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_date  DATE NOT NULL,
  hp   NUMERIC(5, 2),
  mp   NUMERIC(5, 2),
  atk  NUMERIC(5, 2),
  def_ NUMERIC(5, 2),      -- def 是保留字，加下划线
  int_ NUMERIC(5, 2),
  agi  NUMERIC(5, 2),
  luk  NUMERIC(5, 2),
  level INT NOT NULL DEFAULT 1,
  PRIMARY KEY (profile_id, snapshot_date)
);

-- -------------------------------------------------------------------------
-- 审计日志：谁在什么时候改了什么
-- -------------------------------------------------------------------------
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entity_table  TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  action        TEXT NOT NULL CHECK (action IN ('insert','update','delete')),
  diff          JSONB,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_table, entity_id);
CREATE INDEX idx_audit_actor  ON audit_log(actor_id, occurred_at DESC);
