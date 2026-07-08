'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export function useRealtime(tableNames: string[]) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const channels = tableNames.map((table) => {
      return supabase
        .channel(`public:${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: table },
          (payload) => {
            router.refresh(); // Automatically refresh data on change
          }
        )
        .subscribe();
    });

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [tableNames, router, supabase]);
}
