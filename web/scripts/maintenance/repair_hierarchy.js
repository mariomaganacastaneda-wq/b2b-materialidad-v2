
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
    console.error('❌ ERROR: No se encontró SUPABASE_DB_URL en el archivo .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function repairHierarchy() {
    console.log('🔍 Iniciando reconstrucción profunda de jerarquía SAT...');
    const client = await pool.connect();

    try {
        // 1. Obtener todas las actividades
        const { rows: activities } = await client.query(
            'SELECT id, code, level, name, parent_id FROM cat_economic_activities'
        );

        console.log(`📋 Analizando ${activities.length} registros...`);

        let remapped = 0;
        let created = 0;

        // Ordenamos por longitud de código para procesar de padres a hijos
        const sortedActivities = [...activities].sort((a, b) => a.code.length - b.code.length);

        for (const activity of sortedActivities) {
            // Buscamos el prefijo más largo posible
            let bestParentId = null;

            for (let i = activity.code.length - 1; i >= 2; i--) {
                const prefix = activity.code.substring(0, i);
                const found = activities.find(a => a.code === prefix);
                if (found) {
                    bestParentId = found.id;
                    break;
                }
            }

            // Si encontramos un padre mejor que el actual (o si no tenía uno)
            if (bestParentId && bestParentId !== activity.parent_id) {
                await client.query(
                    'UPDATE cat_economic_activities SET parent_id = $1 WHERE id = $2',
                    [bestParentId, activity.id]
                );
                activity.parent_id = bestParentId; // Actualizar localmente
                remapped++;
            }
            // Caso especial: Si es un orphan con código > 2 y no encontramos padre, creamos un Sector contenedor
            else if (!bestParentId && activity.code.length > 2 && !activity.parent_id) {
                const sectorCode = activity.code.substring(0, 2);
                let sector = activities.find(a => a.code === sectorCode);

                if (!sector) {
                    console.log(`🏗️ Creando sector sintético para prefijo ${sectorCode}...`);
                    const res = await client.query(
                        'INSERT INTO cat_economic_activities (code, name, level, description) VALUES ($1, $2, $3, $4) RETURNING id',
                        [sectorCode, `SECTOR GENERADO (${sectorCode})`, 'SECTOR', 'Nodo contenedor generado automáticamente para agrupar subramas huérfanas.']
                    );
                    const newId = res.rows[0].id;
                    sector = { id: newId, code: sectorCode, level: 'SECTOR' };
                    activities.push(sector);
                    created++;
                }

                await client.query(
                    'UPDATE cat_economic_activities SET parent_id = $1 WHERE id = $2',
                    [sector.id, activity.id]
                );
                activity.parent_id = sector.id;
                remapped++;
            }
        }

        console.log(`✅ Reconstrucción completada.`);
        console.log(`📊 Remapeados: ${remapped}`);
        console.log(`🏗️ Padres creados: ${created}`);

    } catch (err) {
        console.error('❌ ERROR DURANTE LA RECONSTRUCCIÓN:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

repairHierarchy();
