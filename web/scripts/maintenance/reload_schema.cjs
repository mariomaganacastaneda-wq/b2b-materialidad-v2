const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres.ywovtkubsanalddsdedi:JpqSvBWeNQ1XXL1N@aws-0-us-west-2.pooler.supabase.com:5432/postgres'
});

async function reload() {
    try {
        await client.connect();
        await client.query("NOTIFY pgrst, 'reload schema';");
        console.log('✅ PostgREST Schema Cache Reloaded successfully');
    } catch (e) {
        console.error('Error reloading schema:', e);
    } finally {
        await client.end();
    }
}

reload();
