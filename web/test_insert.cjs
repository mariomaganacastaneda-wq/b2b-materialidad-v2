require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testInsert() {
    console.log("Testing insert into invoices...");

    // Using simple dummy values for a test insert
    const { data, error } = await supabase
        .from('invoices')
        .insert([{
            quotation_id: '00000000-0000-0000-0000-000000000000', // Need an existing quotation_id or just test the format
            organization_id: '00000000-0000-0000-0000-000000000000',
            amount_total: 100,
            internal_number: 'TEST_123',
            rfc_receptor: 'TEST123456',
            rfc_emisor: 'TEST654321',
            status: 'SOLICITUD'
        }])
        .select()
        .single();

    if (error) {
        console.error("ERROR:", JSON.stringify(error, null, 2));
    } else {
        console.log("SUCCESS:", data);
    }
}

testInsert();
