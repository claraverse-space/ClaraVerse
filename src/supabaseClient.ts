import { createClient } from '@supabase/supabase-js';

// Get Supabase URL and keys from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qtnaotlbkjfqhzwsnqxc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Default client with anon key (for regular operations)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);