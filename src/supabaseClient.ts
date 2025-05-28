import { createClient } from '@supabase/supabase-js';

// Get Supabase URL and keys from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qtnaotlbkjfqhzwsnqxc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0bmFvdGxia2pmcWh6d3NucXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3MjgxNjIsImV4cCI6MjA2MzMwNDE2Mn0.W3mrGTE5_abQdHsFZb7G7x35ZHJa4K6gcv1KTp2qu78';

// Default client with anon key (for regular operations)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);