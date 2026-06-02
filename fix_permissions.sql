-- ==========================================
-- SUPABASE PERMISSIONS AND RLS FIXES
-- Run this script in your Supabase SQL Editor
-- ==========================================

-- 1. Ensure RLS is enabled on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing potentially restrictive or incomplete policies
DROP POLICY IF EXISTS "Allow Auth Access" ON customers;
DROP POLICY IF EXISTS "Allow Auth Access" ON products;
DROP POLICY IF EXISTS "Allow Auth Access" ON transactions;
DROP POLICY IF EXISTS "Allow Auth Access" ON payments;
DROP POLICY IF EXISTS "Allow Auth Access" ON diaries;
DROP POLICY IF EXISTS "Allow Auth Access" ON app_settings;

DROP POLICY IF EXISTS "Allow Auth Access customers" ON customers;
DROP POLICY IF EXISTS "Allow Auth Access products" ON products;
DROP POLICY IF EXISTS "Allow Auth Access transactions" ON transactions;
DROP POLICY IF EXISTS "Allow Auth Access payments" ON payments;
DROP POLICY IF EXISTS "Allow Auth Access diaries" ON diaries;
DROP POLICY IF EXISTS "Allow Auth Access app_settings" ON app_settings;
DROP POLICY IF EXISTS "Allow authenticated full access app_settings" ON app_settings;

-- 3. Create comprehensive FOR ALL policies (Select, Insert, Update, Delete)
-- We supply both USING and WITH CHECK to ensure full CRUD access is granted.
CREATE POLICY "Allow Auth Access customers" 
ON customers FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow Auth Access products" 
ON products FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow Auth Access transactions" 
ON transactions FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow Auth Access payments" 
ON payments FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow Auth Access diaries" 
ON diaries FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow Auth Access app_settings" 
ON app_settings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ==========================================
-- FIX STORAGE BUCKET PERMISSIONS
-- ==========================================

-- 4. Create logos bucket if missing
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true) 
ON CONFLICT (id) DO NOTHING;

-- 5. Create documents bucket if missing
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true) 
ON CONFLICT (id) DO NOTHING;

-- 6. Setup full CRUD Storage policies for Logos
DROP POLICY IF EXISTS "Allow Public Read Logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow Auth Insert Logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow Auth Update Logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow Auth Delete Logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Read logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow Auth Insert logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow Auth Update logos" ON storage.objects;

CREATE POLICY "Allow Public Read Logos" ON storage.objects 
FOR SELECT USING (bucket_id = 'logos');

CREATE POLICY "Allow Auth Insert Logos" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "Allow Auth Update Logos" ON storage.objects 
FOR UPDATE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "Allow Auth Delete Logos" ON storage.objects 
FOR DELETE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- 7. Setup full CRUD Storage policies for Documents
DROP POLICY IF EXISTS "Allow Public Read Documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow Auth Insert Documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow Auth Update Documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow Auth Delete Documents" ON storage.objects;

CREATE POLICY "Allow Public Read Documents" ON storage.objects 
FOR SELECT USING (bucket_id = 'documents');

CREATE POLICY "Allow Auth Insert Documents" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Allow Auth Update Documents" ON storage.objects 
FOR UPDATE USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Allow Auth Delete Documents" ON storage.objects 
FOR DELETE USING (bucket_id = 'documents' AND auth.role() = 'authenticated');
