import { createClient } from '@supabase/supabase-js';

const url = 'https://hhgecmtljovgoqbcqleb.supabase.co';
const key = 'sb_publishable_KR3obEpqz9WJZXWwUVS5xw_iq_rVUAy';
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('post_reactions').select('*').limit(1);
  console.log('post_reactions:', error ? error.message : 'exists');
}
check();
