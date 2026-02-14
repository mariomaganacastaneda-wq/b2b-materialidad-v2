const fs = require('fs');
const path = require('path');

const dir = 'sql_execution_batches';
if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        if (content.includes("'CLASE'")) {
            // Reemplazo global de 'CLASE' por 'SUBRAMA'
            const newContent = content.split("'CLASE'").join("'SUBRAMA'");
            fs.writeFileSync(filePath, newContent);
            console.log(`Patched: ${file}`);
        }
    });
} else {
    console.error('Directory sql_execution_batches not found');
}

// También parchar el archivo de inicialización si existe
const initFile = 'batch_activities_init.sql';
if (fs.existsSync(initFile)) {
    const content = fs.readFileSync(initFile, 'utf8');
    const newContent = content.split("'CLASE'").join("'SUBRAMA'");
    fs.writeFileSync('batch_activities_init_v2.sql', newContent);
    console.log('Patched: batch_activities_init.sql -> batch_activities_init_v2.sql');
}
