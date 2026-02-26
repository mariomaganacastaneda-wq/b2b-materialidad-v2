-- Create "quotations" bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('quotations', 'quotations', false)
ON CONFLICT (id) DO NOTHING;



-- Clean existing policies for idempotency
DROP POLICY IF EXISTS "Authenticated users can view quotation files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload quotation files" ON storage.objects;

-- Allow authenticated users to view quotation files
CREATE POLICY "Authenticated users can view quotation files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'quotations' AND auth.role() = 'authenticated'
);

-- Allow authenticated users to upload quotation files
CREATE POLICY "Authenticated users can upload quotation files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'quotations' AND auth.role() = 'authenticated'
);
