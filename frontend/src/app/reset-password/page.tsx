'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Lock, Heart, Loader2, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { useTranslation } from '@/i18n/useTranslation';
import { LanguageSelector } from '@/components/ui/LanguageSelector';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session && isMounted) {
          // If no session, they shouldn't be here (recovery link establishes session)
          router.push('/login?error=Invalid or expired recovery link.');
          return;
        }
      } catch {
        // Ignore
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    }
    checkSession();
    return () => { isMounted = false; };
  }, [supabase, router]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;
      
      await supabase.auth.signOut();
      router.push('/login?message=Password updated successfully. Please log in.');
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-background p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_4px_16px_rgba(0,0,0,0.25)] animate-pulse">
            <Heart className="w-6 h-6 fill-white" />
          </div>
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-background py-8 px-4 sm:py-12 sm:px-6 w-full max-w-full overflow-x-hidden selection:bg-primary/20">
      <div className="w-full max-w-md space-y-6 sm:space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex justify-end">
          <LanguageSelector variant="header" />
        </div>

        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-white mb-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_4px_16px_rgba(0,0,0,0.25)]">
            <Lock className="w-6 h-6 fill-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">{t('auth.resetPasswordTitle')}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Secure your account with a new password.</p>
        </div>

        <Card className="border-white/[0.1] shadow-xl bg-white/[0.04] backdrop-blur-2xl py-0 gap-0 rounded-3xl">
          <form onSubmit={handleUpdatePassword}>
            <CardContent className="space-y-4 pt-6 px-4 sm:px-6">
              
              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    className="pl-10 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    className="pl-10 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 text-xs sm:text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl break-words">
                  {error}
                </motion.div>
              )}
            </CardContent>

            <CardFooter className="px-4 sm:px-6 pb-6 pt-0 border-t-0 bg-transparent">
              <Button 
                type="submit" 
                className="w-full h-11 rounded-full bg-primary hover:opacity-95 text-white font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_8px_rgba(0,0,0,0.24)] active:scale-[0.98] transition-all cursor-pointer"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {loading ? t('common.saving') : t('common.save')}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
