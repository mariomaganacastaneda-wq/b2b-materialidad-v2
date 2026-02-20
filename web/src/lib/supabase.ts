import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('SupabaseConfig: Checking environment variables...', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    url: supabaseUrl?.substring(0, 15) + '...'
});

let currentClerkToken: string | null = null;
let getClerkTokenFn: (() => Promise<string | null>) | null = null;

// Fail-safe client
export const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            // @ts-ignore - Sobrescribimos el fetch global para inyectar SIEMPRE el JWT actual de Clerk
            fetch: async (url: RequestInfo | URL, options: RequestInit = {}) => {
                const headers = new Headers(options?.headers);

                // Obtener el token más reciente justo antes de cada petición (Evita el "JWT expired")
                let tokenToUse = currentClerkToken;
                if (getClerkTokenFn) {
                    try {
                        const freshToken = await getClerkTokenFn();
                        if (freshToken) tokenToUse = freshToken;
                    } catch (e) {
                        console.warn('fetch interceptor: Error obteniendo token fresco de Clerk', e);
                    }
                }

                if (tokenToUse) {
                    headers.set('Authorization', `Bearer ${tokenToUse}`);
                }
                return fetch(url, { ...options, headers });
            }
        }
    })
    : null as any;

/**
 * Inyecta directamente el getter de token de Clerk para refresco dinámico
 */
export const setClerkTokenProvider = (provider: () => Promise<string | null>) => {
    getClerkTokenFn = provider;
};

/**
 * Actualiza la autorización del cliente global de Supabase.
 * En Supabase JS v2 debemos guardar el token en una variable que será
 * inspeccionada dinámicamente en cada petición mediante el custom fetch.
 */
export const updateSupabaseAuth = (token: string | null) => {
    currentClerkToken = token;

    if (!supabase) return;

    if (token) {
        // Actualizar realtime si existe
        // @ts-ignore
        if (supabase.realtime) supabase.realtime.setAuth(token);
    }
};

export const hasSupabaseConfig = !!(supabaseUrl && supabaseAnonKey);
