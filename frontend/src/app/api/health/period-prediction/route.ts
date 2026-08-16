import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';

export async function GET(req: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedUser(req);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }


    const userId = user.id;
    const { data: cycleLogs } = await supabase.from('cycle_logs').select('*').eq('user_id', userId).order('start_date', { ascending: false }).limit(3);
    
    return NextResponse.json({
      success: true,
      data: {
        cycleLogs,
        message: "Period predictions returned."
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
