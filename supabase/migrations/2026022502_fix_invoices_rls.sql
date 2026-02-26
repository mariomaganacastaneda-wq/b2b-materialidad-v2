-- Corrección de Políticas RLS para la tabla invoices (Compatibilidad con Clerk TEXT IDs)
-- 
-- El uso de auth.uid() falla porque Supabase intenta internamente castear el Claim 'sub' a UUID,
-- lo cual explota con IDs de Clerk (ej. "user_39fz...").
-- Usamos (auth.jwt() ->> 'sub') que extrae el string sin intentar coerciones.

-- 1. Eliminar la política defectuosa
DROP POLICY IF EXISTS "Tenant isolation - Invoices" ON invoices;

-- 2. Crear la nueva política resistente
CREATE POLICY "Tenant isolation - Invoices" ON invoices 
FOR ALL USING (
    organization_id IN (
        SELECT organization_id 
        FROM profiles 
        WHERE id = (auth.jwt() ->> 'sub')
    )
);
