-- Create invoices bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if they exist (to be safe)
DROP POLICY IF EXISTS "Allow any user to upload invoices" ON storage.objects;
DROP POLICY IF EXISTS "Allow any user to view invoices" ON storage.objects;
DROP POLICY IF EXISTS "Allow any user to delete invoices" ON storage.objects;
DROP POLICY IF EXISTS "Allow any user to update invoices" ON storage.objects;
DROP POLICY IF EXISTS "Enable all access for authenticated users invoices" ON storage.objects;

-- Create policies for authenticated users
CREATE POLICY "Enable all access for authenticated users invoices" ON storage.objects
FOR ALL TO authenticated USING (bucket_id = 'invoices') WITH CHECK (bucket_id = 'invoices');
