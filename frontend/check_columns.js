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
  
  // Try querying 'date'
  console.log('Querying date...');
  const { data: d1, error: err1 } = await supabase.from('skin_logs').select('date').limit(1);
  console.log('date query error:', err1?.message || 'SUCCESS!');

  // Try querying 'log_date'
  console.log('Querying log_date...');
  const { data: d2, error: err2 } = await supabase.from('skin_logs').select('log_date').limit(1);
  console.log('log_date query error:', err2?.message || 'SUCCESS!');

  // Try querying other schema 2 columns: acne, oiliness, dryness, image
  console.log('Querying other schema 2 columns (acne, oiliness, dryness, image, notes)...');
  const { data: d3, error: err3 } = await supabase
    .from('skin_logs')
    .select('acne, oiliness, dryness, image, notes')
    .limit(1);
  console.log('schema 2 query error:', err3?.message || 'SUCCESS!');

  // Try querying other schema 1 columns: condition, breakouts, notes
  console.log('Querying other schema 1 columns (condition, breakouts, notes)...');
  const { data: d4, error: err4 } = await supabase
    .from('skin_logs')
    .select('condition, breakouts, notes')
    .limit(1);
  console.log('schema 1 query error:', err4?.message || 'SUCCESS!');
}

run();
