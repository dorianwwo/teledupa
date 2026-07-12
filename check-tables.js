import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://epxelcmygtskvmadzomp.supabase.co';
const anonKey = 'sb_publishable_kgIIGWrQpGAAmxVyOExroQ_xnQsXVSR';

const supabase = createClient(supabaseUrl, anonKey);

async function run() {
  // Sign in as manager
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'tgdon@teledupa.local',
    password: 'tgdon-manager-2026',
  });
  if (loginError) { console.error('Login error:', loginError.message); return; }
  console.log('Logged in as:', loginData.user.email);

  // Test insert into gallery_entries to see if table exists
  const { error: galErr } = await supabase.from('gallery_entries').select('id').limit(1);
  if (galErr) {
    console.log('gallery_entries table missing or error:', galErr.message);
  } else {
    console.log('gallery_entries table: OK');
  }

  // Test ip_bans table
  const { error: banErr } = await supabase.from('ip_bans').select('id').limit(1);
  if (banErr) {
    console.log('ip_bans table missing or error:', banErr.message);
  } else {
    console.log('ip_bans table: OK');
  }
}

run();
