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

async function repairProductsHierarchy() {
    console.log('🔍 Iniciando reconstrucción profunda de taxonomía de Productos y Servicios SAT...');
    const client = await pool.connect();

    try {
        // 1. Obtener todos los productos/servicios existentes
        const { rows: products } = await client.query(
            'SELECT code, name FROM cat_cfdi_productos_servicios'
        );

        console.log(`📋 Analizando ${products.length} registros...`);

        const productMap = new Map();
        products.forEach(p => productMap.set(p.code, p.name));

        const divisions = new Set();
        const groups = new Set();
        const classes = new Set();

        const updates = [];
        const missingNodes = [];

        // Clasificar y encontrar nodos faltantes
        for (const p of products) {
            const { code } = p;

            // Niveles SAT (8 dígitos): 10 10 15 01
            // L1 (Division): 10000000
            // L2 (Group):    10100000
            // L3 (Class):    10101500
            // L4 (Product):  10101501

            const l1 = code.substring(0, 2) + '000000';
            const l2 = code.substring(0, 4) + '0000';
            const l3 = code.substring(0, 6) + '00';
            const l4 = code;

            let level = 'PRODUCT';
            let parent = null;

            if (code === l1) {
                level = 'DIVISION';
                parent = null;
                divisions.add(code);
            } else if (code === l2) {
                level = 'GROUP';
                parent = l1;
                groups.add(code);
            } else if (code === l3) {
                level = 'CLASS';
                parent = l2;
                classes.add(code);
            } else {
                level = 'PRODUCT';
                parent = l3;
            }

            // Verificar si los ancestros existen en el mapa, si no, prepararlos para creación
            [l1, l2, l3].forEach((ancestor, index) => {
                if (!productMap.has(ancestor)) {
                    const ancestorLevel = index === 0 ? 'DIVISION' : index === 1 ? 'GROUP' : 'CLASS';
                    const ancestorParent = index === 0 ? null : index === 1 ? l1 : l2;

                    missingNodes.push({
                        code: ancestor,
                        name: `[SINTÉTICO] ${ancestorLevel} - ${ancestor}`,
                        level: ancestorLevel,
                        parent_code: ancestorParent
                    });

                    productMap.set(ancestor, `[SINTÉTICO] ${ancestorLevel} - ${ancestor}`);
                }
            });

            updates.push({ code, level, parent_code: parent });
        }

        // Eliminar duplicados de missingNodes (pueden venir muchos por el mismo ancestro)
        const uniqueMissingNodes = Array.from(new Map(missingNodes.map(node => [node.code, node])).values());

        console.log(`🏗️ Creando ${uniqueMissingNodes.length} nodos taxonómicos faltantes...`);

        // Insertar nodos faltantes en batches
        for (let i = 0; i < uniqueMissingNodes.length; i += 100) {
            const batch = uniqueMissingNodes.slice(i, i + 100);
            const values = [];
            const placeholders = batch.map((node, j) => {
                const base = j * 4;
                values.push(node.code, node.name, node.level, node.parent_code);
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
            }).join(', ');

            await client.query(
                `INSERT INTO cat_cfdi_productos_servicios (code, name, level, parent_code) VALUES ${placeholders} ON CONFLICT (code) DO UPDATE SET level = EXCLUDED.level, parent_code = EXCLUDED.parent_code`,
                values
            );
        }

        console.log(`🔄 Actualizando jerarquía en ${updates.length} registros existentes...`);

        // Actualizar nivel y parent_code en batches
        for (let i = 0; i < updates.length; i += 500) {
            const batch = updates.slice(i, i + 500);

            // Usamos un query de actualización masiva eficiente
            const values = [];
            const whenStatements = batch.map((item, j) => {
                const base = j * 3;
                values.push(item.code, item.level, item.parent_code);
                return `WHEN code = $${base + 1} THEN $${base + 2}::product_service_level`;
            }).join(' ');

            const parentWhenStatements = batch.map((item, j) => {
                const base = j * 3;
                // No repetimos el código, ya está en values
                return `WHEN code = $${base + 1} THEN $${base + 3}`;
            }).join(' ');

            const codes = batch.map((_, j) => `$${j * 3 + 1}`).join(', ');

            await client.query(
                `UPDATE cat_cfdi_productos_servicios 
                 SET level = CASE ${whenStatements} END,
                     parent_code = CASE ${parentWhenStatements} END
                 WHERE code IN (${codes})`,
                values
            );

            if (i % 5000 === 0) console.log(`... procesados ${i} / ${updates.length}`);
        }

        console.log(`✅ Jerarquía completada con éxito.`);

    } catch (err) {
        console.error('❌ ERROR DURANTE LA RECONSTRUCCIÓN:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

repairProductsHierarchy();
