'use client';

import { useEffect } from 'react';
import { Sparkles, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Root Error caught:', {
      message: error?.message,
      stack: error?.stack,
      digest: error?.digest,
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="max-w-md w-full text-center bg-card/90 backdrop-blur-2xl border border-border/50 p-8 rounded-3xl shadow-2xl space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center mx-auto text-primary">
          <Sparkles className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Welcome to Svanexa AI</h2>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            We encountered a temporary hiccup loading this screen. Please try again.
          </p>
        </div>

        {error?.message && (
          <div className="text-left p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-mono break-all max-h-36 overflow-y-auto space-y-1">
            <p className="font-semibold">Error Info:</p>
            <p>{error.message}</p>
            {error.digest && <p className="text-[10px] text-muted-foreground">Digest: {error.digest}</p>}
          </div>
        )}


        <div className="flex flex-col gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = window.location.pathname;
              } else {
                reset();
              }
            }}
            className="w-full h-11 rounded-full bg-primary hover:opacity-95 text-white font-semibold text-xs shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_8px_rgba(0,0,0,0.24)] flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Try Again
          </button>


          <Link
            href="/"
            className="w-full h-11 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-muted-foreground hover:text-foreground font-medium text-xs border border-white/[0.08] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <Home className="w-3.5 h-3.5" /> Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}

