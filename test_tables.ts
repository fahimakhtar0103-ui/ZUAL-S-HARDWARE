import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const tables = ['books', 'accounts', 'entries', 'clients', 'users', 'profiles', 'ledger_books', 'client_list'];
  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(1);
    console.log(`${t}:`, error?.message);
  }
}

run();
