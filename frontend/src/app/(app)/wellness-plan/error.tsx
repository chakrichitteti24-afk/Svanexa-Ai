'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCcw } from 'lucide-react';

export default function WellnessPlanError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Wellness Plan error caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center bg-card/80 backdrop-blur-xl border border-border/50 p-8 rounded-3xl shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center mx-auto mb-4 font-mono">
          <RefreshCcw className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-foreground mb-2">No wellness plan available yet</h2>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          Complete your Morning Check-in to generate today&apos;s personalized wellness plan.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/check-in"
            className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-violet-500 text-white font-bold rounded-full shadow-lg shadow-pink-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-center flex items-center justify-center gap-2 text-sm"
          >
            Go to Daily Check-in <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            onClick={() => reset()}
            className="w-full py-3 bg-secondary/60 hover:bg-secondary text-muted-foreground font-semibold rounded-full border border-border/50 text-xs transition-all"
          >
            Retry Loading
          </button>
        </div>
      </div>
    </div>
  );
}
