require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function runMigration() {
    console.log("Reading migration file...");
    const sql = fs.readFileSync('../supabase/migrations/2026022501_recreate_invoices_table.sql', 'utf8');

    // We can't guarantee rpc('run_sql') exists, but we can try if it's a common pattern here.
    // If not, we might need the user to run it via the Supabase dashboard.
    console.log("Attempting to execute migration via RPC...");
    const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });

    if (error) {
        console.error("RPC Error (Might not exist):", error.message);
        console.log("Please run the SQL file 'supabase/migrations/2026022501_recreate_invoices_table.sql' manually in the Supabase SQL Editor.");
    } else {
        console.log("Migration executed successfully!");
    }
}

runMigration();
