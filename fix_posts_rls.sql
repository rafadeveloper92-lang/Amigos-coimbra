BEGIN;

-- Garante suporte a tipo de mídia nos posts (foto/vídeo)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_media_type_check'
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_media_type_check
      CHECK (media_type IS NULL OR media_type IN ('image', 'video'));
  END IF;
END $$;

UPDATE public.posts
SET media_type = COALESCE(media_type, 'image')
WHERE media_type IS NULL;

-- RLS de posts
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas com esses nomes (idempotente)
DROP POLICY IF EXISTS "Everyone can view posts" ON public.posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
DROP POLICY IF EXISTS "posts_select_all" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_authenticated" ON public.posts;
DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;

-- Leitura pública
CREATE POLICY "posts_select_all"
  ON public.posts
  FOR SELECT
  USING (true);

-- Criação por qualquer usuário autenticado
CREATE POLICY "posts_insert_authenticated"
  ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Atualização/exclusão somente do próprio autor
-- (comparação por texto para funcionar em esquemas legados com user_id text/uuid)
CREATE POLICY "posts_update_own"
  ON public.posts
  FOR UPDATE
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "posts_delete_own"
  ON public.posts
  FOR DELETE
  USING (user_id::text = auth.uid()::text);

COMMIT;
