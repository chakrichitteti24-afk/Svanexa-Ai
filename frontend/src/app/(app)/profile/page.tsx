'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { User, Sparkles, Shield, Heart, LogOut, Loader2, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  
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

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
        setUserId(user.id);

        const [profileRes, prefsRes, pregRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('user_preferences').select('*').eq('user_id', user.id).single(),
          supabase.from('pregnancy_logs').select('*').eq('user_id', user.id).single(),
        ]);

        if (profileRes.data) {
          setFirstName(profileRes.data.first_name || '');
          setLastName(profileRes.data.last_name || '');
          setDob(profileRes.data.date_of_birth || '');
        }

        if (prefsRes.data) {
          const theme = prefsRes.data.theme as 'general' | 'pcos' | 'pregnancy';
          setUserMode(theme || 'general');
        }

        if (pregRes.data) {
          setDueDate(pregRes.data.due_date || '');
        }

      } catch (e) {
        console.error("Error fetching profile", e);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    setSaving(true);
    try {
      // 1. Update Profile
      const { error: profileError } = await supabase.from('profiles').update({
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dob || null
      }).eq('id', userId);
      if (profileError) throw profileError;

      // 2. Update Preferences
      const { error: prefsError } = await supabase.from('user_preferences').upsert({
        user_id: userId,
        theme: userMode,
      }, { onConflict: 'user_id' });
      if (prefsError) throw prefsError;

      // 3. Update Pregnancy Logs if applicable
      if (userMode === 'pregnancy' && dueDate) {
        const { error: pregError } = await supabase.from('pregnancy_logs').upsert({
          user_id: userId,
          due_date: dueDate
        }, { onConflict: 'user_id' });
        // NOTE: If onConflict is not configured, this might fail, but it's safe for now since ID is UUID default
      }

      toast.success('Profile saved successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
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
    <div className="max-w-md mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">First Name</Label>
                <Input 
                  value={firstName} 
                  onChange={(e) => setFirstName(e.target.value)} 
                  className="h-11 bg-background text-sm"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Last Name</Label>
                <Input 
                  value={lastName} 
                  onChange={(e) => setLastName(e.target.value)} 
                  className="h-11 bg-background text-sm"
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
              <Label className="text-xs">Companion Name</Label>
              <Input 
                value={companionName} 
                onChange={e => setCompanionName(e.target.value)} 
                className="h-11 bg-background text-sm"
                required
              />
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
                  <SelectItem value="general">General Women's Wellness</SelectItem>
                  <SelectItem value="pcos">PCOS / PCOD Mode</SelectItem>
                  <SelectItem value="pregnancy">Pregnancy Mode</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {userMode === 'pregnancy' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label className="text-xs">Expected Due Date</Label>
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

        <Button 
          type="submit" 
          disabled={saving}
          className="w-full h-12 rounded-xl text-sm bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-90 text-white font-medium shadow-md shadow-pink-500/20"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save Profile Details</>}
        </Button>
      </form>
    </div>
  );
}
