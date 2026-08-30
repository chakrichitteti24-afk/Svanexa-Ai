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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;

async function checkDatabaseHealth() {
  console.log('====================================================');
  console.log('🔍 SVANEXA DATABASE HEALTH CHECK');
  console.log('====================================================');
  console.log('Supabase URL:', supabaseUrl ? supabaseUrl : '❌ MISSING');
  console.log('Anon Key Present:', !!supabaseKey);
  console.log('Service Key Present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('----------------------------------------------------');

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Cannot run health check: missing Supabase credentials in .env.local');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const tablesToCheck = [
    'profiles',
    'user_preferences',
    'daily_checkins',
    'sleep_logs',
    'mood_logs',
    'water_logs',
    'exercise_logs',
    'skin_logs',
    'cycle_logs',
    'pregnancy_logs',
    'wellness_plans',
    'wellness_streaks',
    'user_coin_balances',
    'user_coin_transactions',
    'user_unlocked_items',
    'chat_sessions',
    'chat_messages',
    'reports',
    'push_subscriptions',
    'notifications',
  ];

  const results = [];

  for (const table of tablesToCheck) {
    const startTime = Date.now();
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      const duration = Date.now() - startTime;

      if (error) {
        results.push({
          table,
          status: '❌ ERROR',
          latency: `${duration}ms`,
          count: 'N/A',
          error: error.message,
          code: error.code,
        });
      } else {
        results.push({
          table,
          status: '✅ HEALTHY',
          latency: `${duration}ms`,
          count: count ?? 0,
          error: null,
        });
      }
    } catch (err) {
      results.push({
        table,
        status: '❌ EXCEPTION',
        latency: `${Date.now() - startTime}ms`,
        count: 'N/A',
        error: err.message,
      });
    }
  }

  console.table(results);

  // Check auth health
  console.log('----------------------------------------------------');
  console.log('🔐 CHECKING SUPABASE AUTH SERVICE...');
  try {
    const { data: authUsers, error: authErr } = await supabase.auth.admin
      ? await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
      : { data: null, error: { message: 'No service role key provided (admin check skipped)' } };

    if (authErr) {
      console.log('Auth Notice:', authErr.message);
    } else {
      console.log('✅ Supabase Auth Service is reachable.');
    }
  } catch (authException) {
    console.log('Auth check note:', authException.message);
  }

  const healthyCount = results.filter(r => r.status.includes('HEALTHY')).length;
  const errorCount = results.filter(r => !r.status.includes('HEALTHY')).length;

  console.log('----------------------------------------------------');
  console.log(`📊 Summary: ${healthyCount}/${tablesToCheck.length} tables healthy. Errors: ${errorCount}`);
  console.log('====================================================');
}

checkDatabaseHealth();
