-- Adiciona a coluna cover_url na tabela groups
ALTER TABLE groups ADD COLUMN IF NOT EXISTS cover_url text;
