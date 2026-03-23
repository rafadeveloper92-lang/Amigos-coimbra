import { createClient } from '@supabase/supabase-js';

// Try multiple ways to get the environment variables, with hardcoded fallbacks as requested
const supabaseUrl = 
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 
  import.meta.env.VITE_SUPABASE_URL || 
  (process.env as any).NEXT_PUBLIC_SUPABASE_URL ||
  (process.env as any).VITE_SUPABASE_URL ||
  'https://hhgecmtljovgoqbcqleb.supabase.co';

const supabaseKey = 
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  (process.env as any).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  (process.env as any).VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_KR3obEpqz9WJZXWwUVS5xw_iq_rVUAy';

console.log('Supabase URL found:', !!supabaseUrl);
console.log('Supabase Key found:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key is missing in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    storageKey: 'nexus-community-auth-token',
    // Disable locking to prevent "stolen lock" errors in the preview environment
    // by providing a dummy lock function that executes the callback immediately
    lock: async (_name: string, _acquireTimeout: number, callback: () => Promise<any>) => {
      return callback();
    }
  },
});
