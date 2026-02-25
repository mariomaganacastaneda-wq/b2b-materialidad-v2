const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres.ywovtkubsanalddsdedi:JpqSvBWeNQ1XXL1N@aws-0-us-west-2.pooler.supabase.com:5432/postgres'
});

async function queryTables() {
    try {
        await client.connect();
        const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
        res.rows.forEach(r => console.log(r.table_name));
    } catch (e) {
        console.error('Error querying schema:', e);
    } finally {
        await client.end();
    }
}

queryTables();
