const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres.ywovtkubsanalddsdedi:JpqSvBWeNQ1XXL1N@aws-0-us-west-2.pooler.supabase.com:5432/postgres'
});

async function querySchema() {
    try {
        await client.connect();
        const res = await client.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name IN ('evidence') ORDER BY table_name;");
        res.rows.forEach(r => console.log(`${r.table_name}.${r.column_name}: ${r.data_type}`));
    } catch (e) {
        console.error('Error querying schema:', e);
    } finally {
        await client.end();
    }
}

querySchema();
