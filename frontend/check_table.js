const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env variables
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function run() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get first user profile
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id').limit(1);
  if (pErr || !profiles || profiles.length === 0) {
    console.error('No profiles found or profile query error:', pErr);
    return;
  }

  const userId = profiles[0].id;
  console.log('Testing upsert for userId:', userId);

  const { data, error } = await supabase.from('skin_logs').upsert({
    user_id: userId,
    log_date: '2026-08-04',
    acne: 5,
    oiliness: 5,
    dryness: 2,
    notes: JSON.stringify({ text: 'test', aiReport: 'test report' }),
    image: ''
  }, {
    onConflict: 'user_id,log_date'
  }).select();

  console.log('Upsert result data:', data);
  console.log('Upsert error:', error);
  if (error) {
    console.log('Error Keys:', Object.keys(error));
    console.log('Error Message:', error.message);
    console.log('Error Details:', error.details);
    console.log('Error Code:', error.code);
  }
}

run();
