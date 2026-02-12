import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.SUPABASE_DB_URL;

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

const DIVISION_NAMES = {
    '01': 'Mascotas, Animales Domésticos y Accesorios',
    '10': 'Material Vivo Animal y Vegetal',
    '11': 'Material Mineral y Tejidos No Comestibles',
    '12': 'Productos Químicos y Plásticos',
    '13': 'Resina, Hule y Elastómeros',
    '14': 'Materiales de Papel y Cartón',
    '15': 'Materiales Combustibles y Lubricantes',
    '20': 'Minería y Perforación de Pozos',
    '21': 'Agricultura, Silvicultura y Jardinería',
    '22': 'Construcción y Edificación',
    '23': 'Manufactura y Procesamiento Industrial',
    '24': 'Material de Embalaje y Recipientes',
    '25': 'Vehículos y Accesorios de Transporte',
    '26': 'Generación y Distribución de Energía',
    '27': 'Herramientas y Maquinaria en General',
    '30': 'Componentes para Construcción y Obras Civiles',
    '31': 'Componentes de Manufactura',
    '32': 'Componentes y Suministros Electrónicos',
    '39': 'Suministros y Accesorios Eléctricos',
    '40': 'Distribución y Acondicionamiento Industrial',
    '41': 'Laboratorio, Medida y Observación',
    '42': 'Equipo Médico y Suministros',
    '43': 'Tecnologías de Información y Telecomunicaciones',
    '44': 'Equipos y Suministros de Oficina',
    '45': 'Impresión, Fotografía y Audiovisuales',
    '46': 'Defensa, Seguridad y Vigilancia',
    '47': 'Equipos y Suministros de Limpieza',
    '48': 'Maquinaria y Equipos para Servicios',
    '49': 'Recreación y Deportes',
    '50': 'Alimentos, Bebidas y Tabaco',
    '51': 'Medicamentos y Productos Farmacéuticos',
    '52': 'Artículos Domésticos y Bienes Personales',
    '53': 'Ropa, Maletas y Aseo Personal',
    '54': 'Relojería, Joyería y Piedras Preciosas',
    '55': 'Productos Publicados y Medios',
    '56': 'Muebles y Mobiliario',
    '60': 'Artes, Artesanías y Equipo Educativo',
    '64': 'Servicios de Seguros y Pensiones',
    '70': 'Servicios de Limpieza, Agricultura y Minería',
    '71': 'Servicios de Minas, Petróleo y Gas',
    '72': 'Servicios de Edificación y Mantenimiento',
    '73': 'Servicios de Apoyo y Fabricación Industrial',
    '76': 'Servicios de Limpieza y Gestión de Residuos',
    '77': 'Servicios de Medio Ambiente',
    '78': 'Servicios de Transporte y Almacenaje',
    '80': 'Servicios de Gestión y Administrativos',
    '81': 'Servicios de Ingeniería e Investigación',
    '82': 'Servicios Editoriales y de Publicidad',
    '83': 'Servicios Públicos y Sector Público',
    '84': 'Servicios Financieros e Institucionales',
    '85': 'Servicios de Salud',
    '86': 'Servicios Educativos y Formación',
    '90': 'Servicios de Viajes, Alojamiento y Entretenimiento',
    '91': 'Servicios Personales y Domésticos',
    '92': 'Servicios de Defensa y Seguridad Nacional',
    '93': 'Servicios Políticos y Asuntos Exteriores',
    '94': 'Organizaciones y Clubes',
    '95': 'Terrenos, Edificios y Estructuras'
};

async function updateNodeNames() {
    console.log('🧠 Iniciando actualización completa de nombres taxonómicos...');
    const client = await pool.connect();

    try {
        // 1. Obtener todos los registros de niveles superiores
        const { rows: nodes } = await client.query(`
            SELECT code, name, level 
            FROM cat_cfdi_productos_servicios 
            WHERE level IN ('DIVISION', 'GROUP')
        `);

        // 2. Obtener nombres de las clases para inferir nombres de grupos
        const { rows: classes } = await client.query(`
            SELECT code, name, parent_code 
            FROM cat_cfdi_productos_servicios 
            WHERE level = 'CLASS'
        `);

        const classMap = {};
        classes.forEach(c => {
            if (!classMap[c.parent_code]) classMap[c.parent_code] = [];
            classMap[c.parent_code].push(c.name);
        });

        const updates = [];

        for (const node of nodes) {
            let newName = node.name;
            const prefix = node.code.substring(0, 2);

            if (node.level === 'DIVISION') {
                const standardName = DIVISION_NAMES[prefix];
                if (standardName) {
                    newName = `${standardName} (División ${prefix})`;
                } else {
                    // Si no está en el mapa, al menos quitar el prefijo sintético si lo tiene
                    newName = node.name.replace('[SINTÉTICO] DIVISION - ', 'División No Identificada - ');
                }
            } else if (node.level === 'GROUP') {
                const childNames = classMap[node.code] || [];
                if (childNames.length > 0) {
                    // Intentar extraer una raíz común de los nombres de las clases
                    // Por ahora tomamos la primera pero añadimos "y relacionados"
                    let baseName = childNames[0].split(/[/(,]/)[0].trim();

                    // Si el nombre es muy corto o genérico, intentar con el segundo si existe
                    if (baseName.length < 5 && childNames.length > 1) {
                        baseName = childNames[1].split(/[/(,]/)[0].trim();
                    }

                    newName = `${baseName} y relacionados (Grupo ${node.code.substring(0, 4)})`;
                } else {
                    const divisionName = DIVISION_NAMES[prefix] || 'Categoría';
                    newName = `${divisionName} - Subgrupo ${node.code.substring(2, 4)}`;
                }
            }

            // Normalización final: Limpiar dobles espacios o caracteres extraños
            newName = newName.replace(/\s+/g, ' ').trim();

            if (newName !== node.name) {
                updates.push({ code: node.code, name: newName });
            }
        }

        console.log(`📝 Ejecutando ${updates.length} actualizaciones definitivas...`);

        // Usar una transacción para mayor seguridad
        await client.query('BEGIN');
        for (const update of updates) {
            await client.query(
                'UPDATE cat_cfdi_productos_servicios SET name = $1 WHERE code = $2',
                [update.name, update.code]
            );
        }
        await client.query('COMMIT');

        console.log('✅ Base de datos actualizada con taxonomía descriptiva completa.');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ ERROR CRÍTICO:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

updateNodeNames();
