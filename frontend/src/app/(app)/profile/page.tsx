'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
  Edit3,
  X,
  RotateCcw,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { HabitBadges } from '@/components/profile/HabitBadges';
import { useHerSync } from '@/context/HerSyncContext';

type WellnessMode = 'general' | 'pcos' | 'pregnancy';

interface ProfileData {
  firstName: string;
  lastName: string;
  dob: string;
  companionName: string;
  userMode: WellnessMode;
  dueDate: string;
}

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
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  // Persisted source-of-truth copy to discard changes on Cancel
  const [savedData, setSavedData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    dob: '',
    companionName: 'Luna',
    userMode: 'general',
    dueDate: '',
  });

  // Working state for form inputs
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [companionName, setCompanionName] = useState('Luna');
  const [userMode, setUserMode] = useState<WellnessMode>('general');
  const [dueDate, setDueDate] = useState('');

  // Field validation error state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  // Prevent duplicate submit on fast double-click
  const isSavingRef = useRef(false);

  // Calculate age dynamically
  const userAge = useMemo(() => calculateAge(dob), [dob]);

  // Check if form has unsaved modifications
  const isDirty = useMemo(() => {
    return (
      firstName !== savedData.firstName ||
      lastName !== savedData.lastName ||
      dob !== savedData.dob ||
      companionName !== savedData.companionName ||
      userMode !== savedData.userMode ||
      dueDate !== savedData.dueDate
    );
  }, [firstName, lastName, dob, companionName, userMode, dueDate, savedData]);

  const loadProfile = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace('/login');
        return;
      }

      setUserId(user.id);
      setEmail(user.email || '');

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

      const initialData: ProfileData = {
        firstName: profileRes.data?.first_name || profileRes.data?.username || user.user_metadata?.first_name || user.user_metadata?.username || '',
        lastName: profileRes.data?.last_name || user.user_metadata?.last_name || '',
        dob: profileRes.data?.date_of_birth || '',
        companionName: profileRes.data?.ai_name || 'Luna',
        userMode: (profileRes.data?.active_theme as WellnessMode) || 'general',
        dueDate: pregRes.data?.due_date || '',
      };

      setSavedData(initialData);
      setFirstName(initialData.firstName);
      setLastName(initialData.lastName);
      setDob(initialData.dob);
      setCompanionName(initialData.companionName);
      setUserMode(initialData.userMode);
      setDueDate(initialData.dueDate);
      setErrors({});
    } catch (e) {
      console.error('Error fetching profile', e);
      toast.error('Unable to load profile data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) {
      newErrors.firstName = 'This field is required.';
    }
    if (!companionName.trim()) {
      newErrors.companionName = 'This field is required.';
    }
    if (userMode === 'pregnancy' && !dueDate) {
      newErrors.dueDate = 'This field is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStartEditing = () => {
    setErrors({});
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    if (isDirty) {
      setShowUnsavedModal(true);
      return;
    }
    discardChanges();
  };

  const discardChanges = () => {
    setFirstName(savedData.firstName);
    setLastName(savedData.lastName);
    setDob(savedData.dob);
    setCompanionName(savedData.companionName);
    setUserMode(savedData.userMode);
    setDueDate(savedData.dueDate);
    setErrors({});
    setIsEditing(false);
    setShowUnsavedModal(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast.error('Not authenticated. Please log in again.');
      return;
    }

    if (!validateForm()) {
      toast.error('Please fill in all required fields.');
      return;
    }

    if (isSavingRef.current || saving) return;
    isSavingRef.current = true;
    setSaving(true);

    try {
      // 1. Save Profile in Supabase
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
        try {
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
        } catch (pregErr) {
          console.warn('Optional pregnancy log save notice:', pregErr);
        }
      }


      // 3. Update saved source-of-truth
      const updatedData: ProfileData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dob,
        companionName: companionName.trim(),
        userMode,
        dueDate: userMode === 'pregnancy' ? dueDate : '',
      };
      setSavedData(updatedData);

      toast.success('Profile saved successfully.');

      // 4. Return to read-only mode & refresh app context
      setIsEditing(false);
      setErrors({});
      await refreshAll();

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
        <div className="p-6 md:p-8 rounded-3xl bg-card/40 border border-border/30 flex flex-col sm:flex-row items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-secondary/70 shrink-0" />
          <div className="space-y-2.5 text-center sm:text-left flex-1 w-full">
            <div className="h-6 w-40 bg-secondary/70 rounded-md mx-auto sm:mx-0" />
            <div className="h-4 w-52 bg-secondary/50 rounded-md mx-auto sm:mx-0" />
            <div className="h-5 w-28 bg-secondary/60 rounded-full mx-auto sm:mx-0" />
          </div>
        </div>
        <div className="p-6 rounded-3xl bg-card/40 border border-border/30 space-y-4">
          <div className="h-5 w-36 bg-secondary/70 rounded-md" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-12 bg-secondary/50 rounded-xl" />
            <div className="h-12 bg-secondary/50 rounded-xl" />
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
          TOP BAR: TITLE & DISTINCT SEPARATE LOGOUT BUTTON
          ───────────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Profile & Settings</h1>
          <p className="text-xs text-muted-foreground">Manage your personal details and wellness preferences</p>
        </div>

        {/* Visually distinct Logout at top-right */}
        <button
          type="button"
          onClick={handleSignOut}
          className="px-4 py-2 rounded-full border border-rose-500/30 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0 min-h-[38px]"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Logout</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          1. PROFILE HEADER CARD
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
          <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground truncate">
                {firstName ? `${firstName} ${lastName}`.trim() : 'My Profile'}
              </h2>
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

        {/* Read-Only State Helper Banner when locked */}
        {!isEditing && (
          <div className="mt-5 pt-4 border-t border-border/30 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-violet-400" />
              <span>Profile is currently in <strong>read-only</strong> mode.</span>
            </div>
            <button
              type="button"
              onClick={handleStartEditing}
              className="px-4 py-1.5 rounded-full bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-300 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Profile
            </button>
          </div>
        )}
      </motion.div>

      {/* ─────────────────────────────────────────────────────────────────────────
          FORM CONTAINER
          ───────────────────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* ───────────────────────────────────────────────────────────────────────
            2. PERSONAL INFORMATION (READ-ONLY OR EDITABLE)
            ─────────────────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`p-6 rounded-3xl bg-card/60 backdrop-blur-md border ${isEditing ? 'border-pink-500/30 ring-1 ring-pink-500/20' : 'border-border/40'} shadow-sm space-y-5 transition-all`}
        >
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <User className="w-4 h-4 text-pink-400" />
              Personal Information
            </h2>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${isEditing ? 'bg-pink-500/15 text-pink-400' : 'bg-secondary/40 text-muted-foreground'}`}>
              {isEditing ? 'Editing Enabled' : 'Read-Only'}
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
                disabled={!isEditing}
                onChange={e => {
                  setFirstName(e.target.value);
                  if (errors.firstName) setErrors(prev => ({ ...prev, firstName: '' }));
                }}
                placeholder="Enter your first name"
                className={`w-full h-11 px-3.5 rounded-xl text-sm transition-all ${
                  isEditing
                    ? 'bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-pink-500/40'
                    : 'bg-secondary/20 border border-border/30 text-muted-foreground/90 cursor-not-allowed select-none'
                } ${errors.firstName ? 'border-rose-500 focus:ring-rose-500/40' : ''}`}
              />
              {errors.firstName && (
                <p className="text-[11px] text-rose-400 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {errors.firstName}
                </p>
              )}
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
                disabled={!isEditing}
                onChange={e => setLastName(e.target.value)}
                placeholder="Enter your last name"
                className={`w-full h-11 px-3.5 rounded-xl text-sm transition-all ${
                  isEditing
                    ? 'bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-pink-500/40'
                    : 'bg-secondary/20 border border-border/30 text-muted-foreground/90 cursor-not-allowed select-none'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Email (Always Read-only) */}
            <div className="space-y-1.5">
              <label htmlFor="emailInput" className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Email Address</span>
                <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Protected
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
              <input
                id="dobInput"
                type="date"
                value={dob}
                disabled={!isEditing}
                onChange={e => setDob(e.target.value)}
                className={`w-full h-11 px-3.5 rounded-xl text-sm transition-all scheme-dark ${
                  isEditing
                    ? 'bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-pink-500/40'
                    : 'bg-secondary/20 border border-border/30 text-muted-foreground/90 cursor-not-allowed select-none'
                }`}
              />
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
          className={`p-6 rounded-3xl bg-card/60 backdrop-blur-md border ${isEditing ? 'border-pink-500/30 ring-1 ring-pink-500/20' : 'border-border/40'} shadow-sm space-y-5 transition-all`}
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
                  disabled={!isEditing}
                  onClick={() => {
                    if (isEditing) {
                      setUserMode(mode.id);
                      if (errors.dueDate) setErrors(prev => ({ ...prev, dueDate: '' }));
                    }
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between min-h-[110px] ${
                    !isEditing
                      ? isSelected
                        ? `${mode.bgActive} ${mode.borderActive} opacity-100 cursor-default`
                        : 'bg-secondary/10 border-border/20 opacity-50 cursor-not-allowed'
                      : isSelected
                      ? `${mode.bgActive} ${mode.borderActive} shadow-lg shadow-purple-500/5 ring-2 ring-purple-500/40 cursor-pointer`
                      : 'bg-secondary/20 border-border/40 hover:bg-secondary/40 cursor-pointer'
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
                disabled={!isEditing}
                onChange={e => {
                  setDueDate(e.target.value);
                  if (errors.dueDate) setErrors(prev => ({ ...prev, dueDate: '' }));
                }}
                className={`w-full h-11 px-3.5 rounded-xl text-sm transition-all scheme-dark ${
                  isEditing
                    ? 'bg-secondary/50 border border-amber-500/50 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40'
                    : 'bg-secondary/20 border border-border/30 text-muted-foreground/90 cursor-not-allowed select-none'
                } ${errors.dueDate ? 'border-rose-500' : ''}`}
              />
              {errors.dueDate ? (
                <p className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {errors.dueDate}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Used to calculate gestational trimesters and tailor your daily AI recommendations.
                </p>
              )}
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
          className={`p-6 rounded-3xl bg-card/60 backdrop-blur-md border ${isEditing ? 'border-pink-500/30 ring-1 ring-pink-500/20' : 'border-border/40'} shadow-sm space-y-4 transition-all`}
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
              disabled={!isEditing}
              onChange={e => {
                setCompanionName(e.target.value);
                if (errors.companionName) setErrors(prev => ({ ...prev, companionName: '' }));
              }}
              placeholder="e.g. Luna"
              className={`w-full h-11 px-3.5 rounded-xl text-sm transition-all ${
                isEditing
                  ? 'bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40'
                  : 'bg-secondary/20 border border-border/30 text-muted-foreground/90 cursor-not-allowed select-none'
              } ${errors.companionName ? 'border-rose-500' : ''}`}
            />
            {errors.companionName ? (
              <p className="text-[11px] text-rose-400 font-semibold flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {errors.companionName}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Your personal AI wellness guide will introduce itself with this name in chat and daily briefings.
              </p>
            )}
          </div>
        </motion.div>

        {/* ───────────────────────────────────────────────────────────────────────
            5. APPEARANCE & SECURITY SECTIONS
            ─────────────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-3xl bg-card/50 border border-border/40 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Palette className="w-4 h-4 text-purple-400" /> Interface & Theme
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Dark Mode (Adaptive Violet) is active. Themes and styles sync with your chosen wellness mode.
            </p>
          </div>

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
            7. DYNAMIC ACTIONS: [ Edit Profile ] VS [ Save Changes ] [ Cancel ]
            ─────────────────────────────────────────────────────────────────────── */}
        <div className="pt-2">
          {!isEditing ? (
            /* READ-ONLY STATE: Primary "Edit Profile" Button */
            <button
              type="button"
              onClick={handleStartEditing}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:opacity-95 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 transition-all active:scale-[0.99] cursor-pointer min-h-[48px]"
            >
              <Edit3 className="w-4 h-4" /> Edit Profile
            </button>
          ) : (
            /* EDITING STATE: "Save Changes" and "Cancel" */
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:flex-1 h-12 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:opacity-95 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed min-h-[48px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Changes
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleCancelEditing}
                className="w-full sm:w-auto px-6 h-12 rounded-2xl border border-border/60 hover:bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] cursor-pointer min-h-[48px]"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
          )}
        </div>
      </form>

      {/* ─────────────────────────────────────────────────────────────────────────
          UNSAVED CHANGES MODAL
          ───────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showUnsavedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 rounded-3xl bg-card border border-border/60 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Unsaved Changes</h3>
                  <p className="text-xs text-muted-foreground">You have unsaved changes. Leave without saving?</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUnsavedModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-all"
                >
                  Stay
                </button>
                <button
                  type="button"
                  onClick={discardChanges}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white transition-all shadow-md shadow-rose-500/20"
                >
                  Discard Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
