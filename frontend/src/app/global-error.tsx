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
      <body className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a0f] text-[#f0eeff] font-sans antialiased">
        <div className="max-w-md w-full text-center bg-[#12101c] border border-purple-500/20 p-8 rounded-3xl shadow-2xl space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center mx-auto text-pink-400 font-bold text-2xl">
            ✨
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">Svanexa AI</h2>
            <p className="text-xs text-purple-300/70 mt-1.5 leading-relaxed">
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
              className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-xs shadow-lg shadow-pink-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
