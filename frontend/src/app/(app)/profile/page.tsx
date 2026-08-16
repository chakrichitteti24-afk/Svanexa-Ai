'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  User,
  Sparkles,
  Heart,
  LogOut,
  Loader2,
  Save,
  CheckCircle2,
  AlertCircle,
  Mail,
  Calendar,
  Lock,
  Baby,
  Activity,
  ShieldCheck,
  Palette,
  HelpCircle,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { HabitBadges } from '@/components/profile/HabitBadges';
import { useHerSync } from '@/context/HerSyncContext';

type WellnessMode = 'general' | 'pcos' | 'pregnancy';

function calculateAge(dobString: string): number | null {
  if (!dobString) return null;
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age > 0 && age < 120 ? age : null;
}

const WELLNESS_MODES: {
  id: WellnessMode;
  title: string;
  badge: string;
  description: string;
  icon: any;
  color: string;
  borderActive: string;
  bgActive: string;
}[] = [
  {
    id: 'general',
    title: "General Wellness",
    badge: "🌸 General Care",
    description: "Daily hormone balance, energy tracking, sleep & holistic vitality.",
    icon: Sparkles,
    color: "text-violet-400",
    borderActive: "border-violet-500/60",
    bgActive: "bg-violet-500/10",
  },
  {
    id: 'pcos',
    title: "PCOS / PCOD Mode",
    badge: "✨ PCOS Support",
    description: "Insulin sensitivity, symptom logging, androgen balance & cycle care.",
    icon: Activity,
    color: "text-pink-400",
    borderActive: "border-pink-500/60",
    bgActive: "bg-pink-500/10",
  },
  {
    id: 'pregnancy',
    title: "Pregnancy Mode",
    badge: "🤰 Pregnancy Care",
    description: "Trimester milestones, due date tracking, maternal nutrition & hydration.",
    icon: Baby,
    color: "text-amber-400",
    borderActive: "border-amber-500/60",
    bgActive: "bg-amber-500/10",
  },
];

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const { refreshAll } = useHerSync();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [companionName, setCompanionName] = useState('Luna');
  const [userMode, setUserMode] = useState<WellnessMode>('general');
  const [dueDate, setDueDate] = useState('');

  // Prevent duplicate submit on fast double-click
  const isSavingRef = useRef(false);

  // Calculate age dynamically
  const userAge = useMemo(() => calculateAge(dob), [dob]);

  useEffect(() => {
    let mounted = true;

    async function fetchProfile() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.replace('/login');
          return;
        }

        if (!mounted) return;
        setUserId(user.id);
        setEmail(user.email || '');

        // Fetch profile and pregnancy logs in parallel with maybeSingle to avoid 406 errors
        const [profileRes, pregRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('first_name, last_name, username, date_of_birth, ai_name, active_theme')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('pregnancy_logs')
            .select('due_date')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (!mounted) return;

        if (profileRes.data) {
          setFirstName(profileRes.data.first_name || profileRes.data.username || '');
          setLastName(profileRes.data.last_name || '');
          setDob(profileRes.data.date_of_birth || '');
          setCompanionName(profileRes.data.ai_name || 'Luna');
          const theme = profileRes.data.active_theme as WellnessMode;
          if (theme && ['general', 'pcos', 'pregnancy'].includes(theme)) {
            setUserMode(theme);
          }
        } else if (user.user_metadata) {
          // Fallback to user metadata if profile row hasn't been created yet
          setFirstName(user.user_metadata.first_name || user.user_metadata.username || '');
          setLastName(user.user_metadata.last_name || '');
        }

        if (pregRes.data?.due_date) {
          setDueDate(pregRes.data.due_date);
        }
      } catch (e) {
        console.error('Error fetching profile', e);
        toast.error('Unable to load profile data. Please refresh.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast.error('Not authenticated. Please log in again.');
      return;
    }

    // Validation
    if (!firstName.trim()) {
      toast.error('First name is required.');
      return;
    }
    if (!companionName.trim()) {
      toast.error('AI Companion name is required.');
      return;
    }
    if (userMode === 'pregnancy' && !dueDate) {
      toast.error('Please specify your expected due date for Pregnancy Mode.');
      return;
    }

    // Prevent duplicate submissions
    if (isSavingRef.current || saving) return;
    isSavingRef.current = true;
    setSaving(true);
    setSaveSuccess(false);

    try {
      // 1. Save / Upsert Profile in Supabase
      const profilePayload = {
        id: userId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: firstName.trim(),
        date_of_birth: dob || null,
        ai_name: companionName.trim(),
        active_theme: userMode,
        updated_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' });

      if (profileError) {
        throw profileError;
      }

      // 2. If pregnancy mode, save due date
      if (userMode === 'pregnancy' && dueDate) {
        const { data: existingPreg } = await supabase
          .from('pregnancy_logs')
          .select('id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingPreg?.id) {
          await supabase
            .from('pregnancy_logs')
            .update({ due_date: dueDate })
            .eq('id', existingPreg.id);
        } else {
          await supabase
            .from('pregnancy_logs')
            .insert({ user_id: userId, due_date: dueDate });
        }
      }

      setSaveSuccess(true);
      toast.success('Changes saved successfully ✓');

      // 3. Immediately synchronize application context (Dashboard, Check-in, Wellness Plan, AI Companion)
      await refreshAll();

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Profile save error:', err);
      toast.error("Couldn't save your changes. Please try again.", {
        description: err.message || 'Database connection error.',
      });
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out error:', e);
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace('/login');
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CLEAN SKELETON LOADING STATE
  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto w-full px-4 py-6 md:py-10 space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="p-6 md:p-8 rounded-3xl bg-card/40 border border-border/30 flex flex-col sm:flex-row items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-secondary/70 shrink-0" />
          <div className="space-y-2.5 text-center sm:text-left flex-1 w-full">
            <div className="h-6 w-40 bg-secondary/70 rounded-md mx-auto sm:mx-0" />
            <div className="h-4 w-52 bg-secondary/50 rounded-md mx-auto sm:mx-0" />
            <div className="h-5 w-28 bg-secondary/60 rounded-full mx-auto sm:mx-0" />
          </div>
        </div>
        {/* Card Skeleton 1 */}
        <div className="p-6 rounded-3xl bg-card/40 border border-border/30 space-y-4">
          <div className="h-5 w-36 bg-secondary/70 rounded-md" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-12 bg-secondary/50 rounded-xl" />
            <div className="h-12 bg-secondary/50 rounded-xl" />
          </div>
        </div>
        {/* Card Skeleton 2 */}
        <div className="p-6 rounded-3xl bg-card/40 border border-border/30 space-y-4">
          <div className="h-5 w-36 bg-secondary/70 rounded-md" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="h-24 bg-secondary/50 rounded-2xl" />
            <div className="h-24 bg-secondary/50 rounded-2xl" />
            <div className="h-24 bg-secondary/50 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const userInitials = (firstName ? firstName.charAt(0) : 'U').toUpperCase() +
    (lastName ? lastName.charAt(0) : '').toUpperCase();
  const activeModeConfig = WELLNESS_MODES.find(m => m.id === userMode) || WELLNESS_MODES[0];

  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-4 md:py-8 space-y-6 pb-36 animate-in fade-in duration-300">
      {/* ─────────────────────────────────────────────────────────────────────────
          1. PROFILE HEADER (Apple-inspired Minimal Card)
          ───────────────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 md:p-8 rounded-3xl bg-card/70 backdrop-blur-xl border border-border/40 shadow-xl shadow-purple-500/5 relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar with gradient & initials */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 md:w-22 md:h-22 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 p-[2px] shadow-lg shadow-pink-500/20">
              <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                <span className="text-2xl md:text-3xl font-extrabold bg-gradient-to-tr from-pink-400 to-purple-400 bg-clip-text text-transparent">
                  {userInitials}
                </span>
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          {/* User Details */}
          <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground truncate">
                {firstName ? `${firstName} ${lastName}`.trim() : 'My Profile'}
              </h1>
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border self-center sm:self-auto ${activeModeConfig.bgActive} ${activeModeConfig.borderActive} ${activeModeConfig.color}`}>
                <activeModeConfig.icon className="w-3.5 h-3.5" />
                {activeModeConfig.badge}
              </span>
            </div>

            <p className="text-xs md:text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 truncate">
              <Mail className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
              {email || 'user@svanexa.ai'}
            </p>

            {userAge && (
              <p className="text-xs text-muted-foreground/90 font-medium">
                {userAge} years old
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* ─────────────────────────────────────────────────────────────────────────
          FORM CONTAINER
          ───────────────────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* ───────────────────────────────────────────────────────────────────────
            2. PERSONAL INFORMATION
            ─────────────────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-6 rounded-3xl bg-card/60 backdrop-blur-md border border-border/40 shadow-sm space-y-5"
        >
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <User className="w-4 h-4 text-pink-400" />
              Personal Information
            </h2>
            <span className="text-[11px] text-muted-foreground font-medium">
              Synced with Supabase
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* First Name */}
            <div className="space-y-1.5">
              <label htmlFor="firstNameInput" className="text-xs font-semibold text-foreground/90">
                First Name <span className="text-pink-500">*</span>
              </label>
              <input
                id="firstNameInput"
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Enter your first name"
                required
                className="w-full h-11 px-3.5 rounded-xl bg-secondary/40 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
              />
            </div>

            {/* Last Name */}
            <div className="space-y-1.5">
              <label htmlFor="lastNameInput" className="text-xs font-semibold text-foreground/90">
                Last Name
              </label>
              <input
                id="lastNameInput"
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Enter your last name"
                className="w-full h-11 px-3.5 rounded-xl bg-secondary/40 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Email (Read-only) */}
            <div className="space-y-1.5">
              <label htmlFor="emailInput" className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Email Address</span>
                <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Read-only
                </span>
              </label>
              <input
                id="emailInput"
                type="email"
                value={email}
                readOnly
                disabled
                className="w-full h-11 px-3.5 rounded-xl bg-secondary/20 border border-border/30 text-sm text-muted-foreground cursor-not-allowed select-none"
              />
            </div>

            {/* Date of Birth & Age helper */}
            <div className="space-y-1.5">
              <label htmlFor="dobInput" className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                <span>Date of Birth</span>
                {userAge !== null && (
                  <span className="text-[11px] font-bold text-pink-400">
                    {userAge} yrs
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  id="dobInput"
                  type="date"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-secondary/40 border border-border/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all scheme-dark"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ───────────────────────────────────────────────────────────────────────
            3. WELLNESS MODE SELECTION
            ─────────────────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 rounded-3xl bg-card/60 backdrop-blur-md border border-border/40 shadow-sm space-y-5"
        >
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-400" />
              Wellness Mode
            </h2>
            <span className="text-[11px] text-muted-foreground font-medium">
              Powers your Dashboard & AI Plan
            </span>
          </div>

          {/* Mode Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {WELLNESS_MODES.map((mode) => {
              const isSelected = userMode === mode.id;
              const IconComp = mode.icon;

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setUserMode(mode.id)}
                  className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between min-h-[110px] ${
                    isSelected
                      ? `${mode.bgActive} ${mode.borderActive} shadow-lg shadow-purple-500/5 ring-1 ring-purple-500/30`
                      : 'bg-secondary/20 border-border/40 hover:bg-secondary/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className={`p-2 rounded-xl bg-background/60 ${mode.color}`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>

                  <div>
                    <p className={`text-xs font-bold mb-0.5 ${isSelected ? mode.color : 'text-foreground'}`}>
                      {mode.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {mode.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pregnancy Specific: Expected Due Date */}
          {userMode === 'pregnancy' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-2 border-t border-border/30 space-y-2"
            >
              <label htmlFor="dueDateInput" className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <Baby className="w-3.5 h-3.5" /> Expected Due Date <span className="text-pink-500">*</span>
              </label>
              <input
                id="dueDateInput"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                required={userMode === 'pregnancy'}
                className="w-full h-11 px-3.5 rounded-xl bg-secondary/40 border border-amber-500/40 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all scheme-dark"
              />
              <p className="text-[11px] text-muted-foreground">
                Used to calculate gestational trimesters and tailor your daily AI recommendations.
              </p>
            </motion.div>
          )}
        </motion.div>

        {/* ───────────────────────────────────────────────────────────────────────
            4. AI COMPANION SETTINGS
            ─────────────────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="p-6 rounded-3xl bg-card/60 backdrop-blur-md border border-border/40 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              AI Companion
            </h2>
            <span className="text-[11px] text-muted-foreground font-medium">
              Assistant Customization
            </span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="companionNameInput" className="text-xs font-semibold text-foreground/90">
              Companion Name <span className="text-pink-500">*</span>
            </label>
            <input
              id="companionNameInput"
              type="text"
              value={companionName}
              onChange={e => setCompanionName(e.target.value)}
              placeholder="e.g. Luna"
              required
              className="w-full h-11 px-3.5 rounded-xl bg-secondary/40 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-all"
            />
            <p className="text-[11px] text-muted-foreground">
              Your personal AI wellness guide will introduce itself with this name in chat and daily briefings.
            </p>
          </div>
        </motion.div>

        {/* ───────────────────────────────────────────────────────────────────────
            5. APPEARANCE & SECURITY SECTIONS
            ─────────────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Appearance Card */}
          <div className="p-5 rounded-3xl bg-card/50 border border-border/40 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Palette className="w-4 h-4 text-purple-400" /> Interface & Theme
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Dark Mode (Adaptive Violet) is active. Themes and styles sync with your chosen wellness mode.
            </p>
          </div>

          {/* Security Card */}
          <div className="p-5 rounded-3xl bg-card/50 border border-border/40 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Data & Privacy
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your health data is protected via Supabase Row Level Security (RLS). Only you can access your logs.
            </p>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────────────────
            6. COLLECTIBLE HABIT BADGES
            ─────────────────────────────────────────────────────────────────────── */}
        <HabitBadges />

        {/* ───────────────────────────────────────────────────────────────────────
            7. SAVE CHANGES & SIGN OUT ACTIONS
            ─────────────────────────────────────────────────────────────────────── */}
        <div className="space-y-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className={`w-full h-12 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.99] cursor-pointer min-h-[48px] ${
              saveSuccess
                ? 'bg-emerald-600 text-white shadow-emerald-500/25'
                : 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:opacity-95 text-white shadow-purple-500/25'
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving Changes...
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> Changes saved ✓
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Changes
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full h-11 rounded-2xl border border-rose-500/30 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all min-h-[44px]"
          >
            <LogOut className="w-4 h-4" /> Sign Out of Svanexa AI
          </button>
        </div>
      </form>
    </div>
  );
}
