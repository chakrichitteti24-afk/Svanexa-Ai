'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { User, Sparkles, Shield, Heart, LogOut, Loader2, Save } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { HabitBadges } from '@/components/profile/HabitBadges';
import { useHerSync } from '@/context/HerSyncContext';

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const { refreshAll } = useHerSync();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [companionName, setCompanionName] = useState('Luna');
  const [userMode, setUserMode] = useState<'general' | 'pcos' | 'pregnancy'>('general');
  const [dueDate, setDueDate] = useState('');

  // Prevent duplicate save on fast double-click
  const isSavingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function fetchProfile() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push('/login');
          return;
        }

        if (!mounted) return;
        setUserId(user.id);

        // Use maybeSingle() everywhere to avoid errors when row doesn't exist
        const [profileRes, pregRes] = await Promise.all([
          supabase.from('profiles').select('first_name, last_name, date_of_birth, ai_name, active_theme').eq('id', user.id).maybeSingle(),
          supabase.from('pregnancy_logs').select('due_date').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);

        if (!mounted) return;

        if (profileRes.data) {
          setFirstName(profileRes.data.first_name || '');
          setLastName(profileRes.data.last_name || '');
          setDob(profileRes.data.date_of_birth || '');
          setCompanionName(profileRes.data.ai_name || 'Luna');
          const theme = profileRes.data.active_theme as 'general' | 'pcos' | 'pregnancy';
          if (theme) setUserMode(theme);
        }

        if (pregRes.data) {
          setDueDate(pregRes.data.due_date || '');
        }

      } catch (e) {
        console.error('Error fetching profile', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchProfile();

    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast.error('Not authenticated. Please log in again.');
      return;
    }

    // Validate required fields
    if (!firstName.trim()) {
      toast.error('First name is required.');
      return;
    }
    if (!companionName.trim()) {
      toast.error('Companion name is required.');
      return;
    }
    if (userMode === 'pregnancy' && !dueDate) {
      toast.error('Please enter your expected due date.');
      return;
    }

    // Prevent duplicate submissions
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setSaving(true);

    try {
      // 1. Update Profile (including ai_name and active_theme)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: dob || null,
          ai_name: companionName.trim(),
          active_theme: userMode,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileError) {
        // If update fails because no row exists, insert one
        if (profileError.code === 'PGRST116' || profileError.message?.includes('0 rows')) {
          const { error: insertError } = await supabase.from('profiles').upsert({
            id: userId,
            username: firstName.trim(),
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            date_of_birth: dob || null,
            ai_name: companionName.trim(),
            active_theme: userMode,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
          if (insertError) throw insertError;
        } else {
          throw profileError;
        }
      }

      // 2. Update Pregnancy Logs if applicable
      if (userMode === 'pregnancy' && dueDate) {
        // Safe upsert: check if row exists first
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

      toast.success('Profile saved successfully!');

      // Refresh all context so navbar, dashboard, AI companion reflect new values immediately
      await refreshAll();

    } catch (err: any) {
      console.error('Profile save error:', err);
      toast.error(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 pb-24 animate-in fade-in duration-500 md:py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">My Profile</h1>
          <p className="text-xs text-muted-foreground">Securely synced with Supabase</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-muted-foreground hover:text-red-500 rounded-full h-10 w-10">
          <LogOut className="w-5 h-5" />
        </Button>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Personal Details Card */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="w-4 h-4 text-pink-500" /> Account Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">First Name *</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-11 bg-background text-sm"
                  placeholder="Your first name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Last Name</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-11 bg-background text-sm"
                  placeholder="Your last name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Date of Birth</Label>
              <Input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="h-11 bg-background text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Companion Setup Card */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-500" /> AI Companion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Companion Name *</Label>
              <Input
                value={companionName}
                onChange={e => setCompanionName(e.target.value)}
                className="h-11 bg-background text-sm"
                placeholder="e.g. Luna"
                required
              />
              <p className="text-xs text-muted-foreground">This is the name your AI wellness companion will use.</p>
            </div>
          </CardContent>
        </Card>

        {/* Wellness Focus Card */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-500" /> Wellness Focus
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs">Primary Mode</Label>
              <Select value={userMode} onValueChange={(val: string | null) => val && setUserMode(val as 'general' | 'pcos' | 'pregnancy')}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Women&apos;s Wellness</SelectItem>
                  <SelectItem value="pcos">PCOS / PCOD Mode</SelectItem>
                  <SelectItem value="pregnancy">Pregnancy Mode</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {userMode === 'pregnancy' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label className="text-xs">Expected Due Date *</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-11 bg-background text-sm scheme-dark"
                  required={userMode === 'pregnancy'}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Collectible Habit Badges */}
        <HabitBadges />

        <Button
          type="submit"
          disabled={saving}
          className="w-full h-12 rounded-xl text-sm bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-90 text-white font-medium shadow-md shadow-pink-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving
            ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Saving...</>
            : <><Save className="w-4 h-4 mr-2" /> Save Profile Details</>}
        </Button>
      </form>
    </div>
  );
}
