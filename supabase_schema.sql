-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. DIARIES TABLE
-- Groups customers/ledgers.
-- ==========================================
CREATE TABLE diaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. CUSTOMERS TABLE
-- Stores customer profiles and credit limits.
-- ==========================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  diary_id UUID REFERENCES diaries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  credit_limit NUMERIC DEFAULT 0,
  sync_status TEXT DEFAULT 'synced',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. PRODUCTS TABLE
-- Stores standardized materials/items for sale.
-- ==========================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  default_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. TRANSACTIONS TABLE
-- Stores debit entries (Sales/Purchases made by customer).
-- ==========================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  recorded_by UUID REFERENCES auth.users(id),
  total_amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  due_date DATE,
  items JSONB,
  sync_status TEXT DEFAULT 'synced',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 5. PAYMENTS TABLE
-- Stores credit entries (Payments received from customer).
-- ==========================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  recorded_by UUID REFERENCES auth.users(id),
  amount NUMERIC NOT NULL,
  payment_mode TEXT,
  reference_notes TEXT,
  date DATE NOT NULL,
  sync_status TEXT DEFAULT 'synced',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 6. VIEWS
-- Dynamic Outstanding Balance Calculation View.
-- ==========================================
CREATE OR REPLACE VIEW view_customer_balances AS
SELECT
  c.id AS customer_id,
  c.name AS customer_name,
  c.credit_limit,
  COALESCE(t.total_purchases, 0) AS total_purchases,
  COALESCE(p.total_payments, 0) AS total_payments,
  COALESCE(t.total_purchases, 0) - COALESCE(p.total_payments, 0) AS outstanding_balance,
  CASE
    WHEN COALESCE(t.total_purchases, 0) - COALESCE(p.total_payments, 0) > c.credit_limit AND c.credit_limit > 0 THEN 'OVER_LIMIT'
    WHEN COALESCE(t.total_purchases, 0) - COALESCE(p.total_payments, 0) > 0 THEN 'DUE'
    ELSE 'CLEARED'
  END AS status
FROM
  customers c
LEFT JOIN (
  SELECT customer_id, SUM(total_amount) AS total_purchases
  FROM transactions
  GROUP BY customer_id
) t ON c.id = t.customer_id
LEFT JOIN (
  SELECT customer_id, SUM(amount) AS total_payments
  FROM payments
  GROUP BY customer_id
) p ON c.id = p.customer_id;

-- ==========================================
-- 7. ROW LEVEL SECURITY (RLS)
-- Enables strict multi-tenant or user-based security.
-- ==========================================
ALTER TABLE diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Basic default policies (allow authenticated access).
-- Further refinement required depending on the exact tenancy model (e.g. `using (created_by = auth.uid())`)
CREATE POLICY "Allow authenticated full access diaries" ON diaries FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access customers" ON customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access products" ON products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access transactions" ON transactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access payments" ON payments FOR ALL USING (auth.role() = 'authenticated');

-- ==========================================
-- 8. INDEXES
-- For query and relationship performance.
-- ==========================================
CREATE INDEX idx_customers_diary_id ON customers(diary_id);
CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
