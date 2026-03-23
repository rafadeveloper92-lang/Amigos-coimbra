-- Atualiza a estrutura do álbum premium para suportar:
-- 1) reordenação manual (drag-and-drop)
-- 2) definir capa da revista (item com menor sort_order)

ALTER TABLE public.user_album_items
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
  FROM public.user_album_items
)
UPDATE public.user_album_items AS target
SET sort_order = ranked.rn
FROM ranked
WHERE target.id = ranked.id
  AND target.sort_order IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_album_items_user_sort
  ON public.user_album_items (user_id, sort_order ASC);
