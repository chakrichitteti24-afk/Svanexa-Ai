import { NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/lib/services/web-push';

export async function GET() {
  try {
    const publicKey = getVapidPublicKey();
    return NextResponse.json({
      success: true,
      publicKey,
    });
  } catch (error: any) {
    console.error('Error fetching VAPID public key:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get VAPID key' },
      { status: 500 }
    );
  }
}
