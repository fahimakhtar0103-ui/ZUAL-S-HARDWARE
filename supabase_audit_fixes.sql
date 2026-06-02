-- ==========================================
-- PHASE 1: DATABASE AUDIT & RLS FIXES
-- ==========================================
-- Run this entire script in your Supabase SQL Editor.
-- It fixes the missing table, the Security Definer view issue,
-- and rewrites ALL RLS policies to guarantee full CRUD access.

-- 1. Create missing app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  shop_name TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  dark_mode BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS on all tables
ALTER TABLE diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing incomplete/broken policies
DROP POLICY IF EXISTS "Allow authenticated full access diaries" ON diaries;
DROP POLICY IF EXISTS "Allow authenticated full access customers" ON customers;
DROP POLICY IF EXISTS "Allow authenticated full access products" ON products;
DROP POLICY IF EXISTS "Allow authenticated full access transactions" ON transactions;
DROP POLICY IF EXISTS "Allow authenticated full access payments" ON payments;

-- 4. Create proper comprehensive RLS for all CRUD operations
-- We include `WITH CHECK` because `FOR ALL` policy rules require it for INSERTs.
CREATE POLICY "Full CRUD Auth Access diaries" 
ON diaries FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Full CRUD Auth Access customers" 
ON customers FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Full CRUD Auth Access products" 
ON products FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Full CRUD Auth Access transactions" 
ON transactions FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Full CRUD Auth Access payments" 
ON payments FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Full CRUD Auth Access app_settings" 
ON app_settings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 5. Fix SECURITY DEFINER View (view_customer_balances)
-- We use SECURITY INVOKER to ensure the view accesses data using the calling user's permissions
DROP VIEW IF EXISTS view_customer_balances CASCADE;
CREATE VIEW view_customer_balances WITH (security_invoker = on) AS
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

-- 6. Setup Storage Buckets with RLS
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true) 
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Select Logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth Insert Logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update Logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete Logos" ON storage.objects;

CREATE POLICY "Public Select Logos" ON storage.objects 
FOR SELECT USING (bucket_id = 'logos');

CREATE POLICY "Auth Insert Logos" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "Auth Update Logos" ON storage.objects 
FOR UPDATE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "Auth Delete Logos" ON storage.objects 
FOR DELETE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
