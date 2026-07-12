import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf8');
const envMap = {};
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) envMap[key.trim()] = rest.join('=').trim().replace(/^"|"$/g, '');
}

const supabaseUrl = envMap['SUPABASE_URL'] || envMap['VITE_SUPABASE_URL'];
const serviceRoleKey = envMap['SUPABASE_SERVICE_ROLE_KEY'];
const anonKey = envMap['SUPABASE_PUBLISHABLE_KEY'] || envMap['VITE_SUPABASE_PUBLISHABLE_KEY'];

console.log('Keys found:', Object.keys(envMap));
console.log('Has service role key:', !!serviceRoleKey);

if (!serviceRoleKey) {
  console.log('No service role key — need Supabase Dashboard to run migration.');
  console.log('Migration SQL saved to: supabase/migrations/20260712020900_manager_tables.sql');
  console.log('');
  console.log('Go to: https://supabase.com/dashboard/project/epxelcmygtskvmadzomp/sql/new');
  console.log('And paste the SQL from the migration file.');
} else {
  console.log('Has service role key, running migration...');
}
