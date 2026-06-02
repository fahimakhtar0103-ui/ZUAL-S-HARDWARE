import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const tables = ['diaries', 'customers', 'transactions', 'payments', 'products'];
  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(1);
    console.log(`${t}:`, error?.message || 'OK');
  }
}

run();
