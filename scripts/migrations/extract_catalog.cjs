const fs = require('fs');
const path = require('path');

// Intentamos cargar las librerías desde la carpeta web/node_modules
const webNodeModules = path.join(__dirname, 'web', 'node_modules');
const pdfParsePath = path.join(webNodeModules, 'pdf-parse', 'dist', 'pdf-parse', 'cjs', 'index.cjs');
const xlsxPath = path.join(webNodeModules, 'xlsx', 'xlsx.js');

const pdf = require(pdfParsePath);
const XLSX = require(xlsxPath);

const pdfPath = path.join(__dirname, 'Cat_logo_de_Actividades_2019_compressed.pdf');
const outputPath = path.join(__dirname, 'Cat_logo_Actividades_Procesado.xlsx');

async function main() {
    try {
        console.log('Iniciando lectura de PDF...');
        if (!fs.existsSync(pdfPath)) {
            console.error(`Archivo no encontrado: ${pdfPath}`);
            return;
        }
        const dataBuffer = fs.readFileSync(pdfPath);

        // pdf-parse v2 (Mehmet Kozan)
        console.log('Iniciando PDFParse v2...');
        const { PDFParse } = pdf;
        const parser = new PDFParse({ data: dataBuffer });

        const result = await parser.getText();
        const text = result.text;

        // No olvidemos liberar memoria
        await parser.destroy();

        if (!text) {
            throw new Error('No se pudo extraer texto del PDF');
        }

        console.log('Texto extraído. Procesando líneas con lógica refinada...');
        const lines = text.split('\n');
        const extractedData = [];
        const seen = new Set();

        let currentCode = null;
        let currentDesc = '';

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            // Ignorar líneas que parecen encabezados de página o pies de página
            if (line.includes('--') || line.includes('SECTOR CLAVE') || line.includes('Agricultura, cría y')) {
                continue;
            }

            // Regex para detectar códigos (2 a 6 dígitos)
            const match = line.match(/^(\d{2,6})\s+(.+)$/);

            if (match) {
                // Si teníamos uno anterior, lo guardamos
                if (currentCode && !seen.has(currentCode + '|' + currentDesc.trim())) {
                    extractedData.push({
                        Clave: currentCode,
                        Descripcion: currentDesc.trim(),
                        Longitud: currentCode.length,
                        Fuente: 'SAT 2019 PDF'
                    });
                    seen.add(currentCode + '|' + currentDesc.trim());
                }

                currentCode = match[1];
                currentDesc = match[2];
            } else if (currentCode) {
                // Si no hay match pero hay un código activo, es continuación de la descripción
                // Filtramos elementos que parecen ruido (guiones excesivos, etc.)
                if (!line.startsWith('--')) {
                    currentDesc += ' ' + line;
                }
            }
        }

        // Guardar el último
        if (currentCode && !seen.has(currentCode + '|' + currentDesc.trim())) {
            extractedData.push({
                Clave: currentCode,
                Descripcion: currentDesc.trim(),
                Longitud: currentCode.length,
                Fuente: 'SAT 2019 PDF'
            });
        }

        console.log(`Se extrajeron ${extractedData.length} registros únicos.`);

        if (extractedData.length === 0) {
            console.warn('No se encontraron patrones de claves en el texto extraído. Verificando muestra del texto...');
            console.log('Muestra del texto:', text.substring(0, 500));
        }

        const worksheet = XLSX.utils.json_to_sheet(extractedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Catálogo');

        XLSX.writeFile(workbook, outputPath);
        console.log(`Archivo Excel guardado en: ${outputPath}`);

    } catch (error) {
        const errorDetail = `Error: ${error.message}\nStack: ${error.stack}`;
        fs.writeFileSync('error_log.txt', errorDetail);
        console.error('Error guardado en error_log.txt');
    }
}

main();
