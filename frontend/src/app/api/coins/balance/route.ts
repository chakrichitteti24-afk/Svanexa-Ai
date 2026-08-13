import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Fetch coin balance
    const { data: balanceRow } = await supabase
      .from('user_coin_balances')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();

    // Fetch unlocked items
    const { data: unlockedRows } = await supabase
      .from('user_unlocked_items')
      .select('item_type, item_id')
      .eq('user_id', userId);

    // Fetch active profile selections
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_theme, active_dashboard_style, active_companion_style')
      .eq('id', userId)
      .maybeSingle();

    const balance = balanceRow?.balance ?? 0;
    const unlockedItems = unlockedRows || [];
    const activeTheme = profile?.active_theme || 'default';
    const activeDashboardStyle = profile?.active_dashboard_style || 'minimal';
    const activeCompanionStyle = profile?.active_companion_style || 'friendly';

    return NextResponse.json({
      success: true,
      data: {
        balance,
        unlockedItems,
        activeTheme,
        activeDashboardStyle,
        activeCompanionStyle,
      },
    });
  } catch (error: any) {
    console.error('[coins/balance GET error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
