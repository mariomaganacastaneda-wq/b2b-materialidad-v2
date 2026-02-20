const XLSX = require('xlsx');

try {
    const workbook = XLSX.readFile('C:\\Proyectos\\Memoria\\B2B_Materialidad\\Copia de catCFDI.xls');
    console.log('Hojas encontradas:', workbook.SheetNames);

    // Ver c_UsoCFDI
    const usoSheet = workbook.Sheets['c_UsoCFDI'];
    if (usoSheet) {
        const usoData = XLSX.utils.sheet_to_json(usoSheet, { header: 1 });
        console.log('\nPrimeras 5 filas de c_UsoCFDI (Raw):', usoData.slice(0, 5));
    }

    // Ver c_ClaveUnidad
    const unidadSheet = workbook.Sheets['c_ClaveUnidad'];
    if (unidadSheet) {
        const unidadData = XLSX.utils.sheet_to_json(unidadSheet, { header: 1 });
        console.log('\nPrimeras 5 filas de c_ClaveUnidad (Raw):', unidadData.slice(0, 5));
    }

} catch (err) {
    console.error('Error al leer el archivo:', err.message);
}
