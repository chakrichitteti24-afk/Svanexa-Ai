'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Calendar, Heart, User, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  
  // State variables for local storage
  const [username, setUsername] = useState('Guest');
  const [aiName, setAiName] = useState('Luna');
  const [dob, setDob] = useState('');
  const [hasPCOS, setHasPCOS] = useState(false);
  const [avgCycleLength, setAvgCycleLength] = useState(28);
  const [avgPeriodLength, setAvgPeriodLength] = useState(5);

  const handleNext = () => {
    if (step === 1 && !username.trim()) {
      toast.error('Please enter a name');
      return;
    }
    if (step === 2 && !dob) {
      toast.error('Please select your date of birth');
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleComplete = () => {
    try {
      localStorage.setItem('hersync_username', username);
      localStorage.setItem('hersync_ai_name', aiName);
      localStorage.setItem('hersync_user_dob', dob);
      localStorage.setItem('hersync_has_pcos', JSON.stringify(hasPCOS));
      localStorage.setItem('hersync_avg_cycle_length', JSON.stringify(avgCycleLength));
      localStorage.setItem('hersync_avg_period_length', JSON.stringify(avgPeriodLength));
      localStorage.setItem('hersync_onboarding_completed', 'true');
      
      toast.success('Welcome to HerSync AI!', {
        description: 'Your wellness profile has been created locally.'
      });
      router.replace('/dashboard');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save profile settings.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: '#0a0a0f' }}>
      {/* Background radial gradients for premium look */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <Card className="w-full max-w-md border-pink-500/15 bg-[#12101c]/80 backdrop-blur-md shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-pink-500 to-violet-500" />
        
        <CardHeader className="text-center pt-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-6 w-6 text-pink-500 animate-pulse" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
              HerSync AI
            </span>
          </div>
          <CardTitle className="text-xl font-bold text-white">
            {step === 1 && "Let's Get Started"}
            {step === 2 && "Personal Details"}
            {step === 3 && "Cycle Calibration"}
            {step === 4 && "All Set!"}
          </CardTitle>
          <CardDescription className="text-xs text-[#5a527a]">
            Step {step} of 4 • Set up your offline experience
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pb-8">
          {/* STEP 1: Names */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs font-semibold text-white">What should we call you?</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your name"
                    className="pl-10 h-11 bg-background text-sm"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="aiName" className="text-xs font-semibold text-white">Name your AI Wellness Companion</Label>
                <div className="relative">
                  <Sparkles className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="aiName"
                    value={aiName}
                    onChange={(e) => setAiName(e.target.value)}
                    placeholder="e.g. Luna, Sage, Joy"
                    className="pl-10 h-11 bg-background text-sm"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground italic">Your AI Companion provides empathetic conversation and guidance.</p>
              </div>
            </div>
          )}

          {/* STEP 2: DOB / Age */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="space-y-2">
                <Label htmlFor="dob" className="text-xs font-semibold text-white">Date of Birth</Label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dob"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="pl-10 h-11 bg-background text-sm text-foreground scheme-dark"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Used strictly for localized calculations of age-specific trends.</p>
              </div>
            </div>
          )}

          {/* STEP 3: Cycle Info */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-pink-500/5 border border-pink-500/10">
                <div className="space-y-0.5">
                  <Label htmlFor="pcos-mode" className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-pink-500" /> PCOS / PCOD Mode
                  </Label>
                  <p className="text-[10px] text-muted-foreground">Calibrates AI predictions for irregular cycles</p>
                </div>
                <Switch
                  id="pcos-mode"
                  checked={hasPCOS}
                  onCheckedChange={setHasPCOS}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cycle-length" className="text-xs font-semibold text-white">Avg Cycle (days)</Label>
                  <Input
                    id="cycle-length"
                    type="number"
                    value={avgCycleLength}
                    onChange={(e) => setAvgCycleLength(Number(e.target.value))}
                    min={15}
                    max={100}
                    className="h-11 bg-background text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="period-length" className="text-xs font-semibold text-white">Avg Period (days)</Label>
                  <Input
                    id="period-length"
                    type="number"
                    value={avgPeriodLength}
                    onChange={(e) => setAvgPeriodLength(Number(e.target.value))}
                    min={2}
                    max={20}
                    className="h-11 bg-background text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Complete */}
          {step === 4 && (
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-4 animate-in scale-in duration-300">
              <div className="h-16 w-16 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/25">
                <CheckCircle2 className="h-10 w-10 text-green-400" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-white text-base">Your Profile is Ready!</h3>
                <p className="text-xs text-[#7c71a4] max-w-xs">
                  We will save your check-ins, skin logs, and cycle data completely offline in your browser's local storage. No logins required.
                </p>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 pt-2">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1 h-11 text-xs rounded-full border-border/40 hover:bg-secondary/40"
              >
                Back
              </Button>
            )}
            
            {step < 4 ? (
              <Button
                onClick={handleNext}
                className="flex-1 h-11 text-xs rounded-full bg-gradient-to-r from-pink-600 to-violet-600 text-white font-medium border-0"
              >
                Continue
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                className="flex-1 h-11 text-xs rounded-full bg-gradient-to-r from-pink-600 to-violet-600 text-white font-medium border-0"
              >
                Let's Start!
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
