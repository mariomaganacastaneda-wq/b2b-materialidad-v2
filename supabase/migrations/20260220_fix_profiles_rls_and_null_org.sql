-- Fix: the organization_id should not be NOT NULL because users aren't assigned an org upon sign up.
ALTER TABLE public.profiles ALTER COLUMN organization_id DROP NOT NULL;

-- Fix: Users need to be able to insert their own profile during initial login.
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (id = (auth.jwt() ->> 'sub'));

-- Helper function to prevent infinite recursion in RLS
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = (auth.jwt() ->> 'sub');
$$;

-- Drop previous buggy recursive policies if they exist (from manual testing)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- Fix: Admins need to be able to see all profiles in the User Directory.
CREATE POLICY "Admins can view all profiles v2"
ON public.profiles
FOR SELECT
USING (
  public.get_current_user_role() = 'ADMIN'
);

-- Fix: Admins need to be able to update any profile.
CREATE POLICY "Admins can update any profile v2"
ON public.profiles
FOR UPDATE
USING (
  public.get_current_user_role() = 'ADMIN'
);
