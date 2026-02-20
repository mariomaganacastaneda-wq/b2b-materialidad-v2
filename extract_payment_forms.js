const XLSX = require('./web/node_modules/xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = 'c:\\Proyectos\\Memoria\\B2B_Materialidad\\Copia de catCFDI.xls';
const outputPath = 'c:\\Proyectos\\Memoria\\B2B_Materialidad\\web\\src\\lib\\payment_forms.json';

try {
    console.log('Reading Excel file...');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = 'c_FormaPago';

    if (!workbook.SheetNames.includes(sheetName)) {
        console.error(`Sheet "${sheetName}" not found. Available sheets:`, workbook.SheetNames);
        process.exit(1);
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // Clean data: we usually need code and description
    // SAT catalogs usually have headers like "c_FormaPago" and "Descripción"
    const formattedData = data.map(row => ({
        code: row['c_FormaPago'] || row['Clave'] || Object.values(row)[0],
        name: row['Descripción'] || row['Nombre'] || Object.values(row)[1]
    })).filter(item => item.code && item.name);

    fs.writeFileSync(outputPath, JSON.stringify(formattedData, null, 2));
    console.log(`Successfully extracted ${formattedData.length} payment forms to ${outputPath}`);
} catch (error) {
    console.error('Error extracting data:', error);
}
