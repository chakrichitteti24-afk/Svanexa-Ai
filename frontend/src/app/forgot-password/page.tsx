'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { Mail, Heart, Loader2 } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage('Password reset link sent to your email.');
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 selection:bg-pink-500/20">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-pink-500 to-violet-500 text-white mb-2 shadow-lg shadow-pink-500/20">
            <Heart className="w-6 h-6 fill-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Reset Password</h1>
          <p className="text-sm text-muted-foreground">We&apos;ll send you a secure link to reset it.</p>
        </div>

        <Card className="border-pink-500/10 shadow-xl shadow-pink-500/5 bg-card/60 backdrop-blur-xl">
          <form onSubmit={handleReset}>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg">
                  {error}
                </motion.div>
              )}
              {message && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 text-sm text-green-500 bg-green-500/10 border border-green-500/20 rounded-lg">
                  {message}
                </motion.div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 text-white shadow-md shadow-pink-500/20 h-11"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
              <p className="text-sm text-center text-muted-foreground w-full">
                Remember your password?{' '}
                <Link href="/login" className="font-medium text-pink-500 hover:text-pink-600 transition-colors">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
