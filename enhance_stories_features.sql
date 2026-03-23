-- Upgrade opcional para Stories (texto, fonte, cor, localização e música)
-- Rode no SQL Editor do Supabase.

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS caption TEXT,
  ADD COLUMN IF NOT EXISTS text_color TEXT,
  ADD COLUMN IF NOT EXISTS text_font TEXT,
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS music_title TEXT,
  ADD COLUMN IF NOT EXISTS music_artist TEXT,
  ADD COLUMN IF NOT EXISTS music_cover_url TEXT,
  ADD COLUMN IF NOT EXISTS music_preview_url TEXT,
  ADD COLUMN IF NOT EXISTS music_display_mode TEXT,
  ADD COLUMN IF NOT EXISTS lyrics_text TEXT,
  ADD COLUMN IF NOT EXISTS mention_tags TEXT[],
  ADD COLUMN IF NOT EXISTS stickers JSONB,
  ADD COLUMN IF NOT EXISTS media_scale DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS media_x DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS media_y DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS caption_x DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS caption_y DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS caption_scale DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_x DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_y DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_scale DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS mention_x DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS mention_y DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS mention_scale DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS music_x DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS music_y DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS music_scale DOUBLE PRECISION;

-- Garante que stories continuem expirando em 24h por padrão
ALTER TABLE public.stories
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '24 hours'),
  ALTER COLUMN music_display_mode SET DEFAULT 'album',
  ALTER COLUMN stickers SET DEFAULT '[]'::jsonb,
  ALTER COLUMN media_scale SET DEFAULT 1,
  ALTER COLUMN media_x SET DEFAULT 0,
  ALTER COLUMN media_y SET DEFAULT 0,
  ALTER COLUMN caption_x SET DEFAULT 0,
  ALTER COLUMN caption_y SET DEFAULT 0,
  ALTER COLUMN caption_scale SET DEFAULT 1,
  ALTER COLUMN location_x SET DEFAULT 0,
  ALTER COLUMN location_y SET DEFAULT -320,
  ALTER COLUMN location_scale SET DEFAULT 1,
  ALTER COLUMN mention_x SET DEFAULT 0,
  ALTER COLUMN mention_y SET DEFAULT -220,
  ALTER COLUMN mention_scale SET DEFAULT 1,
  ALTER COLUMN music_x SET DEFAULT 0,
  ALTER COLUMN music_y SET DEFAULT -260,
  ALTER COLUMN music_scale SET DEFAULT 1;

-- Normaliza stories antigos
UPDATE public.stories
SET
  music_display_mode = COALESCE(music_display_mode, 'album'),
  stickers = COALESCE(stickers, '[]'::jsonb),
  media_scale = COALESCE(media_scale, 1),
  media_x = COALESCE(media_x, 0),
  media_y = COALESCE(media_y, 0),
  caption_x = COALESCE(caption_x, 0),
  caption_y = COALESCE(caption_y, 0),
  caption_scale = COALESCE(caption_scale, 1),
  location_x = COALESCE(location_x, 0),
  location_y = COALESCE(location_y, -320),
  location_scale = COALESCE(location_scale, 1),
  mention_x = COALESCE(mention_x, 0),
  mention_y = COALESCE(mention_y, -220),
  mention_scale = COALESCE(mention_scale, 1),
  music_x = COALESCE(music_x, 0),
  music_y = COALESCE(music_y, -260),
  music_scale = COALESCE(music_scale, 1)
WHERE
  music_display_mode IS NULL
  OR stickers IS NULL
  OR media_scale IS NULL OR media_x IS NULL OR media_y IS NULL
  OR caption_x IS NULL OR caption_y IS NULL OR caption_scale IS NULL
  OR location_x IS NULL OR location_y IS NULL OR location_scale IS NULL
  OR mention_x IS NULL OR mention_y IS NULL OR mention_scale IS NULL
  OR music_x IS NULL OR music_y IS NULL OR music_scale IS NULL;

-- Índice auxiliar para leitura recente por usuário
CREATE INDEX IF NOT EXISTS idx_stories_user_created_at
  ON public.stories (user_id, created_at DESC);

-- =========================================================
-- Recursos globais online (sem localStorage): reações,
-- comentários e músicas favoritas dos stories.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.story_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT story_reactions_unique_story_user UNIQUE (story_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.story_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT story_comments_content_not_empty CHECK (char_length(trim(content)) > 0)
);

CREATE TABLE IF NOT EXISTS public.favorite_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id BIGINT NOT NULL,
  track_name TEXT NOT NULL,
  artist_name TEXT,
  artwork_url TEXT,
  preview_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT favorite_tracks_unique_user_track UNIQUE (user_id, track_id)
);

ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "story_reactions_select_all" ON public.story_reactions;
CREATE POLICY "story_reactions_select_all"
  ON public.story_reactions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "story_reactions_insert_own" ON public.story_reactions;
CREATE POLICY "story_reactions_insert_own"
  ON public.story_reactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "story_reactions_delete_own" ON public.story_reactions;
CREATE POLICY "story_reactions_delete_own"
  ON public.story_reactions
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "story_comments_select_all" ON public.story_comments;
CREATE POLICY "story_comments_select_all"
  ON public.story_comments
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "story_comments_insert_own" ON public.story_comments;
CREATE POLICY "story_comments_insert_own"
  ON public.story_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "story_comments_update_own" ON public.story_comments;
CREATE POLICY "story_comments_update_own"
  ON public.story_comments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "story_comments_delete_own" ON public.story_comments;
CREATE POLICY "story_comments_delete_own"
  ON public.story_comments
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorite_tracks_select_own" ON public.favorite_tracks;
CREATE POLICY "favorite_tracks_select_own"
  ON public.favorite_tracks
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorite_tracks_insert_own" ON public.favorite_tracks;
CREATE POLICY "favorite_tracks_insert_own"
  ON public.favorite_tracks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorite_tracks_update_own" ON public.favorite_tracks;
CREATE POLICY "favorite_tracks_update_own"
  ON public.favorite_tracks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorite_tracks_delete_own" ON public.favorite_tracks;
CREATE POLICY "favorite_tracks_delete_own"
  ON public.favorite_tracks
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_story_reactions_story_id
  ON public.story_reactions (story_id);

CREATE INDEX IF NOT EXISTS idx_story_comments_story_created
  ON public.story_comments (story_id, created_at);

CREATE INDEX IF NOT EXISTS idx_favorite_tracks_user_created
  ON public.favorite_tracks (user_id, created_at DESC);
