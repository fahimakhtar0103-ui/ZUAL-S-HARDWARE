# Supabase Setup Guide: Hardware ERP

This guide provides step-by-step instructions for provisioning your full Supabase backend, configuring the database, enforcing security, and setting up file storage for your Hardware ERP application.

## Step 1: Create a Supabase Project

1. Go to [Supabase Dashboard](https://database.new) and click **New Project**.
2. Select your Organization, name the project (e.g., "Hardware ERP"), and generate a secure Database Password.
3. Select a region close to your primary user base (e.g., `ap-south-1` for India) and click **Create New Project**.
4. Wait for the provisioning process to complete (usually takes 1-2 minutes).

## Step 2: Execute the Database Schema & Policies

We have combined the complete definition for Tables, Relationships, Indexes, Views, Storage, and Row Level Security into a single master SQL script.

1. Navigate to the **SQL Editor** in the left sidebar of your Supabase dashboard.
2. Click **New Query**.
3. Copy and paste the following SQL block:

```sql
-- ==========================================
-- 1. ENABLE EXTENSIONS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. CREATE TABLES
-- ==========================================
-- Diaries: Groups customers/ledgers.
CREATE TABLE diaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers: Stores customer profiles and credit limits.
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

-- Products: Standardized materials/items for sale (Sand, Cement, etc).
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  default_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions: Debit entries (Sales/Purchases made by customer).
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  recorded_by UUID REFERENCES auth.users(id),
  total_amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  items JSONB,
  sync_status TEXT DEFAULT 'synced',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments: Credit entries (Payments received from customer).
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
-- 3. CREATE DYNAMIC VIEWS
-- ==========================================
-- View: Dynamic Outstanding Balance Calculation
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
-- 4. CREATE INDEXES
-- ==========================================
CREATE INDEX idx_customers_diary_id ON customers(diary_id);
CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);

-- ==========================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to perform CRUD operations
-- (In a multi-tenant setup, replace true with explicit user_id checks)
CREATE POLICY "Allow Auth Access" ON diaries FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow Auth Access" ON customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow Auth Access" ON products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow Auth Access" ON transactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow Auth Access" ON payments FOR ALL USING (auth.role() = 'authenticated');

-- Setting up application settings
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_name TEXT DEFAULT 'Hardwire & Tools Hub',
  owner_name TEXT DEFAULT 'Zual Rana',
  address TEXT DEFAULT '124 Main Market',
  logo_url TEXT,
  dark BOOLEAN DEFAULT false,
  daily BOOLEAN DEFAULT true,
  user_id UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_settings UNIQUE(user_id)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow Auth Access app_settings" ON app_settings 
FOR ALL USING (auth.role() = 'authenticated');

-- ==========================================
-- 6. STORAGE BUCKETS (FOR DOCUMENTS/LOGOS)
-- ==========================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true);
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true);

-- Storage RLS rules
CREATE POLICY "Allow Public Read Documents" ON storage.objects 
  FOR SELECT USING (bucket_id = 'documents');

CREATE POLICY "Allow Auth Insert Documents" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Allow Auth Update Documents" ON storage.objects 
  FOR UPDATE USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Allow Public Read Logos" ON storage.objects 
  FOR SELECT USING (bucket_id = 'logos');

CREATE POLICY "Allow Auth Insert Logos" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "Allow Auth Update Logos" ON storage.objects 
  FOR UPDATE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
```

4. Click the **Run** button (or press `Cmd/Ctrl + Enter`). You should see a "Success" message indicating the infrastructure was configured.

## Step 3: Configure Authentication

1. Navigate to **Authentication** > **Providers** in the left sidebar.
2. By default, **Email** authentication is enabled. 
   - Turn off "Confirm email" if you want users to log in immediately without verifying their email during development.
3. If you want to enable **Phone (OTP)** logins:
   - Expand the **Phone** provider section.
   - Enable the provider and follow the prompts to integrate with Twilio, MessageBird, or Supabase's native SMS service.

## Step 4: Connect the Application

1. Go to **Project Settings** (the gear icon at the bottom left) > **API**.
2. Locate the **Project URL** and the **anon `public` API Key**.
3. In your application codebase, create or open the `.env` file at the root.
4. Add the credentials to the environment variables:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_api_key_here
```

5. Restart your local development server to inject the new environment variables. You are now securely connected to your remote Supabase instance.
