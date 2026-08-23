const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.+)?$/);
    if (match) {
      process.env[match[1]] = (match[2] || '').trim();
    }
  });
}

async function diagnose() {
  console.log('\n======================================');
  console.log(' SVANEXA PUSH NOTIFICATION DIAGNOSTICS');
  console.log('======================================\n');

  // 1. Check VAPID keys
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  console.log('[1] VAPID Keys:');
  if (!pub || !priv) {
    console.log('   ❌ MISSING in .env.local!');
    console.log('   → pub:', pub ? 'SET' : 'MISSING');
    console.log('   → priv:', priv ? 'SET' : 'MISSING');
  } else {
    try {
      webpush.setVapidDetails('mailto:support@svanexa.ai', pub, priv);
      console.log('   ✅ VAPID keys valid & matched.');
    } catch (err) {
      console.log('   ❌ VAPID key mismatch:', err.message);
    }
  }

  // 2. Check Supabase push_subscriptions table
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(url, key);

  console.log('\n[2] Supabase push_subscriptions:');
  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, created_at');

  if (subErr) {
    console.log('   ❌ Table error:', subErr.message);
  } else {
    console.log(`   Count: ${subs.length}`);
    if (subs.length === 0) {
      console.log('   ❌ NO DEVICE REGISTERED YET!');
      console.log('   → REASON for "Failed to dispatch": No device token saved.');
      console.log('   → FIX: In browser, go to Profile → Notifications → Click "Enable Push" → Allow.');
    } else {
      subs.forEach((s, i) => {
        console.log(`   Subscription ${i+1}: endpoint=${s.endpoint.substring(0, 50)}... user=${s.user_id.substring(0,8)}...`);
      });
    }
  }

  console.log('\n======================================');
  if (subs && subs.length === 0) {
    console.log('ROOT CAUSE: No push subscription registered.');
    console.log('Do this in your browser:');
    console.log('  1. Open http://localhost:3000');
    console.log('  2. Profile > Notifications > Enable Push > Allow');
    console.log('  3. Then click "Send Phone Push Alert"');
  }
  console.log('======================================\n');
}

diagnose();
