const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'web/.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

const UNIT_CATEGORIES = {
    'PESO': ['KGM', 'GRM', 'TNE', 'LBR', 'ONZ', 'MGM'],
    'TIEMPO': ['HUR', 'DAY', 'SEC', 'MON', 'ANN', 'MIN', 'WEE'],
    'LONGITUD': ['MTR', 'CMT', 'KMT', 'INH', 'FOT', 'YRD', 'SMI'],
    'VOLUMEN': ['LTR', 'MLT', 'MTQ', 'FTQ', 'GLI', 'GLL', 'PT'],
    'SUPERFICIE': ['MTK', 'FTK', 'CMK', 'INK', 'ARE', 'HAR'],
    'CONTEO': ['H87', 'DZN', 'MLR', 'SET', 'PR', 'C62'],
    'SERVICIOS': ['E48', 'ACT', 'SX', 'MUT', 'XPK', 'ZZ'],
    'ENERGIA': ['KWH', 'WHR', 'VLT', 'AMP', 'CEL']
};

function getCategory(code, name) {
    const n = name.toUpperCase();
    for (const [cat, codes] of Object.entries(UNIT_CATEGORIES)) {
        if (codes.includes(code)) return cat;
    }

    // Fallback por nombre
    if (n.includes('KILO') || n.includes('TONELADA') || n.includes('LIBRA') || n.includes('GRAMO')) return 'PESO';
    if (n.includes('HORA') || n.includes('DIA') || n.includes('MES') || n.includes('AÑO') || n.includes('SEGUNDO') || n.includes('MINUTO')) return 'TIEMPO';
    if (n.includes('METRO') || n.includes('CENTIMETRO') || n.includes('PIE') || n.includes('PULGADA')) return 'LONGITUD';
    if (n.includes('LITRO') || n.includes('CUBICO')) return 'VOLUMEN';
    if (n.includes('PIEZA') || n.includes('UNIDAD') || n.includes('DOCENA') || n.includes('CONJUNTO')) return 'CONTEO';
    if (n.includes('SERVICIO') || n.includes('ACTIVIDAD')) return 'SERVICIOS';

    return 'OTRO';
}

async function run() {
    try {
        const workbook = XLSX.readFile('C:\\Proyectos\\Memoria\\B2B_Materialidad\\Copia de catCFDI.xls');

        // 1. Importar Uso de CFDI
        console.log('Procesando Uso de CFDI...');
        const usoSheet = workbook.Sheets['c_UsoCFDI'];
        const usoRows = XLSX.utils.sheet_to_json(usoSheet, { header: 1 });
        const usageData = [];

        // Empezar en fila 6 (index 5)
        for (let i = 5; i < usoRows.length; i++) {
            const row = usoRows[i];
            if (row && row[0] && row[0].length === 3) {
                usageData.push({
                    code: row[0],
                    description: row[1],
                    applies_to_physical: row[2] === 'Sí',
                    applies_to_moral: row[3] === 'Sí'
                });
            }
        }

        if (usageData.length > 0) {
            const { error: uErr } = await supabase.from('cat_usage_cfdi').upsert(usageData, { onConflict: 'code' });
            if (uErr) console.error('Error Uso CFDI:', uErr.message);
            else console.log(`Se insertaron ${usageData.length} usos de CFDI.`);
        }

        // 2. Importar Claves de Unidad
        console.log('Procesando Claves de Unidad...');
        const unidadSheet = workbook.Sheets['c_ClaveUnidad'];
        const unidadRows = XLSX.utils.sheet_to_json(unidadSheet, { header: 1 });
        const unitData = [];

        // Empezar en fila 6 (index 5)
        for (let i = 5; i < unidadRows.length; i++) {
            const row = unidadRows[i];
            if (row && row[0]) {
                const code = String(row[0]).trim();
                const name = String(row[1]).trim();
                unitData.push({
                    code: code,
                    name: name,
                    description: row[2],
                    symbol: row[6],
                    category: getCategory(code, name)
                });
            }
        }

        // Insertar en bloques de 500 para evitar límites
        for (let i = 0; i < unitData.length; i += 500) {
            const chunk = unitData.slice(i, i + 500);
            const { error: unErr } = await supabase.from('cat_unit_codes').upsert(chunk, { onConflict: 'code' });
            if (unErr) console.error(`Error Unidades (bloque ${i}):`, unErr.message);
        }
        console.log(`Se terminaron de procesar ${unitData.length} unidades.`);

    } catch (err) {
        console.error('Error general:', err.message);
    }
}

run();
