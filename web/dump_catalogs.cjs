const XLSX = require('xlsx');
const fs = require('fs');

try {
    const workbook = XLSX.readFile('C:\\Proyectos\\Memoria\\B2B_Materialidad\\Copia de catCFDI.xls');
    let output = '';

    const unidadSheet = workbook.Sheets['c_ClaveUnidad'];
    if (unidadSheet) {
        const rows = XLSX.utils.sheet_to_json(unidadSheet, { header: 1 });
        output += '--- c_ClaveUnidad ---\n';
        rows.slice(0, 30).forEach((r, i) => {
            output += `Row ${i}: ${JSON.stringify(r)}\n`;
        });
    }

    const usoSheet = workbook.Sheets['c_UsoCFDI'];
    if (usoSheet) {
        const rows = XLSX.utils.sheet_to_json(usoSheet, { header: 1 });
        output += '\n--- c_UsoCFDI ---\n';
        rows.slice(0, 30).forEach((r, i) => {
            output += `Row ${i}: ${JSON.stringify(r)}\n`;
        });
    }

    fs.writeFileSync('C:\\Proyectos\\Memoria\\B2B_Materialidad\\web\\dump_catalogs.txt', output);
    console.log('Dump completado en dump_catalogs.txt');

} catch (err) {
    console.error('Error:', err.message);
}
