const XLSX = require('xlsx');

try {
    const workbook = XLSX.readFile('C:\\Proyectos\\Memoria\\B2B_Materialidad\\Copia de catCFDI.xls');

    const unidadSheet = workbook.Sheets['c_ClaveUnidad'];
    if (unidadSheet) {
        const rows = XLSX.utils.sheet_to_json(unidadSheet, { header: 1 });
        // Mostrar filas de la 5 a la 15 para saltar encabezados basura
        console.log('Filas 5-15 de c_ClaveUnidad:');
        rows.slice(5, 15).forEach(r => console.log(JSON.stringify(r)));
    }

    const usoSheet = workbook.Sheets['c_UsoCFDI'];
    if (usoSheet) {
        const rows = XLSX.utils.sheet_to_json(usoSheet, { header: 1 });
        console.log('\nFilas 5-15 de c_UsoCFDI:');
        rows.slice(5, 15).forEach(r => console.log(JSON.stringify(r)));
    }

} catch (err) {
    console.error('Error:', err.message);
}
