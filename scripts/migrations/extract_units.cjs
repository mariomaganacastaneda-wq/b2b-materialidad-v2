const XLSX = require('./web/node_modules/xlsx');
const fs = require('fs');

const file = 'C:/Proyectos/Memoria/B2B_Materialidad/Copia de catCFDI.xls';
const targetSheet = 'c_ClaveUnidad';

try {
    if (!fs.existsSync(file)) {
        console.error(`Error: El archivo no existe en ${file}`);
        process.exit(1);
    }
    const workbook = XLSX.readFile(file);
    const sheet = workbook.Sheets[targetSheet];

    if (!sheet) {
        console.error(`Error: No se encontró la hoja ${targetSheet}`);
        console.log(`Hojas disponibles: ${workbook.SheetNames.join(', ')}`);
        process.exit(1);
    }

    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // El catálogo suele empezar después de unas filas de encabezado.
    // Buscamos la fila que contiene "Clave Unidad" o similar.
    let startIndex = 0;
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row && row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('clave unidad'))) {
            startIndex = i + 1; // Los datos empiezan después del encabezado
            break;
        }
    }

    const units = data.slice(startIndex)
        .filter(row => row[0] && row[0].toString().length <= 3)
        .map(row => ({
            code: row[0].toString().trim(),
            name: row[1] ? row[1].toString().trim() : '',
            description: row[2] ? row[2].toString().trim() : '',
            symbol: row[6] ? row[6].toString().trim() : ''
        }))
        .filter(unit => unit.code !== 'c_ClaveUnidad' && unit.name && unit.code.length > 0);

    fs.writeFileSync('C:/Proyectos/Memoria/B2B_Materialidad/units_data.json', JSON.stringify(units, null, 2), 'utf8');
    console.log(`Catálogo de unidades extraído con éxito. Total: ${units.length} unidades.`);
} catch (error) {
    console.error(`Error procesando ${file}: ${error.message}`);
    process.exit(1);
}
