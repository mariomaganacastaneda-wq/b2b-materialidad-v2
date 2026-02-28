require('dotenv').config({ path: require('path').resolve(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Use service role key if available to bypass RLS and verify data existence
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(process.env.VITE_SUPABASE_URL, serviceKey);

async function checkInvoices() {
    console.log("Checking if any invoices exist in the DB...");

    const { data: invoices, error } = await supabase.from('invoices').select('id, status, is_preinvoice, preinvoice_url, created_at').order('created_at', { ascending: false }).limit(5);

    if (error) {
        console.error("SELECT ERROR:", error.message);
    } else {
        console.log(`Found ${invoices.length} recent invoices:`);
        console.log(JSON.stringify(invoices, null, 2));
    }
}

checkInvoices();
