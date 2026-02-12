-- 1. Crear tabla de versiones del sistema
CREATE TABLE IF NOT EXISTS public.sys_versions (
    tag TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    changelog JSONB DEFAULT '[]'::jsonb,
    rollback_script TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Habilitar RLS
ALTER TABLE public.sys_versions ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de acceso (Lectura para todos los perfiles autenticados)
CREATE POLICY "Versiones legibles por todos los usuarios autenticados"
ON public.sys_versions FOR SELECT
TO authenticated
USING (true);

-- 4. Comentarios
COMMENT ON TABLE public.sys_versions IS 'Catálogo de versiones y cambios del sistema SEICO B2B.';
COMMENT ON COLUMN public.sys_versions.tag IS 'Tag de versión (e.g., v1.5.0)';
COMMENT ON COLUMN public.sys_versions.rollback_script IS 'Script SQL o instrucciones técnicas para revertir los cambios de esta versión.';

-- 5. Insertar historial inicial (ejemplos de lo realizado)
INSERT INTO public.sys_versions (tag, name, description, changelog) VALUES
('v1.0.0', 'Lanzamiento Inicial', 'Estructura base del sistema B2B Materialidad.', '[{"type": "feat", "desc": "Estructura de base de datos inicial"}]'),
('v1.2.0', 'Dossier Legal', 'Implementación de gestión de documentos corporativos.', '[{"type": "feat", "desc": "Módulo de Dossier Manager"}, {"type": "feat", "desc": "Integración con SHA256 para integridad de archivos"}]'),
('v1.4.0', 'Automatización SAT', 'Sincronización automática de listas negras y tableros premium.', '[{"type": "feat", "desc": "Flujo n8n para Listas Negras 69/69-B"}, {"type": "ui", "desc": "UI Multi-Acordeón Premium"}]'),
('v1.5.0', 'Taxonomía SAT Jerárquica', 'Reconstrucción de jerarquías para Actividades Económicas y Productos/Servicios.', '[{"type": "fix", "desc": "Arreglo de jerarquía de Actividades Económicas"}, {"type": "feat", "desc": "Taxonomía de 52k Productos y Servicios"}]')
ON CONFLICT (tag) DO NOTHING;
