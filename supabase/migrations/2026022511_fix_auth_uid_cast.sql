-- Fix: Reemplazar auth.uid() con (auth.jwt()->>'sub') en todas las políticas RLS
-- auth.uid() intenta castear el token 'sub' de Clerk ('user_xxx') a UUID, lo que causa un error 22P02.

-- 1. Políticas de organizations
DROP POLICY IF EXISTS "organizations_select" ON organizations;
CREATE POLICY "organizations_select" ON organizations FOR SELECT USING (id IN (SELECT organization_id FROM profiles WHERE id = (auth.jwt()->>'sub')));

-- 2. Políticas de profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (id = (auth.jwt()->>'sub'));

-- 3. Políticas Base para todas las tablas con organization_id
DROP POLICY IF EXISTS "Tenant isolation - Vendors" ON vendors;
CREATE POLICY "Tenant isolation - Vendors" ON vendors FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = (auth.jwt()->>'sub')));

DROP POLICY IF EXISTS "Tenant isolation - Quotations" ON quotations;
CREATE POLICY "Tenant isolation - Quotations" ON quotations FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = (auth.jwt()->>'sub')));

DROP POLICY IF EXISTS "Tenant isolation - Quotation Items" ON quotation_items;
CREATE POLICY "Tenant isolation - Quotation Items" ON quotation_items FOR ALL USING (quotation_id IN (SELECT id FROM quotations WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = (auth.jwt()->>'sub'))));

DROP POLICY IF EXISTS "Tenant isolation - Contracts" ON contracts;
CREATE POLICY "Tenant isolation - Contracts" ON contracts FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = (auth.jwt()->>'sub')));

DROP POLICY IF EXISTS "Tenant isolation - Invoices" ON invoices;    
CREATE POLICY "Tenant isolation - Invoices" ON invoices FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = (auth.jwt()->>'sub')));

DROP POLICY IF EXISTS "Tenant isolation - Notifications" ON notifications;
CREATE POLICY "Tenant isolation - Notifications" ON notifications FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = (auth.jwt()->>'sub')));

-- 4. Notificaciones de Usuario
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT 
USING (recipient_id = (auth.jwt()->>'sub') OR organization_id IN (SELECT organization_id FROM profiles WHERE id = (auth.jwt()->>'sub')));

-- 5. user_organization_access
DROP POLICY IF EXISTS "Users can view their access" ON user_organization_access;
CREATE POLICY "Users can view their access" ON user_organization_access FOR SELECT 
USING (profile_id = (auth.jwt()->>'sub'));

-- 6. function public.get_current_user_role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = (auth.jwt()->>'sub');
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. function public.get_current_user_org
CREATE OR REPLACE FUNCTION public.get_current_user_org()
RETURNS uuid AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT default_org_id INTO v_org_id FROM public.profiles WHERE id = (auth.jwt()->>'sub');
  IF v_org_id IS NULL THEN
     SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = (auth.jwt()->>'sub');
  END IF;
  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTIFY pgrst, 'reload schema' no es válido en el script en local/remoto de supabase (depende), 
-- pero garantizamos que funcione.
-- Refrescamos schema caché (Supabase lo hace automáticamente en migrations)
