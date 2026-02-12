
import xlsx from 'xlsx';
import fs from 'fs';

const FILE_PATH = '../Copia de catCFDI.xls';
const OUTPUT_DIR = './cfdi_batches';

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

const workbook = xlsx.readFile(FILE_PATH);

function cleanValue(val) {
    if (val === null || val === undefined) return '';
    return String(val).trim().replace(/'/g, "''");
}

function toBool(val) {
    if (!val) return 'FALSE';
    const s = String(val).trim().toLowerCase();
    return (s === 'sí' || s === 'si' || s === '1' || s === 'true') ? 'TRUE' : 'FALSE';
}

// 1. Regímenes Fiscales
function processRegimenes() {
    const sheet = workbook.Sheets['c_RegimenFiscal'];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    let sql = 'BEGIN;\n';

    // El archivo tiene encabezados en las primeras filas
    data.slice(5).forEach(row => {
        const code = cleanValue(row[0]);
        const name = cleanValue(row[1]);
        const physical = toBool(row[2]);
        const moral = toBool(row[3]);

        if (code && name) {
            sql += `INSERT INTO public.cat_cfdi_regimenes (code, name, applies_to_physical, applies_to_moral) VALUES ('${code}', '${name}', ${physical}, ${moral}) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, applies_to_physical = EXCLUDED.applies_to_physical, applies_to_moral = EXCLUDED.applies_to_moral;\n`;
        }
    });

    sql += 'COMMIT;';
    fs.writeFileSync(`${OUTPUT_DIR}/regimenes.sql`, sql);
    console.log('Regímenes procesados.');
}

// 2. Usos de CFDI
function processUsos() {
    const sheet = workbook.Sheets['c_UsoCFDI'];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    let sql = 'BEGIN;\n';

    data.slice(5).forEach(row => {
        const code = cleanValue(row[0]);
        const name = cleanValue(row[1]);
        const physical = toBool(row[2]);
        const moral = toBool(row[3]);

        if (code && name) {
            sql += `INSERT INTO public.cat_cfdi_usos (code, name, applies_to_physical, applies_to_moral) VALUES ('${code}', '${name}', ${physical}, ${moral}) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, applies_to_physical = EXCLUDED.applies_to_physical, applies_to_moral = EXCLUDED.applies_to_moral;\n`;
        }
    });

    sql += 'COMMIT;';
    fs.writeFileSync(`${OUTPUT_DIR}/usos.sql`, sql);
    console.log('Usos procesados.');
}

// 3. Clave de Productos y Servicios (Masivo)
function processProductos() {
    const sheet = workbook.Sheets['c_ClaveProdServ'];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    let batchSize = 1000;
    let currentBatch = 1;
    let count = 0;
    let sql = 'BEGIN;\n';

    data.slice(5).forEach(row => {
        const code = cleanValue(row[0]);
        const name = cleanValue(row[1]);
        const iva = toBool(row[2]);
        const ieps = toBool(row[3]);

        if (code && name) {
            sql += `INSERT INTO public.cat_cfdi_productos_servicios (code, name, includes_iva_transfered, includes_ieps_transfered) VALUES ('${code}', '${name}', ${iva}, ${ieps}) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, includes_iva_transfered = EXCLUDED.includes_iva_transfered, includes_ieps_transfered = EXCLUDED.includes_ieps_transfered;\n`;
            count++;

            if (count >= batchSize) {
                sql += 'COMMIT;';
                fs.writeFileSync(`${OUTPUT_DIR}/productos_batch_${currentBatch}.sql`, sql);
                currentBatch++;
                count = 0;
                sql = 'BEGIN;\n';
            }
        }
    });

    if (count > 0) {
        sql += 'COMMIT;';
        fs.writeFileSync(`${OUTPUT_DIR}/productos_batch_${currentBatch}.sql`, sql);
    }
    console.log(`Productos procesados en ${currentBatch} lotes.`);
}

processRegimenes();
processUsos();
processProductos();
