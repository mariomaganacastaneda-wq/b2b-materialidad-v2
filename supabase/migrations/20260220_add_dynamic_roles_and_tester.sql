-- 1. Remove the hardcoded role check constraint, which prevents dynamic roles.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Add a foreign key to cat_roles so roles are dynamically validated
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS fk_profiles_role;
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_role FOREIGN KEY (role) REFERENCES public.cat_roles(id);

-- 3. Insert TESTER role
INSERT INTO public.cat_roles (id, name, description, is_system) 
VALUES ('TESTER', 'Probador de Sistema', 'Rol especial para probar emisoras y clientes con acceso completo', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Delete existing permissions for TESTER just in case
DELETE FROM public.role_permissions WHERE role_id = 'TESTER';

-- 5. Insert permissions for all current screens
INSERT INTO public.role_permissions (role_id, screen_id, can_view, can_create, can_edit, can_delete)
VALUES 
  ('TESTER', 'dashboard', true, true, true, true),
  ('TESTER', 'materialidad', true, true, true, true),
  ('TESTER', 'cotizaciones', true, true, true, true),
  ('TESTER', 'proformas', true, true, true, true),
  ('TESTER', 'facturas', true, true, true, true),
  ('TESTER', 'bancos', true, true, true, true),
  ('TESTER', 'evidencia', true, true, true, true),
  ('TESTER', 'reportes', true, true, true, true),
  ('TESTER', 'catalogos-sat', true, true, true, true),
  ('TESTER', 'settings', true, true, true, true),
  ('TESTER', 'security', true, true, true, true)
ON CONFLICT (role_id, screen_id) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete;
