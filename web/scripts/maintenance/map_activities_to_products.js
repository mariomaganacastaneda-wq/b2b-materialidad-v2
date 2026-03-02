import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.SUPABASE_DB_URL;

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

// Helper para Similitud Jaro-Winkler (requerido por Protocolo SAT 2026)
function jaroWinkler(s1, s2) {
    if (s1 === s2) return 1.0;
    const len1 = s1.length;
    const len2 = s2.length;
    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
    const matches1 = new Array(len1).fill(false);
    const matches2 = new Array(len2).fill(false);
    let m = 0;
    let t = 0;

    for (let i = 0; i < len1; i++) {
        const start = Math.max(0, i - matchWindow);
        const end = Math.min(i + matchWindow + 1, len2);
        for (let j = start; j < end; j++) {
            if (matches2[j] || s1[i] !== s2[j]) continue;
            matches1[i] = true;
            matches2[j] = true;
            m++;
            break;
        }
    }
    if (m === 0) return 0.0;
    let k = 0;
    for (let i = 0; i < len1; i++) {
        if (!matches1[i]) continue;
        while (!matches2[k]) k++;
        if (s1[i] !== s2[k]) t++;
        k++;
    }
    const dj = (m / len1 + m / len2 + (m - t / 2) / m) / 3;
    const p = 0.1;
    let l = 0;
    while (s1[l] === s2[l] && l < 4) l++;
    return dj + l * p * (1 - dj);
}

const SECTOR_MAPPING_2026 = [
    { sector: 'Limpieza e Higiene', activityPrefix: '56', allowedDivisions: ['76', '47'], families: ['7611', '4713'] },
    { sector: 'Servicios Legales', activityPrefix: '54', allowedDivisions: ['80'], families: ['8012'] },
    // Expandiendo según documento de Análisis Técnico
];

async function mapActivitiesToProducts() {
    console.log('🔗 Iniciando Mapeo de Materialidad 360° (Ejercicio 2026)...');
    const client = await pool.connect();

    try {
        await client.query('TRUNCATE rel_activity_product');

        const { rows: activities } = await client.query(`
            SELECT id, code, name, description 
            FROM cat_economic_activities 
            WHERE level IN ('SUBRAMA')
        `);

        const { rows: allProducts } = await client.query(`
            SELECT code, name, level 
            FROM cat_cfdi_productos_servicios
        `);

        console.log(`📊 Validando ${activities.length} actividades contra jerarquía SAT (Optimizado)...`);

        for (const activity of activities) {
            const batch = [];
            const actPrefix2 = activity.code.substring(0, 2);
            const sectorRule = SECTOR_MAPPING_2026.find(s => activity.code.startsWith(s.activityPrefix));

            // FILTRADO DETERMINÍSTICO: Solo evaluamos productos que tengan al menos
            // un match de segmento o sector sugerido, de lo contrario ST nunca llegará a 0.70
            const candidateProducts = allProducts.filter(p => {
                const prodPrefix2 = p.code.substring(0, 2);
                return (sectorRule && sectorRule.allowedDivisions.includes(prodPrefix2)) || (actPrefix2 === prodPrefix2);
            });

            for (const prod of candidateProducts) {
                // 1. Score de Jerarquía (50%)
                let vJerarquia = 0;
                const prodPrefix2 = prod.code.substring(0, 2);

                if (sectorRule && sectorRule.allowedDivisions.includes(prodPrefix2)) {
                    vJerarquia = 1.0;
                } else if (actPrefix2 === prodPrefix2) {
                    vJerarquia = 0.7;
                }

                // Si VJ < 0.4, ST nunca podrá ser >= 0.70 (Matemática: 0.3*0.5 + 1*0.35 + 1*0.15 = 0.65)
                if (vJerarquia < 0.4) continue;

                // 2. Score Semántico (35%)
                const actText = (activity.name + ' ' + (activity.description || '')).toLowerCase();
                const prodText = prod.name.toLowerCase();
                // Usamos una muestra de 100 caracteres para el Jaro-Winkler para balancear precisión/velocidad
                const vSemantica = jaroWinkler(actText.substring(0, 100), prodText.substring(0, 100));

                // 3. Score de Unidad (15%)
                const vUnidad = (parseInt(prodPrefix2) >= 70) ? 1.0 : 0.5;

                // FÓRMULA OFICIAL SAT 2026
                const st = (vJerarquia * 0.50) + (vSemantica * 0.35) + (vUnidad * 0.15);

                if (st >= 0.70) {
                    batch.push({
                        activity_code: activity.code,
                        product_code: prod.code,
                        score: st
                    });
                }
            }

            if (batch.length > 0) {
                const values = batch.map(ins => `('${ins.activity_code}', '${ins.product_code}', ${ins.score})`).join(',');
                await client.query(`
                    INSERT INTO rel_activity_product (activity_code, product_code, matching_score)
                    VALUES ${values}
                    ON CONFLICT (activity_code, product_code) 
                    DO UPDATE SET matching_score = EXCLUDED.matching_score
                    WHERE EXCLUDED.matching_score > rel_activity_product.matching_score
                `);
            }
        }

        console.log('✅ Matriz de Relación (Materialidad 2026) completada.');

    } catch (err) {
        console.error('❌ ERROR:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

mapActivitiesToProducts();
