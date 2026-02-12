-- MIGRACION: Enforce Multi-Account Security and Double Validation
-- Objetivo: Vincular estrictamente usuarios a empresas y validar proformas.

-- 1. Asegurar que los perfiles tengan siempre una organización vinculada
ALTER TABLE profiles 
ALTER COLUMN organization_id SET NOT NULL;

-- 2. Función para validar consistencia entre documento y usuario
-- Esta función se usará en la captura de proformas (quotations)
CREATE OR REPLACE FUNCTION public.validate_quotation_issuer()
RETURNS TRIGGER AS $$
DECLARE
    user_org_id UUID;
BEGIN
    -- Obtener la organización del usuario que realiza la inserción
    SELECT organization_id INTO user_org_id 
    FROM profiles 
    WHERE id = auth.uid();

    -- Validar que la organización de la proforma coincida con la del usuario
    -- Esto asume que la tabla quotations tiene un campo organization_id (ya presente en el schema)
    IF NEW.organization_id <> user_org_id THEN
        RAISE EXCEPTION 'Conflicto de Identidad: La empresa de la proforma no corresponde a la empresa de su acceso actual.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger preventivo en la tabla de cotizaciones/proformas
DROP TRIGGER IF EXISTS tr_validate_quotation_issuer ON quotations;
CREATE TRIGGER tr_validate_quotation_issuer
BEFORE INSERT OR UPDATE ON quotations
FOR EACH ROW
EXECUTE FUNCTION public.validate_quotation_issuer();

-- 4. Nueva tabla opcional para mapear "Sellers Humanos" (Solo para fines de auditoría)
-- Permite saber qué personas físicas operan qué cuentas de empresa
CREATE TABLE human_operators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email_personal TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Columna de referencia en profiles para ligar cuentas al mismo operador humano
ALTER TABLE profiles 
ADD COLUMN human_operator_id UUID REFERENCES human_operators(id);

COMMENT ON TABLE human_operators IS 'Registro de operadores humanos que pueden tener múltiples cuentas de acceso (una por empresa).';
