'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Image as ImageIcon, Trash2, Loader2, Camera, X, Sparkles, Plus, History } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { createClient } from '@/utils/supabase/client';
import { useHerSync } from '@/context/HerSyncContext';
import { WeatherWidget } from '@/components/weather/WeatherWidget';

type SkinEntry = {
  id: string;
  date: string;
  condition: string;
  notes: string;
  parsedNotes?: { oiliness: number; dryness: number; text: string; photoUrl?: string; aiReport?: string };
};

// Helper to compress image and convert to Base64 data URL
const compressImageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
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
        
        // Compress to JPEG with 0.7 quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
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
  
  const [acne, setAcne] = useState(5);
  const [oiliness, setOiliness] = useState(5);
  const [dryness, setDryness] = useState(2);
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
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

  const dbEntries = (Array.isArray(skinLogs) ? skinLogs : []).map(d => {
    let parsedNotes = { oiliness: 5, dryness: 2, text: d.notes || '', photoUrl: '', aiReport: '' };
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
  const entries = [...dbEntries, ...filteredLocal];


  const selectedEntry = entries.find(e => e.id === selectedEntryId);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleStartNewScan = () => {
    setSelectedEntryId(null);
    setAnalysis(null);
    setAcne(5);
    setOiliness(5);
    setDryness(2);
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

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      let photoBase64 = '';
      if (photoFile) {
        toast.info('Encoding and compressing skin photo...', { duration: 1500 });
        photoBase64 = await compressImageToBase64(photoFile);
      }

      toast.info('Analyzing skin conditions with AI...', { duration: 3000 });
      const response = await fetch('/api/skin-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          acne,
          oiliness,
          dryness,
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

        // Always save locally for guest / offline / session fallback
        try {
          const newEntry = {
            id: 'local_' + Date.now(),
            date: today,
            condition: String(acne),
            notes: complexNotes,
            parsedNotes: {
              oiliness,
              dryness,
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

        toast.success('AI Skin Analysis complete and saved to history!');
      } else {
        toast.error('Failed to run AI Analysis', { description: data.message || data.error });
      }
    } catch (err: any) {
      toast.error('Analysis failed', { description: err.message });
    } finally {
      setAnalyzing(false);
    }
  };


  return (
    <div className="max-w-6xl mx-auto w-full space-y-6 pb-24 animate-in fade-in duration-500 md:py-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Skin Care & Glow</h1>
          <p className="text-xs text-muted-foreground">Personalized AI skin analysis, glow care & nutritional tips.</p>
        </div>
        <Button 
          onClick={handleStartNewScan}
          variant="outline"
          size="sm"
          className="bg-primary/10 border-primary/20 text-[#beadd3] hover:bg-primary/20 text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          New Glow Check 🧴
        </Button>
      </div>

      {/* ☀️ LIVE WEATHER & UV SKIN PROTECTION ALERT ☀️ */}
      <WeatherWidget showSkinFocus={true} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="border-border/40 bg-card/60 backdrop-blur-xs shadow-sm h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{"Real-time Skin Scanner"}</CardTitle>
              <CardDescription className="text-[10px]">Enter current skin parameters for analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Acne Counter */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold flex items-center gap-1.5">Acne Severity</span>
                  <p className="text-[10px] text-muted-foreground">Scale of 1-10</p>
                </div>
                <div className="flex items-center gap-3 bg-secondary/20 p-1.5 rounded-full border border-border/30">
                  <button
                    type="button"
                    onClick={() => setAcne(Math.max(1, acne - 1))}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border/50 text-foreground active:scale-90 font-bold transition-transform text-sm"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-sm font-bold">{acne}</span>
                  <button
                    type="button"
                    onClick={() => setAcne(Math.min(10, acne + 1))}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border/50 text-foreground active:scale-90 font-bold transition-transform text-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Oiliness Counter */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold flex items-center gap-1.5">Oiliness</span>
                  <p className="text-[10px] text-muted-foreground">Scale of 1-10</p>
                </div>
                <div className="flex items-center gap-3 bg-secondary/20 p-1.5 rounded-full border border-border/30">
                  <button
                    type="button"
                    onClick={() => setOiliness(Math.max(1, oiliness - 1))}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border/50 text-foreground active:scale-90 font-bold transition-transform text-sm"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-sm font-bold">{oiliness}</span>
                  <button
                    type="button"
                    onClick={() => setOiliness(Math.min(10, oiliness + 1))}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border/50 text-foreground active:scale-90 font-bold transition-transform text-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Dryness Counter */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold flex items-center gap-1.5">Dryness / Flakiness</span>
                  <p className="text-[10px] text-muted-foreground">Scale of 1-10</p>
                </div>
                <div className="flex items-center gap-3 bg-secondary/20 p-1.5 rounded-full border border-border/30">
                  <button
                    type="button"
                    onClick={() => setDryness(Math.max(1, dryness - 1))}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border/50 text-foreground active:scale-90 font-bold transition-transform text-sm"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-sm font-bold">{dryness}</span>
                  <button
                    type="button"
                    onClick={() => setDryness(Math.min(10, dryness + 1))}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border/50 text-foreground active:scale-90 font-bold transition-transform text-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea 
                  placeholder="Tried a new cleanser? Eaten something different?" 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              
              {/* Photo Upload */}
              <div className="space-y-2">
                <Label>Upload Photo (Optional)</Label>
                {!photoPreview ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border/50 rounded-2xl cursor-pointer bg-secondary/20 hover:bg-secondary/40 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Camera className="w-8 h-8 mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground font-medium">Tap to upload a selfie</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handlePhotoSelect} />
                  </label>
                ) : (
                  <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-border">
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => { setPhotoPreview(null); setPhotoFile(null); }}
                      className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full text-white hover:bg-black/70 backdrop-blur-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <Button 
                  type="button"
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white font-semibold shadow-md shadow-violet-500/20" 
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Analyzing Skin Selfie...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 text-yellow-300 fill-yellow-300 animate-pulse" />
                      Analyze Skin Now
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ChatGPT-style Scan History list */}
          <Card className="border-border/40 bg-card/60 backdrop-blur-xs shadow-sm h-fit">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <History className="w-4 h-4 text-violet-400" />
                  Scan History
                </CardTitle>
                <CardDescription className="text-[10px]">Select a past report to load</CardDescription>
              </div>
              {entries.length > 0 && (
                <span className="text-[10px] bg-secondary/50 px-2 py-0.5 rounded-full text-muted-foreground font-medium">
                  {entries.length} scans
                </span>
              )}
            </CardHeader>
            <CardContent className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {entries.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground/60 text-xs">
                  No scan history found. Run your first analysis above to start logging.
                </div>
              ) : (
                entries.map((entry) => {
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
                          setNotes(entry.parsedNotes.text || '');
                          setPhotoPreview(entry.parsedNotes.photoUrl || null);
                          setPhotoFile(null);
                        }
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer group text-xs ${
                        isSelected 
                          ? 'bg-primary/10 border-primary/30 text-foreground font-medium' 
                          : 'bg-secondary/20 border-border/40 hover:bg-secondary/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        {entry.parsedNotes?.photoUrl ? (
                          <img 
                            src={entry.parsedNotes.photoUrl} 
                            alt="Scan thumbnail" 
                            className="w-8 h-8 rounded-lg object-cover border border-border/50 shrink-0" 
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-secondary/80 flex items-center justify-center border border-border/50 text-[10px] font-bold shrink-0">
                            AI
                          </div>
                        )}
                        <div className="truncate">
                          <p className="truncate font-semibold leading-tight">
                            {new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          <p className="text-[10px] text-muted-foreground/80 leading-none mt-0.5">
                            Acne Severity: {entry.condition}/10
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteEntry(entry.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-md shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* AI Skin Analysis Card */}
          <Card className="border-primary/20 bg-primary/5 backdrop-blur-md relative overflow-hidden shadow-sm h-full min-h-[500px] flex flex-col">
            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
              <Sparkles className="w-24 h-24 text-primary" />
            </div>
            <CardHeader className="pb-3 border-b border-border/10">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="w-4 h-4 text-yellow-400 fill-yellow-400 animate-pulse" />
                    AI Skin & Wellness Insights
                  </CardTitle>
                  <CardDescription className="text-[10px]">
                    {selectedEntry 
                      ? `Viewing saved report from ${new Date(selectedEntry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` 
                      : 'Comprehensive analysis report based on Svanexa AI.'}
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
            <CardContent className="space-y-4 flex-1 flex flex-col justify-start pt-4 overflow-y-auto max-h-[650px]">
              {selectedEntry?.parsedNotes?.photoUrl && (
                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-black/20 border border-border/30">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Scanned Photo</p>
                  <img 
                    src={selectedEntry.parsedNotes.photoUrl} 
                    alt="Scanned progress" 
                    className="w-full max-w-[280px] h-36 object-cover rounded-lg border border-border/50 shadow-sm" 
                  />
                </div>
              )}
              {analysis ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed bg-black/40 p-4 rounded-xl border border-border/50 text-xs flex-1">
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                  <div className="mt-3 pt-2.5 border-t border-border/20 flex justify-between items-center text-[9px] text-muted-foreground/60">
                    <span>Scan Engine: {selectedEntry ? 'Historical Log' : 'Real-time'}</span>
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
                  <p className="text-xs text-muted-foreground mb-1 font-semibold">Ready to Scan</p>
                  <p className="text-[11px] text-muted-foreground/75 max-w-xs leading-normal">
                    Adjust your skin sliders, upload a selfie, and click &quot;Analyze Skin Now&quot; to generate your custom routine checks, active ingredients, and nutritional plan.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
