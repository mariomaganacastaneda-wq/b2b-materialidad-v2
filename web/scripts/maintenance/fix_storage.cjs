const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixStorage() {
    console.log('Fixing storage RLS...');

    const query = `
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('invoices', 'invoices', true) 
    ON CONFLICT (id) DO UPDATE SET public = true;
    
    DROP POLICY IF EXISTS "Allow any user to upload invoices" ON storage.objects;
    DROP POLICY IF EXISTS "Allow any user to view invoices" ON storage.objects;
    DROP POLICY IF EXISTS "Allow any user to delete invoices" ON storage.objects;
    DROP POLICY IF EXISTS "Allow any user to update invoices" ON storage.objects;
    DROP POLICY IF EXISTS "Enable all access for authenticated users invoices" ON storage.objects;

    CREATE POLICY "Enable all access for authenticated users invoices" ON storage.objects
    FOR ALL TO authenticated USING (bucket_id = 'invoices') WITH CHECK (bucket_id = 'invoices');
  `;

    // We have a direct endpoint execution function we sometimes use, let's try direct postgres or via our edge function if needed
    // Alternatively, just creating the policies directly via standard SDK isn't supported, we need the `execute_sql` rpc

    const { data, error } = await supabaseAdmin.rpc('execute_sql', { query });

    if (error) {
        console.error('RPC Error:', error);
    } else {
        console.log('Success:', data);
    }
}

fixStorage();
