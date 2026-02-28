require('dotenv').config({ path: require('path').resolve(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(process.env.VITE_SUPABASE_URL, serviceKey);

async function testInsert() {
    console.log("Testing raw DB insert using Service Role Key (bypassing RLS)...");

    const payload = {
        organization_id: "580ba646-1f42-4593-93e3-65f110854556", // Reusing org ID from UI logs
        amount_total: 100,
        internal_number: "TEST-01",
        status: "SOLICITUD"
    };

    const { data, error } = await supabase.from('invoices').insert(payload).select().single();

    if (error) {
        console.error("INSERT ERROR:");
        console.error(error);
        fs.writeFileSync('insert_error2.json', JSON.stringify(error, null, 2));
    } else {
        console.log("INSERT SUCCESS! Data:");
        console.log(data);
    }
}

testInsert();
