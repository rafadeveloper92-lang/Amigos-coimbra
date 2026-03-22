-- Adiciona a coluna role na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Adiciona a coluna is_official na tabela groups
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT false;

-- Garante que a coluna created_by existe para rastrear quem criou o grupo
ALTER TABLE groups ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Garante que as colunas de tipo de grupo existem
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_sales BOOLEAN DEFAULT false;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_jobs BOOLEAN DEFAULT false;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_voice BOOLEAN DEFAULT false;

-- Habilita RLS na tabela groups
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas se existirem para evitar conflitos
DROP POLICY IF EXISTS "Everyone can view groups" ON groups;
DROP POLICY IF EXISTS "Users can create groups" ON groups;
DROP POLICY IF EXISTS "Creators can update their groups" ON groups;
DROP POLICY IF EXISTS "Creators can delete their groups" ON groups;

-- Permite que todos vejam os grupos
CREATE POLICY "Everyone can view groups" ON groups FOR SELECT USING (true);

-- Permite que qualquer usuário logado crie grupos
CREATE POLICY "Users can create groups" ON groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Permite que o criador do grupo ou um admin edite o grupo
CREATE POLICY "Creators can update their groups" ON groups FOR UPDATE USING (auth.uid() = created_by OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Permite que o criador do grupo ou um admin exclua o grupo
CREATE POLICY "Creators can delete their groups" ON groups FOR DELETE USING (auth.uid() = created_by OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
