import { createClient } from '@supabase/supabase-js';

// Get Supabase URL and keys from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qtnaotlbkjfqhzwsnqxc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Default client with anon key (for regular operations)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client with service key (for admin operations only)
// This should ONLY be used in secure server environments, never in client-side code
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY || '';
export const supabaseAdmin = typeof window === 'undefined' 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null; // Only allow this in non-browser environments
