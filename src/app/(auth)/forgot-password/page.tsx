'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?redirect_to=/dashboard`,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    toast.success('Password reset email sent!');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <div className="w-full max-w-sm space-y-8 animate-in slide-in-from-bottom-8 fade-in duration-700">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-6">
            <Sparkles className="w-6 h-6 text-pink-500" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Reset Password</h1>
          <p className="text-sm text-muted-foreground">We'll send you a link to reset your password.</p>
        </div>

        <Card className="border-border/40 bg-card/60 backdrop-blur-xl shadow-2xl">
          <CardContent className="pt-6">
            {!sent ? (
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 bg-background border-border/60"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 rounded-full mt-4 bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white font-medium transition-transform active:scale-95"
                  disabled={loading || !email}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
                </Button>
              </form>
            ) : (
              <div className="text-center py-4 space-y-4">
                <div className="text-green-500 font-medium">Check your email!</div>
                <p className="text-sm text-muted-foreground">
                  We've sent a password reset link to <strong>{email}</strong>.
                </p>
                <Button 
                  variant="outline" 
                  className="rounded-full w-full"
                  onClick={() => setSent(false)}
                >
                  Try another email
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="flex items-center justify-center gap-2 text-pink-500 font-medium hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
