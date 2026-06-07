'use client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { useLocalStorage } from '@/hooks/useLocalStorage';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { User, Settings, Sparkles, Shield, Trash2, Heart } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ProfilePage() {
  const [name, setName] = useLocalStorage('hersync_user_name', 'Sarah');
  const [age, setAge] = useLocalStorage('hersync_user_age', '26');
  const [weight, setWeight] = useLocalStorage('hersync_user_weight', '62');
  const [hasPCOS, setHasPCOS] = useLocalStorage('hersync_has_pcos', false);
  const [avgCycleLength, setAvgCycleLength] = useLocalStorage('hersync_avg_cycle_length', 28);
  const [avgPeriodLength, setAvgPeriodLength] = useLocalStorage('hersync_avg_period_length', 5);

  const [companionName, setCompanionName] = useLocalStorage('hersync_companion_name', 'HerSync AI');
  const [language, setLanguage] = useLocalStorage('hersync_language', 'English');
  const [personality, setPersonality] = useLocalStorage('hersync_personality', 'Friendly');

  const [isSaved, setIsSaved] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    toast.success('Profile settings updated successfully!');
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleClearAllData = () => {
    if (confirm('Are you sure you want to delete all your tracking logs, cycle history, and reset your preferences? This cannot be undone.')) {
      localStorage.clear();
      toast.success('All data has been reset. Reloading app...');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">My Health Profile</h1>
        <p className="text-xs text-muted-foreground">Manage your settings, PCOS parameters, and AI companion settings.</p>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Personal Details Card */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="w-4 h-4 text-pink-500" /> Demographic Info
            </CardTitle>
            <CardDescription className="text-[10px]">Your personal metrics support cycle predictions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name" className="text-xs">Your Name</Label>
              <Input 
                id="user-name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="h-11 bg-background text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user-age" className="text-xs">Age (years)</Label>
                <Input 
                  id="user-age" 
                  type="number" 
                  value={age} 
                  onChange={(e) => setAge(e.target.value)} 
                  className="h-11 bg-background text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-weight" className="text-xs">Weight (kg)</Label>
                <Input 
                  id="user-weight" 
                  type="number" 
                  value={weight} 
                  onChange={(e) => setWeight(e.target.value)} 
                  className="h-11 bg-background text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PCOS & Cycle parameters Card */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-500" /> Cycle & Condition parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-pink-500/5 border border-pink-500/10">
              <div className="space-y-0.5">
                <Label htmlFor="profile-pcos-mode" className="text-sm font-medium">PCOS / PCOD Mode</Label>
                <p className="text-[10px] text-muted-foreground">Adjust predictions for cycle irregularities</p>
              </div>
              <Switch 
                id="profile-pcos-mode" 
                checked={hasPCOS} 
                onCheckedChange={setHasPCOS} 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cycle-len" className="text-xs">Avg Cycle (days)</Label>
                <Input 
                  id="cycle-len" 
                  type="number" 
                  value={avgCycleLength} 
                  onChange={(e) => setAvgCycleLength(Number(e.target.value))} 
                  className="h-11 bg-background text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period-len" className="text-xs">Avg Period (days)</Label>
                <Input 
                  id="period-len" 
                  type="number" 
                  value={avgPeriodLength} 
                  onChange={(e) => setAvgPeriodLength(Number(e.target.value))} 
                  className="h-11 bg-background text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Companion Setup Card */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-500" /> AI Companion Config
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Companion Name</Label>
              <Input 
                value={companionName} 
                onChange={e => setCompanionName(e.target.value)} 
                className="h-11 bg-background text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Language</Label>
              <Select value={language} onValueChange={(val) => setLanguage(val || '')}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Hindi">Hindi (हिंदी)</SelectItem>
                  <SelectItem value="Telugu">Telugu (తెలుగు)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Personality</Label>
              <Select value={personality} onValueChange={(val) => setPersonality(val || '')}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Friendly">Friendly & Empathetic</SelectItem>
                  <SelectItem value="Professional">Professional & Direct</SelectItem>
                  <SelectItem value="Motivational">Motivational Coach</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Health Trackers & Tools */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4 text-pink-500" /> Trackers & Analytics
            </CardTitle>
            <CardDescription className="text-[10px]">Access advanced tracking modules.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Link href="/skin" className="w-full">
              <Button type="button" variant="outline" className="w-full h-12 rounded-xl text-xs flex flex-col justify-center items-center gap-1 border-border/60 hover:bg-secondary/40">
                <span className="text-lg">📷</span>
                <span>Skin Tracker</span>
              </Button>
            </Link>
            <Link href="/reports" className="w-full">
              <Button type="button" variant="outline" className="w-full h-12 rounded-xl text-xs flex flex-col justify-center items-center gap-1 border-border/60 hover:bg-secondary/40">
                <span>📊</span>
                <span>Health Reports</span>
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Button 
          type="submit" 
          className="w-full h-12 rounded-full text-sm bg-pink-600 hover:bg-pink-500 text-white font-medium"
        >
          {isSaved ? 'Saved! ✨' : 'Save Profile Preferences'}
        </Button>

        {/* Destructive zone */}
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-red-500 font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-500" /> Reset Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              type="button"
              variant="outline" 
              className="w-full h-11 text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20 bg-background/50 text-xs" 
              onClick={handleClearAllData}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Clear All Local Tracking Data
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
