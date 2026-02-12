/**
 * AUTONOMOUS SAT DATA LOADER
 * -------------------------
 * Este script procesa los 53 lotes de SQL generados para el catálogo de Productos y Servicios del SAT.
 * Ejecuta cada lote de forma secuencial en Supabase, manejando el progreso de forma independiente.
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Configuración de la conexión (Extraída de Supabase)
// El usuario debe asegurarse de tener estas variables en su .env
const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
    console.error('❌ ERROR: No se encontró SUPABASE_DB_URL en el archivo .env');
    console.log('Por favor, agrega la cadena de conexión de Postgres de Supabase al archivo .env');
    console.log('Ejemplo: SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.ywovtkubsanalddsdedi.supabase.co:5432/postgres');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

const BATCH_DIR = './cfdi_batches';

async function runMigration() {
    console.log('🚀 Iniciando carga autónoma de catálogos SAT...');

    try {
        const files = fs.readdirSync(BATCH_DIR)
            .filter(f => f.startsWith('productos_batch_') && f.endsWith('.sql'))
            .sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)[0]);
                const numB = parseInt(b.match(/\d+/)[0]);
                return numA - numB;
            });

        console.log(`📦 Encontrados ${files.length} lotes para procesar.`);

        for (const file of files) {
            const filePath = path.join(BATCH_DIR, file);
            console.log(`⏳ Procesando ${file}...`);

            const sql = fs.readFileSync(filePath, 'utf8');

            const start = Date.now();
            await pool.query(sql);
            const duration = ((Date.now() - start) / 1000).toFixed(2);

            console.log(`✅ ${file} completado en ${duration}s`);
        }

        console.log('\n✨ ¡MIGRACIÓN COMPLETADA EXITOSAMENTE! ✨');
        console.log('Todos los registros del catálogo SAT han sido cargados.');

    } catch (err) {
        console.error('❌ ERROR DURANTE LA MIGRACIÓN:', err.message);
    } finally {
        await pool.end();
    }
}

runMigration();
