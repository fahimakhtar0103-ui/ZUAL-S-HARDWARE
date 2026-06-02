import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
    console.error('⚠️ [Supabase] Missing VITE_SUPABASE_URL environment variable.');
}
if (!supabaseAnonKey) {
    console.error('⚠️ [Supabase] Missing VITE_SUPABASE_ANON_KEY environment variable.');
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');
