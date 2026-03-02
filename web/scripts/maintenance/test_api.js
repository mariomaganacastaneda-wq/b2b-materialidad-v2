
import fetch from 'node-fetch';

const URL = 'https://ywovtkubsanalddsdedi.supabase.co/rest/v1/organizations?select=*';
const KEY = 'sb_publishable_4TZm-phlmGg4Hu-IA_Weqg_IkhwANh1';

async function test() {
    console.log('--- DIAGNÓSTICO DE API REST SUPABASE ---');
    console.log('URL:', URL);
    try {
        const response = await fetch(URL, {
            headers: {
                'apikey': KEY,
                'Authorization': `Bearer ${KEY}`
            }
        });

        console.log('Status:', response.status);
        if (response.status !== 200) {
            console.error('Error Body:', await response.text());
            return;
        }

        const data = await response.json();
        console.log('Total registros recibidos:', data.length);
        if (data.length > 0) {
            console.log('Primer registro:', data[0].name);
        } else {
            console.warn('¡ATENCIÓN! La API devolvió 0 registros.');
        }
    } catch (err) {
        console.error('Error de conexión:', err.message);
    }
}

test();
