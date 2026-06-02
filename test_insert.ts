import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const email = `test${Date.now()}@example.com`;
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: 'password123'
  });
  console.log("Auth:", authError || authData.user?.id);
  
  const { data, error } = await supabase.from('diaries').insert([{ name: 'Test' }]);
  console.log("Insert:", error || "Success");
}

run();
