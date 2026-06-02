-- Fix Row Level Security (RLS) policies for INSERT/UPDATE operations
-- Postgres requires a WITH CHECK clause for INSERT operations when using FOR ALL policies, 
-- or separate policies for INSERT.

-- 1. Diaries table
DROP POLICY IF EXISTS "Allow authenticated full access diaries" ON diaries;
CREATE POLICY "Allow authenticated full access diaries" ON diaries 
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 2. Customers table
DROP POLICY IF EXISTS "Allow authenticated full access customers" ON customers;
CREATE POLICY "Allow authenticated full access customers" ON customers 
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 3. Products table
DROP POLICY IF EXISTS "Allow authenticated full access products" ON products;
CREATE POLICY "Allow authenticated full access products" ON products 
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 4. Transactions table
DROP POLICY IF EXISTS "Allow authenticated full access transactions" ON transactions;
CREATE POLICY "Allow authenticated full access transactions" ON transactions 
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 5. Payments table
DROP POLICY IF EXISTS "Allow authenticated full access payments" ON payments;
CREATE POLICY "Allow authenticated full access payments" ON payments 
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
