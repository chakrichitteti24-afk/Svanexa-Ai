import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { HealthMonitorService } from '@/lib/health-monitor';
import { format } from 'date-fns';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const healthMonitor = new HealthMonitorService(supabase);
    const summary = await healthMonitor.generateHealthSummary(user.id);

    // Check if the user logged habits today
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const { data: todayLog } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', todayStr)
      .maybeSingle();

    return NextResponse.json({
      ...summary,
      has_checked_in_today: !!todayLog,
      today_log: todayLog || null
    });
  } catch (error) {
    console.error('API Error in /api/health-summary:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
