import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { recordReferralSignup } from '@/lib/rewards/rewards-service';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      email,
      password,
      firstName = 'User',
      lastName = '',
      aiName = 'Luna',
      wellnessMode = 'general',
      reminderInterval = 5,
      referralCode,
    } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const admin = createAdminClient();

    // Check if user already exists
    const { data: existingList } = await admin.auth.admin.listUsers();
    const existing = existingList?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail);

    let userId: string;

    if (existing) {
      if (existing.email_confirmed_at) {
        return NextResponse.json({
          success: false,
          error: 'An account with this email already exists. Please log in.',
        }, { status: 409 });
      } else {
        // User was registered earlier but was unconfirmed.
        // Confirm them now and update password so they can log in immediately!
        const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
          password,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            username: firstName,
            ai_name: aiName,
            wellness_mode: wellnessMode,
            reminder_interval: reminderInterval,
          },
        });
        if (updErr) {
          return NextResponse.json({ success: false, error: updErr.message }, { status: 500 });
        }
        userId = existing.id;
      }
    } else {
      // Create fresh user pre-confirmed to bypass email rate limits
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          username: firstName,
          ai_name: aiName,
          wellness_mode: wellnessMode,
          reminder_interval: reminderInterval,
          referral_code: referralCode ? String(referralCode).trim().toUpperCase() : undefined,
        },
      });

      if (createErr) {
        return NextResponse.json({ success: false, error: createErr.message }, { status: 500 });
      }

      userId = newUser.user.id;
    }

    // Ensure profiles row exists
    await admin.from('profiles').upsert(
      {
        id: userId,
        first_name: firstName,
        last_name: lastName,
        username: firstName,
        email: cleanEmail,
        ai_name: aiName,
        active_theme: wellnessMode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    // Ensure streak exists
    await admin.from('wellness_streaks').upsert(
      { user_id: userId, current_streak: 0, longest_streak: 0 },
      { onConflict: 'user_id' }
    );

    // Track referral if code provided
    if (referralCode) {
      try {
        await recordReferralSignup(admin, String(referralCode).trim().toUpperCase(), userId, cleanEmail);
      } catch (refErr) {
        console.warn('[signup referral notice]', refErr);
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      email: cleanEmail,
      message: 'Account created and verified successfully.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Internal error during signup' }, { status: 500 });
  }
}
