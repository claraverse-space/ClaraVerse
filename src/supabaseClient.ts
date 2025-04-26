import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qtnaotlbkjfqhzwsnqxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0bmFvdGxia2pmcWh6d3NucXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2NTkyODYsImV4cCI6MjA2MTIzNTI4Nn0.j-yyVIGO4ibAMU6QpTOx4NtqRNseA3IJbYekzRKrj24';

// For admin operations only (WARNING: DO NOT USE IN PRODUCTION)
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0bmFvdGxia2pmcWh6d3NucXhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTY1OTI4NiwiZXhwIjoyMDYxMjM1Mjg2fQ.aGxcb_HsCyFZCYaGPvk0QUinIpJbPuLWBt0FBK6C72I';

// Default client with anon key (for regular operations)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client with service key (for admin operations only)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
