'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Error caught:', error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex items-center justify-center p-6 bg-black text-white font-sans antialiased">
        <div className="max-w-md w-full text-center bg-[#1c1c1e] border border-white/[0.12] p-8 rounded-3xl shadow-2xl space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center mx-auto text-white font-semibold text-2xl">
            ✨
          </div>

          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">Svanexa AI</h2>
            <p className="text-xs text-white/70 mt-1.5 leading-relaxed">
              We encountered a temporary connection issue. Tap below to reload.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
                else reset();
              }}
              className="w-full h-11 rounded-full bg-[#ea5475] hover:opacity-95 text-white font-semibold text-xs shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_8px_rgba(0,0,0,0.24)] flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
