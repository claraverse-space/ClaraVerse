import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qtnaotlbkjfqhzwsnqxc.supabase.co';
const supabaseAnonKey = '***REMOVED_ANON_KEY***';

// For admin operations only (WARNING: DO NOT USE IN PRODUCTION)
const supabaseServiceKey = '***REMOVED_SERVICE_KEY*** ';

// Default client with anon key (for regular operations)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client with service key (for admin operations only)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
