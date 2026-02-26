-- migrating org_bank_accounts and quotation_payments RLS and triggers to use user_organization_access instead of profiles

-- 1. Fix trigger for bank accounts
CREATE OR REPLACE FUNCTION public.validate_bank_account_org()
RETURNS TRIGGER AS $$
DECLARE
    has_access BOOLEAN;
    user_role TEXT;
BEGIN
    -- Check if it's an admin first
    SELECT public.get_current_user_role() INTO user_role;
    IF user_role = 'ADMIN' THEN
        RETURN NEW;
    END IF;

    -- Check if user has access to this organization
    SELECT EXISTS (
        SELECT 1 FROM public.user_organization_access 
        WHERE profile_id = (auth.jwt() ->> 'sub') 
        AND organization_id = NEW.organization_id
    ) INTO has_access;

    IF NOT has_access THEN
        RAISE EXCEPTION 'Conflicto de Identidad: No puedes gestionar cuentas de otra empresa.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update RLS for org_bank_accounts
DROP POLICY IF EXISTS "Users can manage their organization bank accounts" ON public.org_bank_accounts;
CREATE POLICY "Users can manage their organization bank accounts" ON public.org_bank_accounts
FOR ALL USING (
    organization_id IN (
        SELECT organization_id FROM public.user_organization_access WHERE profile_id = (auth.jwt() ->> 'sub')
    ) OR public.get_current_user_role() = 'ADMIN'
);

-- 3. Update RLS for quotation_payments
DROP POLICY IF EXISTS "Users can manage payments for their quotations" ON public.quotation_payments;
CREATE POLICY "Users can manage payments for their quotations" ON public.quotation_payments
FOR ALL USING (
    quotation_id IN (
        SELECT id FROM public.quotations WHERE organization_id IN (
            SELECT organization_id FROM public.user_organization_access WHERE profile_id = (auth.jwt() ->> 'sub')
        )
    ) OR public.get_current_user_role() = 'ADMIN'
);
