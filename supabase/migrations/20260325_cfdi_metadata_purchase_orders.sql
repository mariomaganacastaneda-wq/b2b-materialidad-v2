-- ============================================================================
-- Migración: Metadata CFDI 4.0 en purchase_orders
-- Fecha: 2026-03-25
-- Descripción: Agrega columnas para almacenar trazabilidad fiscal completa
--              de los CFDIs importados a través de la pantalla FileImport.
--              Incluye deduplicación por UUID fiscal.
-- ============================================================================

ALTER TABLE public.purchase_orders
    ADD COLUMN IF NOT EXISTS cfdi_uuid             TEXT,
    ADD COLUMN IF NOT EXISTS cfdi_tipo_comprobante CHAR(1),
    ADD COLUMN IF NOT EXISTS cfdi_fecha_emision    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cfdi_fecha_timbrado   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cfdi_lugar_expedicion VARCHAR(10),
    ADD COLUMN IF NOT EXISTS cfdi_emisor_regimen   VARCHAR(10),
    ADD COLUMN IF NOT EXISTS amount_descuento      DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS amount_retenciones    DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS client_postal_code    VARCHAR(10);

-- Comentarios
COMMENT ON COLUMN public.purchase_orders.cfdi_uuid IS
    'UUID fiscal del Timbre Fiscal Digital. Único por comprobante — previene importar el mismo CFDI dos veces.';
COMMENT ON COLUMN public.purchase_orders.cfdi_tipo_comprobante IS
    'Tipo de comprobante: I=Ingreso, E=Egreso, T=Traslado, N=Nómina, P=Pago.';
COMMENT ON COLUMN public.purchase_orders.cfdi_fecha_emision IS
    'Fecha y hora de expedición del CFDI (atributo Fecha del nodo Comprobante).';
COMMENT ON COLUMN public.purchase_orders.cfdi_fecha_timbrado IS
    'Fecha de certificación por el SAT (FechaTimbrado del TimbreFiscalDigital).';
COMMENT ON COLUMN public.purchase_orders.cfdi_lugar_expedicion IS
    'Código postal del lugar de expedición del CFDI (atributo LugarExpedicion).';
COMMENT ON COLUMN public.purchase_orders.cfdi_emisor_regimen IS
    'Clave del régimen fiscal del emisor (atributo RegimenFiscal del nodo Emisor).';
COMMENT ON COLUMN public.purchase_orders.amount_descuento IS
    'Monto total de descuentos del CFDI (atributo Descuento del nodo Comprobante).';
COMMENT ON COLUMN public.purchase_orders.amount_retenciones IS
    'Total de impuestos retenidos (ISR) del CFDI (TotalImpuestosRetenidos).';
COMMENT ON COLUMN public.purchase_orders.client_postal_code IS
    'Código postal fiscal del receptor (DomicilioFiscalReceptor del nodo Receptor, obligatorio en CFDI 4.0).';

-- Índice único para deduplicación por UUID fiscal
-- Permite NULL (PDFs/Excel no tienen UUID)
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_cfdi_uuid
    ON public.purchase_orders (cfdi_uuid)
    WHERE cfdi_uuid IS NOT NULL;

-- Índice para búsquedas por fecha de emisión CFDI
CREATE INDEX IF NOT EXISTS idx_purchase_orders_cfdi_fecha_emision
    ON public.purchase_orders (cfdi_fecha_emision)
    WHERE cfdi_fecha_emision IS NOT NULL;
