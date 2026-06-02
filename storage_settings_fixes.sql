-- Create settings table
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
DROP POLICY IF EXISTS "Allow authenticated full access app_settings" ON app_settings;
CREATE POLICY "Allow authenticated full access app_settings" ON app_settings 
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Create logos storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow Public Read logos" ON storage.objects;
CREATE POLICY "Allow Public Read logos" ON storage.objects 
  FOR SELECT USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Allow Auth Insert logos" ON storage.objects;
CREATE POLICY "Allow Auth Insert logos" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow Auth Update logos" ON storage.objects;
CREATE POLICY "Allow Auth Update logos" ON storage.objects 
  FOR UPDATE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
