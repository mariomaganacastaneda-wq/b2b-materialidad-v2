/**
 * integrate_sat_data.cjs
 * 
 * Script unificado para la integración de catálogos SAT:
 * 1. Actividades Económicas 2026 (Desde catALogo_Actividades_Procesado.xlsx)
 * 2. Jerarquía y Palabras Clave (Desde Catalo_actividades/*.xlsx)
 * 3. Mapeo de Recomendación (Actividad -> Familia UNSPSC)
 * 
 * Basado en la Matriz de Relación 2026 para garantizar materialidad.
 */

const XLSX = require('./web/node_modules/xlsx/xlsx.js');
const fs = require('fs');
const path = require('path');

const PDF_EXTRACT_FILE = 'Cat_logo_Actividades_Procesado.xlsx';
const EXCEL_FOLDER = 'Catalo_actividades';
const OUTPUT_SQL = 'load_integrated_sat_data.sql';

// Mapeo manual de Sectores Excel -> Segmentos UNSPSC (Basado en Matriz de Relación)
const SECTOR_TO_UNSPSC = {
    '11': '10', // Agricultura -> Material de Plantas y animales
    '23': '72', // Construcción -> Servicios de Edificación y Construcción
    '43': '24', // Comercio Mayorista -> Material de empaque
    '46': '50', // Comercio Minorista -> Alimentos y Bebidas
    '54': '80', // Servicios Profesionales -> Servicios de Gestión y Profesionales
    '61': '81', // Servicios Educativos -> Servicios Educativos y Formación
    '81': '72', // Otros Servicios -> Servicios de Mantenimiento
    '93': '93'  // Gobierno -> Servicios Políticos y de Asuntos Públicos
};

async function main() {
    console.log('--- Iniciando Integración de Catálogos SAT ---');

    // 1. Cargar base de Actividades 2026 (PDF)
    const wbPdf = XLSX.readFile(PDF_EXTRACT_FILE);
    const activities2026 = XLSX.utils.sheet_to_json(wbPdf.Sheets[wbPdf.SheetNames[0]]);
    console.log(`Lote 2026 cargado: ${activities2026.length} registros.`);

    // 2. Procesar Jerarquía y Tokens (Excéls 2019)
    const excelFiles = fs.readdirSync(EXCEL_FOLDER).filter(f => f.endsWith('.xlsx'));
    const tokens = [];
    const hierarchy = new Map();
    const recommendationLinks = [];

    for (const file of excelFiles) {
        console.log(`Procesando enriquecimiento: ${file}`);
        const wb = XLSX.readFile(path.join(EXCEL_FOLDER, file));
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

        data.forEach(row => {
            const code = String(row['CLAVE CLASE ACTIVIDAD'] || '').trim();
            if (code && code.length === 6) {
                // Guardar Jerarquía
                hierarchy.set(code, {
                    sector: row['CLAVE SECTOR'],
                    subsector: row['CLAVE SUBSECTOR'],
                    parent: row['CLAVE RAMA']
                });

                // Extraer Tokens (Palabras clave)
                const rawProducts = String(row['PRODUCTOS'] || '');
                const cleanTokens = rawProducts
                    .split(/[,-]/)
                    .map(t => t.trim().toLowerCase())
                    .filter(t => t.length > 3);

                cleanTokens.forEach(token => {
                    tokens.push({ code, token });
                });

                // Crear vínculo de recomendación (UNSPSC Segment/Family)
                const sector = String(row['CLAVE SECTOR']);
                if (SECTOR_TO_UNSPSC[sector]) {
                    recommendationLinks.push({
                        activity_code: code,
                        cps_family: SECTOR_TO_UNSPSC[sector],
                        reason: `Vínculo sectorial: ${row['SECTOR']}`
                    });
                }
            }
        });
    }

    // 3. Generar SQL de Carga
    console.log('Generando SQL final...');
    let sql = `-- Datos Integrados SAT 2026-2019\nBEGIN;\n\n`;

    // Actualizar Actividades con Jerarquía
    activities2026.forEach(act => {
        const h = hierarchy.get(String(act.Codigo));
        if (h) {
            sql += `UPDATE public.cat_economic_activities SET sector_code = '${h.sector}', subsector_code = '${h.subsector}', parent_code = '${h.parent}' WHERE code = '${act.Codigo}';\n`;
        }
    });

    // Cargar Tokens (Batch de 50 para no saturar)
    sql += `\n-- Tokens de Búsqueda\n`;
    for (let i = 0; i < tokens.length; i += 50) {
        const batch = tokens.slice(i, i + 50);
        sql += `INSERT INTO public.cat_activity_search_tokens (activity_code, keyword) VALUES \n`;
        sql += batch.map(t => `('${t.code}', '${t.token.replace(/'/g, "''")}')`).join(',\n') + `;\n`;
    }

    // Cargar Recomendaciones
    sql += `\n-- Matriz de Recomendación (Congruencia)\n`;
    recommendationLinks.forEach(link => {
        sql += `INSERT INTO public.rel_activity_cps_congruence (activity_code, cps_family_code, score, reason) \n`;
        sql += `VALUES ('${link.activity_code}', '${link.cps_family}', 1.0, '${link.reason}') \n`;
        sql += `ON CONFLICT (activity_code, cps_family_code) DO NOTHING;\n`;
    });

    sql += `\nCOMMIT;`;

    fs.writeFileSync(OUTPUT_SQL, sql);
    console.log(`--- Proceso completado. SQL generado en ${OUTPUT_SQL} ---`);
    console.log(`Tokens generados: ${tokens.length}`);
    console.log(`Vínculos de recomendación: ${recommendationLinks.length}`);
}

main().catch(console.error);
