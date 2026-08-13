'use client';

import { cn } from '@/lib/utils';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-white/[0.06] border border-white/[0.05]',
        className
      )}
      {...props}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 w-full animate-pulse">
      {/* Banner Skeleton */}
      <div className="h-44 sm:h-48 rounded-3xl bg-white/[0.04] border border-white/10 p-6 flex flex-col justify-between" />
      {/* Grid Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="h-32 rounded-2xl bg-white/[0.04] border border-white/10" />
        <div className="h-32 rounded-2xl bg-white/[0.04] border border-white/10" />
        <div className="h-32 rounded-2xl bg-white/[0.04] border border-white/10" />
      </div>
      {/* Section Skeleton */}
      <div className="h-64 rounded-3xl bg-white/[0.04] border border-white/10" />
    </div>
  );
}
