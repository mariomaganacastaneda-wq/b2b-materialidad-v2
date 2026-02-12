-- Create junction table for Economic Activities and Product/Service keys
CREATE TABLE IF NOT EXISTS rel_activity_product (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    activity_code TEXT NOT NULL REFERENCES cat_economic_activities(code),
    product_code TEXT NOT NULL REFERENCES cat_cfdi_productos_servicios(code),
    is_suggested BOOLEAN DEFAULT true,
    matching_score FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(activity_code, product_code)
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_rel_activity_code ON rel_activity_product(activity_code);
CREATE INDEX IF NOT EXISTS idx_rel_product_code ON rel_activity_product(product_code);

-- RLS Policies
ALTER TABLE rel_activity_product ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for all authenticated users"
ON rel_activity_product FOR SELECT
TO authenticated
USING (true);

COMMENT ON TABLE rel_activity_product IS 'Relación entre actividades económicas y claves de productos/servicios SAT sugeridas.';
