require('dotenv').config({ path: require('path').resolve(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Checking total count of invoices...");
    const { count, error } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Total rows in invoices table: ${count}`);
    }

    const { count: bCount, error: bError } = await supabase
        .from('invoices_backup')
        .select('*', { count: 'exact', head: true });

    if (bError) {
        console.error("Backup Error:", bError);
    } else {
        console.log(`Total rows in invoices_backup table: ${bCount}`);
    }
} main();
