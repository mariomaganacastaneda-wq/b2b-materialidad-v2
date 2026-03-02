const XLSX = require('xlsx');
const fs = require('fs');

const files = [
    'C:/Proyectos/Memoria/B2B_Materialidad/Anexo6_RMF_2026_Catalogo.xlsx',
    'C:/Proyectos/Memoria/B2B_Materialidad/Copia de Cat_Actividad.xls'
];

files.forEach(file => {
    console.log(`\n========================================`);
    console.log(`ARCHIVO: ${file}`);
    console.log(`========================================`);
    try {
        if (!fs.existsSync(file)) {
            console.error(`Error: El archivo no existe en ${file}`);
            return;
        }
        const workbook = XLSX.readFile(file);
        console.log(`Hojas encontradas: ${workbook.SheetNames.join(', ')}`);

        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            console.log(`\n--- Hoja: ${sheetName} ---`);
            console.log(`Total filas: ${data.length}`);
            console.log(`Muestra (primeras 10 filas):`);
            data.slice(0, 10).forEach((row, i) => {
                console.log(`${i}: ${JSON.stringify(row)}`);
            });
        });
    } catch (error) {
        console.error(`Error procesando ${file}: ${error.message}`);
        console.error(error.stack);
    }
});
