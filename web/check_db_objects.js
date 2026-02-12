
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;
const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
    console.error('❌ ERROR: No se encontró SUPABASE_DB_URL');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function checkObjects() {
    const client = await pool.connect();
    try {
        console.log('🔍 Diagnosticando objetos de base de datos...');

        const tablesToCheck = ['organization_activities', 'organization_regimes', 'organization_obligations', 'organization_csf_history', 'cat_economic_activities', 'sat_blacklist'];
        const viewsToCheck = ['view_organization_activity_compliance', 'v_organizations_csf_status'];

        console.log('\n--- TABLAS ---');
        for (const table of tablesToCheck) {
            const { rows } = await client.query(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
                [table]
            );
            console.log(`${rows[0].exists ? '✅' : '❌'} ${table}`);
        }

        console.log('\n--- VISTAS ---');
        for (const view of viewsToCheck) {
            const { rows } = await client.query(
                "SELECT EXISTS (SELECT FROM information_schema.views WHERE table_schema = 'public' AND table_name = $1)",
                [view]
            );
            console.log(`${rows[0].exists ? '✅' : '❌'} ${view}`);
        }

        console.log('\n--- CONTEO DE DATOS ---');
        for (const table of tablesToCheck) {
            try {
                const { rows } = await client.query(`SELECT count(*) FROM public.${table}`);
                console.log(`📊 ${table}: ${rows[0].count} registros`);
            } catch (e) {
                console.log(`📊 ${table}: ERROR o no existe`);
            }
        }

    } catch (err) {
        console.error('❌ ERROR DIAGNÓSTICO:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkObjects();
