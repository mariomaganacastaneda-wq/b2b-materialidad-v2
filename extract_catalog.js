import fs from 'fs';
import path from 'path';
import pdf from './web/node_modules/pdf-parse/index.js';
import * as XLSX from './web/node_modules/xlsx/xlsx.mjs';

const pdfPath = './Cat_logo_de_Actividades_2019_compressed.pdf';
const outputPath = './Cat_logo_Actividades_Procesado.xlsx';

async function main() {
    try {
        console.log('Iniciando lectura de PDF...');
        const dataBuffer = fs.readFileSync(pdfPath);

        const data = await pdf(dataBuffer);
        const text = data.text;

        console.log('Texto extraído. Procesando líneas...');
        const lines = text.split('\n');

        const extractedData = [];

        // Regex simple para detectar: Clave (numérica) y descripción
        // El catálogo del SAT usualmente tiene: SECTOR -> SUBSECTOR -> RAMA -> SUBRAMA
        // Las claves suelen ser de 1 a 6 dígitos.

        let currentSector = '';
        let currentSubsector = '';

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            // Ejemplo de patrón: "111110 Siembra de cereales"
            // O encabezados de niveles superiores
            const match = line.match(/^(\d{2,6})\s+(.+)$/);

            if (match) {
                const code = match[1];
                const description = match[2];
                let level = '';

                if (code.length === 2) level = 'SECTOR';
                else if (code.length === 3) level = 'SUBSECTOR';
                else if (code.length === 4) level = 'RAMA';
                else level = 'SUBRAMA';

                extractedData.push({
                    Clave: code,
                    Descripcion: description,
                    Nivel: level,
                    Fuente: 'SAT 2019 PDF'
                });
            }
        }

        console.log(`Se extrajeron ${extractedData.length} registros.`);

        const worksheet = XLSX.utils.json_to_sheet(extractedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Catálogo');

        XLSX.writeFile(workbook, outputPath);
        console.log(`Archivo Excel guardado en: ${outputPath}`);

    } catch (error) {
        console.error('Error durante el procesamiento:', error);
    }
}

main();
