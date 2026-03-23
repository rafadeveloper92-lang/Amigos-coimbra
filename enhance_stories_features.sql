-- Upgrade opcional para Stories (texto, fonte, cor, localização e música)
-- Rode no SQL Editor do Supabase.

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS caption TEXT,
  ADD COLUMN IF NOT EXISTS text_color TEXT,
  ADD COLUMN IF NOT EXISTS text_font TEXT,
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS music_title TEXT;

-- Garante que stories continuem expirando em 24h por padrão
ALTER TABLE public.stories
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '24 hours');

-- Índice auxiliar para leitura recente por usuário
CREATE INDEX IF NOT EXISTS idx_stories_user_created_at
  ON public.stories (user_id, created_at DESC);
