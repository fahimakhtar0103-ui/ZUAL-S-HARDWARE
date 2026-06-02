import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { error } = await supabase.from('Diaries').select('id').limit(1);
  console.log(`Diaries:`, error?.message || 'OK');
}

run();
