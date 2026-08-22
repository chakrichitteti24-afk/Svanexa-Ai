'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Trash2, 
  Loader2, 
  Camera, 
  X, 
  Sparkles, 
  Plus, 
  History, 
  CheckCircle2, 
  AlertTriangle, 
  Droplets, 
  Flame, 
  Sparkle,
  RefreshCw,
  Upload,
  CircleDot,
  Copy,
  Check,
  Printer,
  Timer,
  Search,
  Maximize2,
  ShieldCheck,
  Sun,
  Moon,
  Info
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { createClient } from '@/utils/supabase/client';
import { useHerSync } from '@/context/HerSyncContext';
import { WeatherWidget } from '@/components/weather/WeatherWidget';
import { isNonSkinImageAlert } from '@/lib/utils/skin-helpers';

type SkinEntry = {
  id: string;
  date: string;
  condition: string;
  notes: string;
  parsedNotes?: { 
    oiliness: number; 
    dryness: number; 
    skinType?: string;
    concerns?: string[];
    text: string; 
    photoUrl?: string; 
    aiReport?: string 
  };
};

const SKIN_TYPES = [
  { id: 'Combination', label: 'Combination', desc: 'Oily T-zone, normal/dry cheeks' },
  { id: 'Oily', label: 'Oily', desc: 'Excess sebum, visible shine all over' },
  { id: 'Dry', label: 'Dry', desc: 'Tight, flaky, low moisture' },
  { id: 'Sensitive', label: 'Sensitive', desc: 'Prone to stinging, redness, reactive' },
  { id: 'Normal', label: 'Balanced / Normal', desc: 'Comfortable, neither dry nor oily' },
];

const AVAILABLE_CONCERNS = [
  { id: 'Hormonal Breakouts', label: 'Hormonal Breakouts 🌸' },
  { id: 'Clogged Pores', label: 'Clogged Pores / Blackheads 🔍' },
  { id: 'Active Acne Flare-up', label: 'Active Acne / Blemishes 💥' },
  { id: 'Redness & Irritation', label: 'Redness & Sensitivity 🌡️' },
  { id: 'Dark Spots / PIH', label: 'Dark Spots & Acne Marks ✨' },
  { id: 'Dry Flakes', label: 'Dry Flakes & Tight Barrier 💧' },
];

// Helper to compress image and convert to Base64 data URL (higher resolution 1200px, 0.85 quality)
const compressImageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const scale = MAX_WIDTH / img.width;
        
        if (img.width > MAX_WIDTH) {
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function SkinTrackerPage() {
  const { skinLogs, refreshSkinLogs, wellnessMode } = useHerSync();
  const [userId, setUserId] = useState<string | null>(null);
  
  // Dermatological inputs
  const [acne, setAcne] = useState(5);
  const [oiliness, setOiliness] = useState(5);
  const [dryness, setDryness] = useState(2);
  const [skinType, setSkinType] = useState('Combination');
  const [concerns, setConcerns] = useState<string[]>(['Active Acne Flare-up']);
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanningStep, setScanningStep] = useState(1);

  // Live Camera States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [useTimer, setUseTimer] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flashActive, setFlashActive] = useState(false);

  // Report & History UX
  const [copiedRoutine, setCopiedRoutine] = useState(false);
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [localLogs, setLocalLogs] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('svanexa_skin_scans');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return [];
  });
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, [supabase]);

  // Clean up camera stream when closing or unmounting
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // Ensure video element gets stream attached when camera opens
  useEffect(() => {
    if (isCameraOpen && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraOpen, cameraStream]);

  // Multi-step progress animation during AI scan
  useEffect(() => {
    if (analyzing) {
      setScanningStep(1);
      const t1 = setTimeout(() => setScanningStep(2), 1200);
      const t2 = setTimeout(() => setScanningStep(3), 2800);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [analyzing]);

  const startLiveCamera = async (facing: 'user' | 'environment' = cameraFacing) => {
    setCameraLoading(true);
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 1280 }
        },
        audio: false
      });
      setCameraStream(stream);
      setCameraFacing(facing);
      setIsCameraOpen(true);
    } catch (err: any) {
      console.error('Camera open failed:', err);
      toast.error('Unable to access camera', {
        description: 'Please grant camera permission in your browser or select a photo from your gallery.'
      });
      setIsCameraOpen(false);
    } finally {
      setCameraLoading(false);
    }
  };

  const stopLiveCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
    setCountdown(null);
  };

  const switchCameraFacing = () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    startLiveCamera(nextFacing);
  };

  const capturePhotoFromCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const MAX_WIDTH = 1200;
    const scale = width > MAX_WIDTH ? MAX_WIDTH / width : 1;
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (cameraFacing === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    const base64Data = canvas.toDataURL('image/jpeg', 0.85);
    setPhotoPreview(base64Data);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `skin-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setPhotoFile(file);
      }
    }, 'image/jpeg', 0.85);

    stopLiveCamera();
    toast.success('Selfie captured! Ready for clinical AI inspection.');
  };

  const handleTriggerCapture = () => {
    if (useTimer) {
      setCountdown(3);
      let count = 3;
      const interval = setInterval(() => {
        count -= 1;
        if (count <= 0) {
          clearInterval(interval);
          setCountdown(null);
          setFlashActive(true);
          setTimeout(() => setFlashActive(false), 200);
          capturePhotoFromCamera();
        } else {
          setCountdown(count);
        }
      }, 1000);
    } else {
      setFlashActive(true);
      setTimeout(() => setFlashActive(false), 200);
      capturePhotoFromCamera();
    }
  };

  const dbEntries = (Array.isArray(skinLogs) ? skinLogs : []).map(d => {
    let parsedNotes = { 
      oiliness: 5, 
      dryness: 2, 
      skinType: 'Combination',
      concerns: [] as string[],
      text: d.notes || '', 
      photoUrl: '', 
      aiReport: '' 
    };
    try {
      if (d.notes && typeof d.notes === 'string' && d.notes.startsWith('{')) {
        parsedNotes = JSON.parse(d.notes);
      }
    } catch (e) {}
    return { 
      id: d.id,
      date: (d as any).log_date || (d as any).date || '',
      condition: String((d as any).acne ?? 5),
      notes: d.notes || '',
      parsedNotes 
    };
  });

  const dbDates = new Set(dbEntries.map(e => e.date));
  const filteredLocal = (Array.isArray(localLogs) ? localLogs : []).filter(l => l && !dbDates.has(l.date));
  const allEntries = [...dbEntries, ...filteredLocal];

  const filteredEntries = allEntries.filter(entry => {
    if (!historySearch.trim()) return true;
    const query = historySearch.toLowerCase();
    const dateStr = entry.date.toLowerCase();
    const typeStr = (entry.parsedNotes?.skinType || '').toLowerCase();
    const textStr = (entry.parsedNotes?.text || '').toLowerCase();
    return dateStr.includes(query) || typeStr.includes(query) || textStr.includes(query);
  });

  const selectedEntry = allEntries.find(e => e.id === selectedEntryId);

  const toggleConcern = (concernId: string) => {
    if (concerns.includes(concernId)) {
      setConcerns(concerns.filter(c => c !== concernId));
    } else {
      setConcerns([...concerns, concernId]);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      stopLiveCamera();
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleStartNewScan = () => {
    stopLiveCamera();
    setSelectedEntryId(null);
    setAnalysis(null);
    setAcne(5);
    setOiliness(5);
    setDryness(2);
    setSkinType('Combination');
    setConcerns(['Active Acne Flare-up']);
    setNotes('');
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleDeleteEntry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (!id.startsWith('local_')) {
        await supabase.from('skin_logs').delete().eq('id', id);
        await refreshSkinLogs();
      }
      
      const updatedLocal = localLogs.filter(item => item.id !== id);
      localStorage.setItem('svanexa_skin_scans', JSON.stringify(updatedLocal));
      setLocalLogs(updatedLocal);
      
      toast.success('Scan report deleted.');
      if (selectedEntryId === id) {
        setSelectedEntryId(null);
      }
    } catch (err: any) {
      toast.error('Failed to delete report');
    }
  };

  const handleCopyRoutine = () => {
    if (!analysis) return;
    navigator.clipboard.writeText(analysis);
    setCopiedRoutine(true);
    toast.success('Skincare protocol copied to clipboard!', {
      description: 'You can paste it into your notes or share it with your dermatologist.'
    });
    setTimeout(() => setCopiedRoutine(false), 2500);
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      let photoBase64 = '';
      if (photoFile) {
        toast.info('Preparing high-resolution skin photo for clinical inspection...', { duration: 1500 });
        photoBase64 = await compressImageToBase64(photoFile);
      }

      toast.info('Analyzing skin barrier & verifying visual metrics with AI...', { duration: 3500 });
      const response = await fetch('/api/skin-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          acne,
          oiliness,
          dryness,
          skinType,
          concerns,
          notes,
          photoBase64
        })
      });
      
      const data = await response.json();
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
        const today = format(new Date(), 'yyyy-MM-dd');
        const complexNotes = JSON.stringify({ 
          oiliness, 
          dryness, 
          skinType,
          concerns,
          text: notes, 
          photoUrl: photoBase64, 
          aiReport: data.analysis 
        });

        let savedInSupabase = false;

        if (userId) {
          try {
            const { data: insertedData, error: saveErr } = await supabase.from('skin_logs').upsert({
              user_id: userId,
              log_date: today,
              acne: acne,
              oiliness: oiliness,
              dryness: dryness,
              notes: complexNotes,
              image: photoBase64
            }, {
              onConflict: 'user_id,log_date'
            }).select();

            if (!saveErr && insertedData?.[0]) {
              await refreshSkinLogs();
              setSelectedEntryId(insertedData[0].id);
              savedInSupabase = true;
            }
          } catch (e) {
            console.log("Database save fallback active.");
          }
        }

        try {
          const newEntry = {
            id: 'local_' + Date.now(),
            date: today,
            condition: String(acne),
            notes: complexNotes,
            parsedNotes: {
              oiliness,
              dryness,
              skinType,
              concerns,
              text: notes,
              photoUrl: photoBase64,
              aiReport: data.analysis
            }
          };
          const updated = [newEntry, ...localLogs.filter(item => item.date !== today)];
          localStorage.setItem('svanexa_skin_scans', JSON.stringify(updated));
          setLocalLogs(updated);
          if (!savedInSupabase) {
            setSelectedEntryId(newEntry.id);
          }
        } catch (localErr) {}

        if (data.isImageInvalid) {
          toast.warning('Non-skin image detected', { description: 'Please upload a clear photo of your skin or face for visual grading.' });
        } else {
          toast.success('Clinical AI Skin Analysis complete!');
        }
      } else {
        toast.error('Failed to run AI Analysis', { description: data.message || data.error });
      }
    } catch (err: any) {
      toast.error('Analysis failed', { description: err.message });
    } finally {
      setAnalyzing(false);
    }
  };

  // Dynamic Slider Descriptions
  const getAcneInfo = (val: number) => {
    if (val <= 2) return { text: 'Calm & Clear Skin', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    if (val <= 4) return { text: 'Mild / Occasional Blemishes', badge: 'bg-teal-500/20 text-teal-300 border-teal-500/30' };
    if (val <= 6) return { text: 'Moderate Breakouts', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    if (val <= 8) return { text: 'Significant Acne Flare-up', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30' };
    return { text: 'Severe Inflammatory Acne', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
  };

  const getOilInfo = (val: number) => {
    if (val <= 2) return { text: 'Ultra-Matte / Low Sebum', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
    if (val <= 5) return { text: 'Balanced Natural Hydration', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
    if (val <= 8) return { text: 'Moderate Shiny T-Zone', badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
    return { text: 'Excess High Surface Sebum', badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30' };
  };

  const getDryInfo = (val: number) => {
    if (val <= 2) return { text: 'Supple & Well Hydrated', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    if (val <= 5) return { text: 'Mild Surface Tightness', badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30' };
    if (val <= 8) return { text: 'Dry & Rough Texture', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    return { text: 'Flaking / Barrier Compromised', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
  };

  const isInvalidImage = analysis ? isNonSkinImageAlert(analysis) : false;

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6 pb-24 animate-in fade-in duration-500 md:py-8">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Clinical Skin Care & Glow</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-600/20 text-violet-300 font-semibold border border-violet-500/30">
              AI Vision 2.5
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dermatological AI diagnostics, active ingredient protocols & hormonal nutrition calibrated to your cycle.
          </p>
        </div>
        <Button 
          onClick={handleStartNewScan}
          variant="outline"
          size="sm"
          className="bg-primary/10 border-primary/20 text-[#beadd3] hover:bg-primary/20 text-xs font-semibold self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          New Skin Scan 🧴
        </Button>
      </div>

      {/* ☀️ LIVE WEATHER & UV SKIN PROTECTION ALERT ☀️ */}
      <WeatherWidget showSkinFocus={true} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="border-border/40 bg-card/60 backdrop-blur-xs shadow-sm h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkle className="w-4 h-4 text-violet-400" />
                Dermatological Input & Scanner
              </CardTitle>
              <CardDescription className="text-[10px]">Provide accurate parameters for authentic clinical analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Skin Type Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>1. Your Skin Type</span>
                  <span className="text-[10px] font-normal text-muted-foreground">Select baseline profile</span>
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SKIN_TYPES.map((type) => {
                    const isSelected = skinType === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setSkinType(type.id)}
                        className={`p-2.5 rounded-xl text-left border transition-all text-xs cursor-pointer ${
                          isSelected
                            ? 'bg-violet-600/25 border-violet-500 text-foreground font-semibold shadow-xs ring-1 ring-violet-500/50'
                            : 'bg-secondary/20 border-border/40 hover:bg-secondary/40 text-muted-foreground'
                        }`}
                      >
                        <p className="text-xs">{type.label}</p>
                        <p className="text-[9px] opacity-75 font-normal truncate mt-0.5">{type.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary Skin Concerns */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>2. Primary Concerns Today</span>
                  <span className="text-[10px] font-normal text-muted-foreground">Multi-select</span>
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_CONCERNS.map((c) => {
                    const isSelected = concerns.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleConcern(c.id)}
                        className={`px-3 py-1.5 rounded-full text-[11px] border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-violet-600 text-white font-medium border-violet-500 shadow-xs'
                            : 'bg-secondary/30 text-muted-foreground border-border/40 hover:border-border/80'
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Enhanced Interactive Sliders */}
              <div className="space-y-4 pt-2 border-t border-border/20">
                
                {/* 1. Acne Severity Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-pink-500" />
                      Acne Severity
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getAcneInfo(acne).badge}`}>
                      {acne}/10 • {getAcneInfo(acne).text}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range"
                      min="1"
                      max="10"
                      value={acne}
                      onChange={(e) => setAcne(Number(e.target.value))}
                      className="w-full h-2 bg-secondary/50 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    />
                    <span className="w-6 text-center text-xs font-bold text-foreground">{acne}</span>
                  </div>
                </div>

                {/* 2. Oiliness / Sebum Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Droplets className="w-3.5 h-3.5 text-blue-400" />
                      Sebum / Surface Shine
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getOilInfo(oiliness).badge}`}>
                      {oiliness}/10 • {getOilInfo(oiliness).text}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range"
                      min="1"
                      max="10"
                      value={oiliness}
                      onChange={(e) => setOiliness(Number(e.target.value))}
                      className="w-full h-2 bg-secondary/50 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="w-6 text-center text-xs font-bold text-foreground">{oiliness}</span>
                  </div>
                </div>

                {/* 3. Dryness / Tightness Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                      Dryness / Tightness
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getDryInfo(dryness).badge}`}>
                      {dryness}/10 • {getDryInfo(dryness).text}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range"
                      min="1"
                      max="10"
                      value={dryness}
                      onChange={(e) => setDryness(Number(e.target.value))}
                      className="w-full h-2 bg-secondary/50 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <span className="w-6 text-center text-xs font-bold text-foreground">{dryness}</span>
                  </div>
                </div>
              </div>

              {/* Notes & Triggers */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Notes & Potential Triggers</Label>
                <Textarea 
                  placeholder="e.g. Ate spicy dairy last night, tested a new glycolic acid toner, pre-period chin flare..." 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-xs min-h-[55px] resize-none"
                />
              </div>
              
              {/* Photo Input with Live Camera Viewfinder & File Upload */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-violet-400" />
                    Facial Photo (Camera & Vision Scan)
                  </Label>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Info className="w-3 h-3 text-muted-foreground" />
                    Human skin only
                  </span>
                </div>

                {/* Hidden file input */}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*" 
                  capture="user"
                  onChange={handlePhotoSelect} 
                />

                {/* State 1: Live Camera Viewfinder Active */}
                {isCameraOpen ? (
                  <div className="relative w-full rounded-2xl overflow-hidden border-2 border-violet-500 bg-black shadow-xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="relative w-full h-64 sm:h-72 bg-black flex items-center justify-center">
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        autoPlay
                        className={`w-full h-full object-cover ${cameraFacing === 'user' ? '-scale-x-100' : ''}`}
                      />
                      
                      {/* Flash FX */}
                      {flashActive && (
                        <div className="absolute inset-0 bg-white z-30 animate-out fade-out duration-200 pointer-events-none" />
                      )}

                      {/* Countdown Timer Overlay */}
                      {countdown !== null && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none">
                          <div className="w-20 h-20 rounded-full bg-violet-600 text-white font-extrabold text-4xl flex items-center justify-center shadow-2xl animate-ping duration-700">
                            {countdown}
                          </div>
                        </div>
                      )}

                      {/* Face Positioning Oval Guide */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-36 h-48 sm:w-44 sm:h-56 rounded-[50%] border-2 border-dashed border-white/60 shadow-[0_0_25px_rgba(0,0,0,0.6)] flex items-center justify-center">
                          <p className="text-[9px] text-white/90 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-xs font-medium">
                            Align face here
                          </p>
                        </div>
                      </div>

                      {/* Top Bar Controls */}
                      <div className="absolute top-2.5 inset-x-2.5 flex justify-between items-center pointer-events-auto">
                        <span className="bg-black/60 backdrop-blur-md text-[10px] text-white px-2 py-1 rounded-md flex items-center gap-1 font-medium">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          Live Camera
                        </span>
                        <div className="flex items-center gap-1.5">
                          {/* 3s Timer Toggle */}
                          <button
                            type="button"
                            onClick={() => {
                              setUseTimer(!useTimer);
                              toast.info(useTimer ? 'Timer disabled' : '3-Second Timer enabled ⏱️');
                            }}
                            className={`p-2 rounded-full text-white backdrop-blur-md transition-colors ${
                              useTimer ? 'bg-violet-600 text-white font-bold' : 'bg-black/60 hover:bg-black/80'
                            }`}
                            title="3-Second Timer"
                          >
                            <Timer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={switchCameraFacing}
                            className="bg-black/60 hover:bg-black/80 p-2 rounded-full text-white backdrop-blur-md transition-colors"
                            title="Flip camera"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={stopLiveCamera}
                            className="bg-black/60 hover:bg-black/80 p-2 rounded-full text-white backdrop-blur-md transition-colors"
                            title="Close camera"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Bottom Capture Button Bar */}
                      <div className="absolute bottom-3 inset-x-0 flex flex-col items-center justify-center gap-1 pointer-events-auto">
                        <button
                          type="button"
                          onClick={handleTriggerCapture}
                          className="w-14 h-14 rounded-full bg-white text-violet-600 flex items-center justify-center shadow-xl shadow-black/50 border-4 border-violet-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                          title="Snap selfie"
                        >
                          <CircleDot className="w-7 h-7 text-violet-600 animate-pulse" />
                        </button>
                        <span className="text-[10px] font-semibold text-white bg-black/60 px-2.5 py-0.5 rounded-md backdrop-blur-xs">
                          {useTimer ? 'Tap for 3s Countdown' : 'Tap to Snap Selfie'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : photoPreview ? (
                  /* State 2: Photo Loaded with Laser Scan FX */
                  <div className="relative w-full rounded-2xl overflow-hidden border border-border bg-black/20 group">
                    <div className="relative w-full h-48 overflow-hidden">
                      <img src={photoPreview} alt="Skin Preview" className="w-full h-full object-cover" />
                      
                      {/* Laser Scanning Animation when analyzing */}
                      {analyzing && (
                        <div className="absolute inset-0 pointer-events-none overflow-hidden bg-violet-950/20 backdrop-blur-[1px]">
                          <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-bounce duration-1000" />
                          <div className="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur-md p-2 rounded-lg border border-cyan-500/30 text-[10px] text-cyan-300 font-semibold flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                            <span>
                              {scanningStep === 1 && 'Step 1/3: Checking skin texture & lighting...'}
                              {scanningStep === 2 && 'Step 2/3: Grading pore congestion & active lesions...'}
                              {scanningStep === 3 && 'Step 3/3: Calibrating active ingredients & routine...'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Photo Actions Overlay */}
                      <div className="absolute top-2 right-2 flex items-center gap-1.5">
                        <button 
                          type="button"
                          onClick={() => setZoomPhotoUrl(photoPreview)}
                          className="bg-black/60 p-1.5 rounded-full text-white hover:bg-black/80 backdrop-blur-md transition-colors cursor-pointer"
                          title="Zoom photo"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => { setPhotoPreview(null); setPhotoFile(null); }}
                          className="bg-black/60 p-1.5 rounded-full text-white hover:bg-black/80 backdrop-blur-md transition-colors cursor-pointer"
                          title="Remove photo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {!analyzing && (
                        <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-white flex items-center gap-1.5 border border-white/10">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Selfie Ready for AI Diagnosis</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Action buttons under photo preview */}
                    <div className="p-2 bg-secondary/30 flex items-center justify-between gap-2 border-t border-border/30">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => startLiveCamera('user')}
                        className="flex-1 h-8 text-[11px] font-medium bg-background/50 hover:bg-background border-border/60"
                      >
                        <Camera className="w-3.5 h-3.5 mr-1.5 text-violet-400" />
                        Retake Camera
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 h-8 text-[11px] font-medium bg-background/50 hover:bg-background border-border/60"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                        Upload Different
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* State 3: Dual Camera & File Upload Options */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => startLiveCamera('user')}
                      disabled={cameraLoading}
                      className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-violet-500/40 hover:border-violet-500 rounded-2xl bg-violet-600/10 hover:bg-violet-600/20 transition-all text-center group cursor-pointer"
                    >
                      {cameraLoading ? (
                        <Loader2 className="w-6 h-6 mb-1 text-violet-400 animate-spin" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-violet-600/20 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                          <Camera className="w-5 h-5 text-violet-400" />
                        </div>
                      )}
                      <p className="text-xs font-semibold text-foreground">Take Live Selfie</p>
                      <p className="text-[9px] text-muted-foreground">Open front camera to snap photo</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-border/50 hover:border-border/80 rounded-2xl bg-secondary/20 hover:bg-secondary/40 transition-all text-center group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-secondary/60 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-xs font-semibold text-foreground">Upload from Gallery</p>
                      <p className="text-[9px] text-muted-foreground">Select saved photo from device</p>
                    </button>
                  </div>
                )}
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <Button 
                  type="button"
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white font-semibold shadow-md shadow-violet-500/25 h-10 text-xs" 
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Generating Clinical Diagnosis...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 text-yellow-300 fill-yellow-300 animate-pulse" />
                      Run Clinical AI Analysis
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Searchable Scan History Card */}
          <Card className="border-border/40 bg-card/60 backdrop-blur-xs shadow-sm h-fit">
            <CardHeader className="pb-2.5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <History className="w-4 h-4 text-violet-400" />
                  Scan History & Records
                </CardTitle>
                <CardDescription className="text-[10px]">Select a past report to load</CardDescription>
              </div>
              {allEntries.length > 0 && (
                <span className="text-[10px] bg-secondary/50 px-2 py-0.5 rounded-full text-muted-foreground font-medium">
                  {allEntries.length} scans
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-2.5">
              {/* Search Bar if multiple entries */}
              {allEntries.length > 2 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search past scans..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-[11px] rounded-lg bg-secondary/20 border border-border/40 text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              )}

              <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
                {filteredEntries.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground/60 text-xs">
                    {allEntries.length === 0 
                      ? 'No scan history found. Run your first analysis above to start logging.'
                      : 'No scans matched your search filter.'}
                  </div>
                ) : (
                  filteredEntries.map((entry) => {
                    const isSelected = selectedEntryId === entry.id;
                    return (
                      <div 
                        key={entry.id}
                        onClick={() => {
                          setSelectedEntryId(entry.id);
                          if (entry.parsedNotes?.aiReport) {
                            setAnalysis(entry.parsedNotes.aiReport);
                            setAcne(Number(entry.condition || 5));
                            setOiliness(entry.parsedNotes.oiliness || 5);
                            setDryness(entry.parsedNotes.dryness || 2);
                            if (entry.parsedNotes.skinType) setSkinType(entry.parsedNotes.skinType);
                            if (Array.isArray(entry.parsedNotes.concerns)) setConcerns(entry.parsedNotes.concerns);
                            setNotes(entry.parsedNotes.text || '');
                            setPhotoPreview(entry.parsedNotes.photoUrl || null);
                            setPhotoFile(null);
                          }
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer group text-xs ${
                          isSelected 
                            ? 'bg-primary/10 border-primary/30 text-foreground font-medium ring-1 ring-primary/20' 
                            : 'bg-secondary/20 border-border/40 hover:bg-secondary/40 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          {entry.parsedNotes?.photoUrl ? (
                            <img 
                              src={entry.parsedNotes.photoUrl} 
                              alt="Scan thumbnail" 
                              className="w-9 h-9 rounded-lg object-cover border border-border/50 shrink-0" 
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-secondary/80 flex items-center justify-center border border-border/50 text-[10px] font-bold shrink-0 text-violet-300">
                              AI
                            </div>
                          )}
                          <div className="truncate">
                            <p className="truncate font-semibold leading-tight text-foreground">
                              {new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            <p className="text-[10px] text-muted-foreground leading-none mt-1">
                              Acne: {entry.condition}/10 • {entry.parsedNotes?.skinType || 'Custom'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteEntry(entry.id, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-md shrink-0"
                          title="Delete scan entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Diagnostics Report Dashboard Column */}
        <div className="space-y-6">
          <Card className="border-primary/20 bg-primary/5 backdrop-blur-md relative overflow-hidden shadow-sm h-full min-h-[520px] flex flex-col">
            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
              <Sparkles className="w-28 h-28 text-primary" />
            </div>
            <CardHeader className="pb-3 border-b border-border/10">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="w-4 h-4 text-yellow-400 fill-yellow-400 animate-pulse" />
                    AI Skin Diagnostics & Treatment Guide
                  </CardTitle>
                  <CardDescription className="text-[10px]">
                    {selectedEntry 
                      ? `Viewing saved report from ${new Date(selectedEntry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` 
                      : 'Authentic dermatological insights calibrated to your skin and lifestyle.'}
                  </CardDescription>
                </div>
                {selectedEntry && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleStartNewScan}
                    className="h-7 text-[10px] px-2 font-semibold hover:text-foreground border border-border/30 bg-secondary/30"
                  >
                    Clear Select
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col justify-start pt-4 overflow-y-auto max-h-[700px]">
              
              {/* Scanned Photo Banner if viewing past photo */}
              {selectedEntry?.parsedNotes?.photoUrl && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/20 border border-border/30">
                  <div className="flex items-center gap-3">
                    <img 
                      src={selectedEntry.parsedNotes.photoUrl} 
                      alt="Scanned progress" 
                      className="w-14 h-14 object-cover rounded-lg border border-border/50 shadow-xs cursor-pointer hover:opacity-90 transition-opacity" 
                      onClick={() => setZoomPhotoUrl(selectedEntry.parsedNotes?.photoUrl || null)}
                    />
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Archived Facial Photo</p>
                      <p className="text-xs font-medium text-foreground">Click photo thumbnail to zoom</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setZoomPhotoUrl(selectedEntry.parsedNotes?.photoUrl || null)}
                    className="h-7 text-[10px] px-2"
                  >
                    <Maximize2 className="w-3.5 h-3.5 mr-1" />
                    Expand
                  </Button>
                </div>
              )}

              {/* Quick Actions Header Bar if report exists */}
              {analysis && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/20 border border-border/30">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] bg-violet-600/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-md font-semibold">
                      {skinType}
                    </span>
                    <span className="text-[10px] bg-secondary/40 text-muted-foreground px-2 py-0.5 rounded-md font-medium">
                      Acne: {acne}/10
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyRoutine}
                      className="h-7 text-[10px] px-2 font-semibold hover:bg-secondary/40"
                      title="Copy skincare protocol"
                    >
                      {copiedRoutine ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-muted-foreground mr-1" />
                          Copy Routine
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handlePrintReport}
                      className="h-7 text-[10px] px-2 font-semibold hover:bg-secondary/40"
                      title="Print or Save PDF"
                    >
                      <Printer className="w-3 h-3 text-muted-foreground mr-1" />
                      Print
                    </Button>
                  </div>
                </div>
              )}

              {/* Report Body */}
              {analysis ? (
                <div className={`prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed p-4 rounded-xl border text-xs flex-1 ${
                  isInvalidImage 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-100' 
                    : 'bg-black/40 border-border/50'
                }`}>
                  {isInvalidImage && (
                    <div className="flex items-center gap-2 p-2.5 mb-3 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 font-medium text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Non-skin photo detected. Please follow the guidance below to capture a valid selfie.</span>
                    </div>
                  )}
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                  <div className="mt-3 pt-2.5 border-t border-border/20 flex justify-between items-center text-[9px] text-muted-foreground/60">
                    <span>Engine: {selectedEntry ? 'Historical Log' : 'Clinical Multimodal AI'}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleAnalyze} 
                      disabled={analyzing}
                      className="h-6 text-[9px] px-2 font-semibold hover:text-foreground"
                    >
                      {analyzing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-2.5 h-2.5 mr-1 text-yellow-400" />}
                      Re-scan
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 bg-black/20 rounded-xl border border-border/30 px-4 my-auto flex flex-col items-center justify-center flex-1">
                  <Sparkles className="w-8 h-8 text-violet-400 mb-3 animate-pulse" />
                  <p className="text-xs text-foreground mb-1 font-semibold">Ready to Scan</p>
                  <p className="text-[11px] text-muted-foreground/75 max-w-xs leading-normal">
                    Select your skin type, concerns, snap a live selfie or upload a photo, and click &quot;Run Clinical AI Analysis&quot; to generate your scientific skincare routine and active ingredients.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Photo Lightbox / Zoom Modal */}
      {zoomPhotoUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setZoomPhotoUrl(null)}
        >
          <div className="relative max-w-2xl w-full max-h-[85vh] bg-card rounded-2xl overflow-hidden border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={zoomPhotoUrl} alt="Zoomed Skin Inspection" className="w-full h-auto max-h-[80vh] object-contain" />
            <button
              type="button"
              onClick={() => setZoomPhotoUrl(null)}
              className="absolute top-3 right-3 bg-black/70 p-2 rounded-full text-white hover:bg-black/90 backdrop-blur-md transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="p-3 bg-secondary/30 border-t border-border/40 flex justify-between items-center text-xs">
              <span className="font-semibold text-foreground">High-Resolution Skin Inspection View</span>
              <span className="text-[10px] text-muted-foreground">Original diagnostic capture</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

