const XLSX = require('xlsx');
const fs = require('fs');

const filePath = process.argv[2] || 'C:/Proyectos/Memoria/B2B_Materialidad/Ejemplos/PROFORMA MVC CESMA SERV. ASESORIA FIN. 2 de 24, Q2 ENE. 2026.xlsx';

if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
}

try {
    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Look for RFC pattern
    data.forEach((row, index) => {
        const rowStr = JSON.stringify(row);
        if (rowStr.includes('RFC') || rowStr.includes('R.F.C.')) {
            console.log(`Row ${index}:`, row);
        }
    });

    console.log('--- First 10 rows for context ---');
    console.log(JSON.stringify(data.slice(0, 10), null, 2));
} catch (error) {
    console.error('Error reading excel:', error);
}
