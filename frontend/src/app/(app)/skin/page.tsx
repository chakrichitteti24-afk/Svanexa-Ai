'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { createClient } from '@/utils/supabase/client';
import { useHerSync } from '@/context/HerSyncContext';

type SkinEntry = {
  id: string;
  date: string;
  condition: string;
  notes: string;
  parsedNotes?: { oiliness: number; dryness: number; text: string };
};

export default function SkinTrackerPage() {
  const { skinLogs, isLoading: loading, refreshSkinLogs } = useHerSync();
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [acne, setAcne] = useState(5);
  const [oiliness, setOiliness] = useState(5);
  const [dryness, setDryness] = useState(2);
  const [notes, setNotes] = useState('');

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, [supabase]);

  const entries = skinLogs.map(d => {
    let parsedNotes = { oiliness: 5, dryness: 2, text: d.notes || '' };
    try {
      if (d.notes && d.notes.startsWith('{')) {
        parsedNotes = JSON.parse(d.notes);
      }
    } catch (e) {}
    return { ...d, parsedNotes };
  });

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const complexNotes = JSON.stringify({ oiliness, dryness, text: notes });

    try {
      const { error } = await supabase.from('skin_logs').insert({
        user_id: userId,
        date: today,
        condition: String(acne),
        notes: complexNotes,
        breakouts: acne > 5
      });
      if (error) throw error;
      setAcne(5);
      setOiliness(5);
      setDryness(2);
      setNotes('');
      toast.success('Skin progress saved!');
      // Broadcast to Dashboard, Reports, AI Companion
      await refreshSkinLogs();
    } catch (err: any) {
      toast.error('Failed to save skin log', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('skin_logs').delete().eq('id', id);
      if (error) throw error;
      toast.success('Entry deleted.');
      await refreshSkinLogs();
    } catch (err: any) {
      toast.error('Failed to delete entry');
    }
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Skin Log</h1>
        <p className="text-xs text-muted-foreground">Monitor skin indicators and track visual progress.</p>
      </div>

      <div className="space-y-6">
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{"Log Today's Skin"}</CardTitle>
            <CardDescription className="text-[10px]">Record daily skin severity</CardDescription>
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

            <Button 
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90 text-white shadow-md shadow-blue-500/20" 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Skin Progress'}
            </Button>
          </CardContent>
        </Card>

        <Card className="h-full shadow-sm">
          <CardHeader>
            <CardTitle>Progress Timeline</CardTitle>
            <CardDescription>Your recent skin entries.</CardDescription>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
                <ImageIcon className="w-12 h-12 mb-4 opacity-20" />
                <p>No records yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex gap-4 p-4 rounded-2xl bg-secondary/20 border border-border/50 group relative">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => handleDelete(entry.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <div className="flex-1 space-y-1">
                      <p className="font-semibold text-sm">{new Date(entry.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                      <div className="text-xs text-muted-foreground flex gap-2 mt-1">
                        <span className="bg-pink-500/10 text-pink-500 px-2 py-0.5 rounded-full font-medium">Acne: {entry.condition}</span>
                        {entry.parsedNotes && (
                          <>
                            <span className="bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full font-medium">Oil: {entry.parsedNotes.oiliness}</span>
                            <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-medium">Dry: {entry.parsedNotes.dryness}</span>
                          </>
                        )}
                      </div>
                      {entry.parsedNotes?.text && <p className="text-sm mt-3 line-clamp-2 italic text-muted-foreground border-l-2 border-primary/20 pl-2">{`"${entry.parsedNotes.text}"`}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
