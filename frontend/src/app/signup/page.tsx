'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  Heart,
  User,
  Lock,
  Mail,
  ChevronRight,
  Loader2,
  Baby,
  Activity,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  Bell,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/useTranslation';
import { LanguageSelector } from '@/components/ui/LanguageSelector';

const ModeCard = ({
  mode,
  title,
  icon: Icon,
  description,
  wellnessMode,
  setWellnessMode,
}: {
  mode: string;
  title: string;
  icon: any;
  description: string;
  wellnessMode: string;
  setWellnessMode: (m: any) => void;
}) => {
  const isSelected = wellnessMode === mode;
  return (
    <div
      onClick={() => setWellnessMode(mode as any)}
      className={`p-3.5 sm:p-4 rounded-2xl cursor-pointer border transition-all active:scale-[0.98] select-none flex items-start gap-3.5 ${
        isSelected
          ? 'border-primary bg-primary/10 shadow-sm'
          : 'border-white/[0.08] hover:border-white/[0.15] bg-white/[0.04]'
      }`}
    >
      <div
        className={`p-2 rounded-xl shrink-0 mt-0.5 ${
          isSelected ? 'bg-primary/20 text-primary' : 'bg-white/[0.06] text-muted-foreground'
        }`}
      >
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className={`text-sm sm:text-base font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
            {title}
          </h3>
          {isSelected ? (
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          ) : (
            <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mt-1">{description}</p>
      </div>
    </div>
  );
};

export default function SignUpPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [aiName, setAiName] = useState('Luna');
  const [wellnessMode, setWellnessMode] = useState<'general' | 'pcos' | 'pregnancy'>('general');
  const [reminderInterval, setReminderInterval] = useState<number>(5); // 5 min default
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referrerName, setReferrerName] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('ref') || params.get('code') || sessionStorage.getItem('svanexa_ref_code');
      if (raw && typeof raw === 'string') {
        const match = raw.match(/SVX-[A-Z0-9]{6}/i);
        const clean = match ? match[0].toUpperCase() : raw.trim().toUpperCase();
        setReferralCode(clean);
        sessionStorage.setItem('svanexa_ref_code', clean);
        fetch(`/api/referrals/validate?code=${encodeURIComponent(clean)}`)
          .then((res) => res.json())
          .then((json) => {
            if (json.success && json.data?.referrerName) {
              setReferrerName(json.data.referrerName);
            }
          })
          .catch(() => {});
      }
    } catch {}
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session && isMounted) {
          window.location.href = '/dashboard';
          return;
        }
      } catch {
        // Ignore auth error on mount
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    }
    checkSession();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError('Please enter your first name');
      return;
    }
    if (!lastName.trim()) {
      setError('Please enter your last name');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStep(3);
  };

  const handleSignUp = async (requestPermissionNow: boolean = true) => {
    setLoading(true);
    setError('');

    // If user agreed to notifications, request browser permission now
    if (requestPermissionNow && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        await Notification.requestPermission();
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('Notification permission request during signup notice:', e);
        }
      }
    }

    try {
      // 1. Primary robust path: Register via pre-confirmed API route to bypass rate limits
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          aiName: aiName || 'Luna',
          wellnessMode,
          reminderInterval,
          referralCode: referralCode ? referralCode.trim().toUpperCase() : undefined,
        }),
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok || !resData.success) {
        const errorMsg = resData.error || 'Failed to create account';
        if (errorMsg.toLowerCase().includes('already exists') || errorMsg.toLowerCase().includes('already registered')) {
          setError('An account with this email already exists. Please log in.');
          setLoading(false);
          return;
        }
        throw new Error(errorMsg);
      }

      // 2. Save user notification preference to localStorage for instant hydration
      try {
        const defaultPrefs = {
          enabled: enableNotifications,
          browserPush: enableNotifications,
          soundEnabled: true,
          cycleAlerts: true,
          checkinAlerts: true,
          repeatUntilCheckinComplete: true,
          recurringIntervalMinutes: reminderInterval,
          hydrationAlerts: true,
          supplementAlerts: true,
          skinAlerts: true,
          lunaInsights: true,
          reminderSchedule: {
            morningTime: '08:30',
            afternoonTime: '14:00',
            eveningTime: '21:30',
          },
        };
        localStorage.setItem('svanexa_notif_prefs_v1', JSON.stringify(defaultPrefs));
      } catch {}

      // 3. Log in immediately with password — account is pre-confirmed so this succeeds instantly!
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInErr) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('Post-signup auto-signin notice:', signInErr);
        }
        window.location.href = '/login?message=' + encodeURIComponent('Account created successfully! Please sign in with your password.');
        return;
      }

      // Complete referral if any
      try {
        await fetch('/api/referrals/complete', { method: 'POST' });
      } catch {}

      // Instant entry to dashboard!
      window.location.href = '/dashboard';
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('already registered')) {
        setError('An account with this email already exists. Please log in.');
      } else {
        setError(err.message || 'An error occurred during sign up.');
      }
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

  if (isEmailSent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-background py-8 px-4 sm:py-12 sm:px-6 w-full max-w-full overflow-x-hidden selection:bg-primary/20">
        <div className="w-full max-w-md mx-auto space-y-5 animate-in fade-in duration-300">
          <Card className="border-white/[0.1] shadow-xl bg-white/[0.04] backdrop-blur-2xl p-6 sm:p-8 text-center space-y-5 rounded-3xl">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center text-primary shadow-sm">
              <Mail className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Verify Your Email</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
              </p>
              <p className="text-xs text-muted-foreground/80 leading-relaxed pt-1">
                Please click the link in your email to activate your account and start earning Svanexa Coins.
              </p>
              {referralCode && (
                <div className="mt-3 p-3 rounded-2xl bg-white/[0.06] border border-white/[0.1] text-xs text-foreground">
                  🪙 Once your email is verified, your referrer ({referralCode}) will automatically receive their +500 Coins bonus!
                </div>
              )}
            </div>
            <div className="pt-2 space-y-2">
              <Button
                onClick={() => router.push('/login')}
                className="w-full h-11 rounded-full bg-primary hover:opacity-95 text-white font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_8px_rgba(0,0,0,0.24)] active:scale-[0.98] transition-all cursor-pointer"
              >
                Go to Sign In
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-background py-8 px-4 sm:py-12 sm:px-6 w-full max-w-full overflow-x-hidden selection:bg-primary/20">
      <div className="w-full max-w-md mx-auto space-y-5 sm:space-y-6 animate-in fade-in duration-300">
        {/* Language selector */}
        <div className="flex justify-end">
          <LanguageSelector variant="header" />
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-white mb-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_4px_16px_rgba(0,0,0,0.25)]">
            <Heart className="w-6 h-6 fill-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">{t('auth.createAccount')}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{t('auth.signUpSubtitle')}</p>
        </div>

        {/* Apple Segmented Tab Control */}
        <div className="w-full grid grid-cols-2 p-1 rounded-full bg-white/[0.06] border border-white/[0.08]">
          <Link
            href="/login"
            className="text-center py-2 text-sm font-medium rounded-full text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('auth.signIn')}
          </Link>
          <Link
            href="/signup"
            className="text-center py-2 text-sm font-semibold rounded-full bg-white/[0.14] shadow-sm text-foreground transition-all"
          >
            {t('auth.signUp')}
          </Link>
        </div>

        {/* Card Form */}
        <Card className="border-white/[0.1] shadow-xl bg-white/[0.04] backdrop-blur-2xl relative overflow-hidden py-0 gap-0 rounded-3xl">
          {/* Top Step Progress Line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-white/[0.08]">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' }}
              animate={{ width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <CardContent className="pt-6 pb-6 px-4 sm:px-6">
            {/* Step Indicator Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-semibold">
                  {step}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {step === 1 ? 'Account' : step === 2 ? 'Wellness Mode' : 'Daily Reminders'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground font-medium">Step {step} of 3</span>
            </div>

            <AnimatePresence mode="wait">
              {/* STEP 1: Account Information */}
              {step === 1 && (
                <motion.form
                  key="step1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleNextStep1}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName" className="text-xs font-medium text-muted-foreground">
                        First Name
                      </Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        placeholder="Maya"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName" className="text-xs font-medium text-muted-foreground">
                        Last Name
                      </Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        placeholder="Chen"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                      Email address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs font-medium text-muted-foreground">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Referral Code Indicator / Input */}
                  {referralCode ? (
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.06] border border-white/[0.1] text-xs text-foreground">
                      <div className="flex items-center gap-2 min-w-0">
                        <Sparkles className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate">
                          Referred by <strong className="text-foreground font-semibold">{referrerName || 'a friend'}</strong> ({referralCode})
                        </span>
                      </div>
                      <span className="text-[10px] uppercase font-semibold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/25 shrink-0 ml-2">
                        Linked ✓
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      <Label htmlFor="referralCode" className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                        <span>Referral Code (Optional)</span>
                        <span className="text-[10px] text-amber-400 font-semibold">🪙 Friend earns 500 coins</span>
                      </Label>
                      <Input
                        id="referralCode"
                        value={referralCode}
                        onChange={(e) => {
                          const input = e.target.value.trim();
                          const match = input.match(/SVX-[A-Z0-9]{6}/i);
                          const val = match ? match[0].toUpperCase() : input.toUpperCase();
                          setReferralCode(val);
                          if (val.length >= 6) {
                            fetch(`/api/referrals/validate?code=${encodeURIComponent(val)}`)
                              .then((r) => r.json())
                              .then((d) => {
                                if (d.success && d.data?.referrerName) setReferrerName(d.data.referrerName);
                                else setReferrerName(null);
                              })
                              .catch(() => {});
                          } else {
                            setReferrerName(null);
                          }
                        }}
                        placeholder="e.g. SVX-A7K92P"
                        className="text-xs uppercase tracking-wider font-mono"
                      />
                    </div>
                  )}

                  {error && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-3 text-xs sm:text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl break-words"
                    >
                      {error}
                    </motion.div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 rounded-full bg-primary hover:opacity-95 text-white font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_8px_rgba(0,0,0,0.24)] mt-2 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Continue <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.form>
              )}

              {/* STEP 2: Wellness Mode & AI Setup */}
              {step === 2 && (
                <motion.form
                  key="step2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleNextStep2}
                  className="space-y-4 sm:space-y-5"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="aiName" className="flex items-center gap-2 text-xs sm:text-sm font-medium text-foreground">
                      <Sparkles className="w-4 h-4 text-pink-500" /> Name your AI Companion
                    </Label>
                    <p className="text-xs text-muted-foreground">Your AI assistant will use this name to chat with you.</p>
                    <div className="relative flex items-center">
                      <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-500 pointer-events-none" />
                      <Input
                        id="aiName"
                        type="text"
                        value={aiName}
                        onChange={(e) => setAiName(e.target.value)}
                        required
                        placeholder="e.g. Luna, Maya, Sage"
                        className="pl-10 pr-4 text-pink-500 font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-foreground">
                      <Activity className="w-4 h-4 text-pink-500" /> Select Wellness Mode
                    </Label>
                    <div className="grid grid-cols-1 gap-2.5">
                      <ModeCard
                        mode="general"
                        title="General Wellness"
                        icon={Heart}
                        description="Focus on sleep, mood, hydration, and overall well-being."
                        wellnessMode={wellnessMode}
                        setWellnessMode={setWellnessMode}
                      />
                      <ModeCard
                        mode="pcos"
                        title="PCOS / PCOD"
                        icon={Activity}
                        description="Tailored tracking for irregular cycles and hormonal symptoms."
                        wellnessMode={wellnessMode}
                        setWellnessMode={setWellnessMode}
                      />
                      <ModeCard
                        mode="pregnancy"
                        title="Pregnancy"
                        icon={Baby}
                        description="Track weekly milestones, mother wellness, and baby development."
                        wellnessMode={wellnessMode}
                        setWellnessMode={setWellnessMode}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="h-11 px-5 rounded-full shrink-0 font-medium border border-white/[0.12] hover:bg-white/[0.08] transition-colors cursor-pointer"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 h-11 rounded-full bg-primary hover:opacity-95 text-white font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_8px_rgba(0,0,0,0.24)] min-w-0 px-4 text-sm active:scale-[0.98] transition-all cursor-pointer"
                    >
                      Next: Notifications <ChevronRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </div>
                </motion.form>
              )}

              {/* STEP 3: Notification & Reminder Setup (CORE FEATURE) */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 sm:space-y-5"
                >
                  <div className="text-center space-y-2 py-1">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.08] border border-white/[0.12] text-primary mb-1">
                      <Bell className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                      Never Miss a Health Check-In
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed px-2">
                      Svanexa gently reminds your phone when daily wellness tracking is pending so you never forget your health!
                    </p>
                  </div>

                  {/* Core Feature Card */}
                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      <p className="text-xs font-semibold text-foreground">
                        Check-In Reminder Frequency:
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Every 5 Min (Default)', value: 5 },
                        { label: 'Every 10 Min', value: 10 },
                        { label: 'Every 30 Min', value: 30 },
                        { label: 'Every 1 Hour', value: 60 },
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setReminderInterval(item.value)}
                          className={`p-2.5 rounded-xl text-xs font-medium transition-all border text-center cursor-pointer active:scale-[0.98] ${
                            reminderInterval === item.value
                              ? 'bg-white/[0.14] border-white/[0.18] text-foreground shadow-sm font-semibold'
                              : 'bg-white/[0.04] border-white/[0.08] text-muted-foreground hover:bg-white/[0.08]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <p className="text-[11px] text-muted-foreground/90 leading-relaxed pt-1">
                      🔄 Reminders repeat automatically until you complete today&apos;s check-in, then stop for the day.
                    </p>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-3 text-xs sm:text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl break-words"
                    >
                      {error}
                    </motion.div>
                  )}

                  <div className="space-y-2 pt-1">
                    <Button
                      type="button"
                      onClick={() => handleSignUp(true)}
                      disabled={loading}
                      className="w-full h-11 rounded-full bg-primary hover:opacity-95 text-white font-semibold text-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_8px_rgba(0,0,0,0.24)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Bell className="w-4 h-4" /> Allow Notifications & Finish
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleSignUp(false)}
                      disabled={loading}
                      className="w-full text-xs text-muted-foreground hover:text-foreground h-9 font-medium"
                    >
                      Skip & Finish Signup
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="text-center text-xs text-muted-foreground/80 px-4">
          By continuing, you agree to Svanexa&apos;s wellness guidelines and terms.
        </p>
      </div>
    </div>
  );
}
