const XLSX = require('xlsx');
const fs = require('fs');

const file1 = 'C:/Proyectos/Memoria/B2B_Materialidad/Anexo6_RMF_2026_Catalogo.xlsx';
const file2 = 'C:/Proyectos/Memoria/B2B_Materialidad/Copia de Cat_Actividad.xls';

function extractData(file) {
    const workbook = XLSX.readFile(file);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Encontrar la fila que parece ser el encabezado
    let headerIndex = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        if ((row.some(cell => String(cell).toLowerCase().includes('clave')) ||
            row.some(cell => String(cell).toLowerCase().includes('codigo'))) &&
            row.some(cell => String(cell).toLowerCase().includes('descrip'))) {
            headerIndex = i;
            break;
        }
    }

    if (headerIndex === -1) {
        console.log(`Header not found for file: ${file}. Sample rows:`, rows.slice(0, 5));
        return [];
    }

    const headers = rows[headerIndex].map(h => String(h || '').toLowerCase());
    const claveIdx = headers.findIndex(h => h.includes('clave') || h.includes('id') || h.includes('codigo'));
    const descIdx = headers.findIndex(h => h.includes('descrip') || h.includes('nombre'));

    return rows.slice(headerIndex + 1).map(row => ({
        clave: String(row[claveIdx] || ''),
        nombre: String(row[descIdx] || '')
    })).filter(r => r.clave && r.nombre && r.clave !== 'undefined');
}

const data1 = extractData(file1);
const data2 = extractData(file2);

console.log('Registros extraídos Archivo 1:', data1.length);
console.log('Registros extraídos Archivo 2:', data2.length);

const consolidated = [...data1, ...data2];

// Eliminar duplicados por clave
const uniqueRows = [];
const seenCodes = new Set();
consolidated.forEach(row => {
    if (!seenCodes.has(row.clave)) {
        uniqueRows.push(row);
        seenCodes.add(row.clave);
    }
});

fs.writeFileSync('consolidated_activities.json', JSON.stringify(uniqueRows, null, 2));
console.log(`Extracción completada. Total registros únicos: ${uniqueRows.length}`);
console.log('Muestra de los primeros 5:');
console.log(JSON.stringify(uniqueRows.slice(0, 5), null, 2));
