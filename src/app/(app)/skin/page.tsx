'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Camera, Image as ImageIcon, Trash2 } from 'lucide-react';

type SkinEntry = {
  id: string;
  date: string;
  image: string;
  acne: number;
  oiliness: number;
  dryness: number;
  notes: string;
};

export default function SkinTrackerPage() {
  const [entries, setEntries] = useLocalStorage<SkinEntry[]>('hersync_skin', []);
  const [preview, setPreview] = useState<string>('');
  const [acne, setAcne] = useState(5);
  const [oiliness, setOiliness] = useState(5);
  const [dryness, setDryness] = useState(2);
  const [notes, setNotes] = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit for localstorage sanity
        toast.error('Image is too large. Please select an image under 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const newEntry: SkinEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      image: preview,
      acne,
      oiliness,
      dryness,
      notes,
    };

    setEntries([newEntry, ...entries]);
    setPreview('');
    setAcne(5);
    setOiliness(5);
    setDryness(2);
    setNotes('');
    toast.success('Skin progress saved successfully!');
  };

  const handleDelete = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
    toast.success('Entry deleted.');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Skin Tracker</h1>
        <p className="text-muted-foreground">Monitor your skin health visually and track symptom severity over time.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Log Today's Skin</CardTitle>
            <CardDescription>Upload a photo to see progress over time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="space-y-4">
              <Label>Skin Photo</Label>
              {preview ? (
                <div className="relative rounded-2xl overflow-hidden aspect-[4/3] border border-border group">
                  <img src={preview} alt="Skin Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button variant="destructive" size="sm" onClick={() => setPreview('')}>
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center w-full">
                  <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer bg-secondary/20 border-border hover:bg-secondary/40 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Camera className="w-10 h-10 mb-3 text-muted-foreground" />
                      <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span></p>
                      <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
                    </div>
                    <input id="dropzone-file" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex justify-between"><Label>Acne Severity</Label><span>{acne}/10</span></div>
              <Slider min={1} max={10} step={1} value={[acne]} onValueChange={(val: any) => setAcne(val[0])} />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between"><Label>Oiliness</Label><span>{oiliness}/10</span></div>
              <Slider min={1} max={10} step={1} value={[oiliness]} onValueChange={(val: any) => setOiliness(val[0])} />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between"><Label>Dryness / Flakiness</Label><span>{dryness}/10</span></div>
              <Slider min={1} max={10} step={1} value={[dryness]} onValueChange={(val: any) => setDryness(val[0])} />
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
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white" 
              onClick={handleSave}
            >
              Save Skin Progress
            </Button>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Progress Timeline</CardTitle>
            <CardDescription>Your recent skin entries.</CardDescription>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
                <ImageIcon className="w-12 h-12 mb-4 opacity-20" />
                <p>No photos uploaded yet.</p>
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
                    {entry.image ? (
                      <img src={entry.image} alt="Skin Log" className="w-24 h-24 object-cover rounded-xl border border-border" />
                    ) : (
                      <div className="w-24 h-24 bg-muted rounded-xl flex items-center justify-center border border-border">
                        <Camera className="w-6 h-6 text-muted-foreground opacity-50" />
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <p className="font-semibold text-sm">{new Date(entry.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                      <div className="text-xs text-muted-foreground flex gap-2">
                        <span className="bg-pink-500/10 text-pink-500 px-2 py-0.5 rounded-full">Acne: {entry.acne}</span>
                        <span className="bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full">Oil: {entry.oiliness}</span>
                      </div>
                      {entry.notes && <p className="text-sm mt-2 line-clamp-2 italic text-muted-foreground">"{entry.notes}"</p>}
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
