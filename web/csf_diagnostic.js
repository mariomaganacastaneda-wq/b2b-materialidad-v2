import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
});

async function runDiagnostic() {
    console.log("🚀 Iniciando diagnóstico completo de captura de CSF...");

    try {
        const client = await pool.connect();

        // 1. Verificar logs de la función process-csf
        console.log("\n--- Auditando logs de Edge Function: process-csf ---");
        const logRes = await client.query(`
            SELECT id, payload, created_at 
            FROM edge_function_logs 
            WHERE function_name = 'process-csf'
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        if (logRes.rows.length === 0) {
            console.log("⚠️ No se encontraron logs para 'process-csf'.");
        } else {
            console.table(logRes.rows.map(r => ({
                id: r.id,
                time: r.created_at,
                payload_summary: JSON.stringify(r.payload).substring(0, 100) + "..."
            })));
        }

        // 2. Verificar conectividad con n8n
        console.log("\n--- Verificando conectividad con n8n ---");
        const n8nUrl = "https://n8n-n8n.5gad6x.easypanel.host/healthz";
        try {
            const n8nRes = await axios.get(n8nUrl, { timeout: 5000 });
            console.log(`✅ n8n está ONLINE (Status: ${n8nRes.status})`);
        } catch (e) {
            console.error(`❌ n8n está OFFLINE o inalcanzable: ${e.message}`);
        }

        // 3. Verificar estado de las tablas de organización
        console.log("\n--- Verificando estado de tablas de datos ---");
        const tables = ['organization_activities', 'organization_regimes', 'organization_obligations'];
        for (const table of tables) {
            const countRes = await client.query(`SELECT count(*) FROM ${table}`);
            console.log(`Regisros en ${table}: ${countRes.rows[0].count}`);
        }

        client.release();
    } catch (err) {
        console.error("❌ Error de diagnóstico:", err.message);
    } finally {
        await pool.end();
    }
}

runDiagnostic();
