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
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500/20 to-violet-500/20 border border-pink-500/30 flex items-center justify-center mx-auto text-pink-400">
          <Sparkles className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-xl font-extrabold text-foreground">Welcome to Svanexa AI</h2>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            We encountered a temporary hiccup loading this screen. Please try again.
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && error?.message && (
          <div className="text-left p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-mono break-all max-h-32 overflow-y-auto">
            <p className="font-bold mb-1">Dev Diagnostic:</p>
            <p>{error.message}</p>
            {error.digest && <p className="text-[10px] text-muted-foreground mt-1">Digest: {error.digest}</p>}
          </div>
        )}

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 text-white font-bold text-xs shadow-lg shadow-pink-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Try Again
          </button>

          <Link
            href="/"
            className="w-full py-3 px-6 rounded-full bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground font-semibold text-xs border border-border/40 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Home className="w-3.5 h-3.5" /> Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}

