import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Manejo de CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const body = await req.json();
        const { profile_id, access_data, action, organization_id } = body;

        if (!profile_id) {
            throw new Error('Payload inválido: profile_id es requerido.');
        }

        if (action === 'delete') {
            if (!organization_id) throw new Error('organization_id requerido para delete.');
            console.log(`[ManageUserAccess] Solicitud de eliminación detectada.`);
            console.log(`[ManageUserAccess] profile_id: "${profile_id}"`);
            console.log(`[ManageUserAccess] organization_id: "${organization_id}"`);

            const { data: accessRecord, error: fetchError } = await supabaseClient
                .from('user_organization_access')
                .select('*')
                .match({ profile_id, organization_id })
                .maybeSingle();

            if (fetchError) {
                console.error('[ManageUserAccess] Error al buscar el registro:', fetchError);
                throw fetchError;
            }

            if (!accessRecord) {
                console.warn('[ManageUserAccess] No se encontró el registro para eliminar. Match fallido.');
                // Podríamos retornar éxito igual si el fin es que no exista, 
                // pero si el usuario se queja es por algo.
                throw new Error('No se encontró un vínculo activo para esta empresa en tu perfil.');
            }

            console.log(`[ManageUserAccess] Registro encontrado (ID: ${accessRecord.id}). Procediendo al borrado.`);

            const { error } = await supabaseClient
                .from('user_organization_access')
                .delete()
                .eq('id', accessRecord.id);

            if (error) {
                console.error('[ManageUserAccess] Error en Delete:', error);
                throw error;
            }

            console.log('[ManageUserAccess] Eliminación exitosa.');
            return new Response(
                JSON.stringify({ success: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!Array.isArray(access_data)) {
            throw new Error('Payload inválido: access_data (array) es requerido para upsert.');
        }

        console.log(`[ManageUserAccess] Procesando ${access_data.length} registros para el perfil: ${profile_id}`);

        // Realizar el upsert masivo usando SERVICE_ROLE (bypassing RLS)
        const { data, error } = await supabaseClient
            .from('user_organization_access')
            .upsert(access_data, {
                onConflict: 'profile_id,organization_id'
            })
            .select();

        if (error) {
            console.error('[ManageUserAccess] Error en Upsert:', error);
            throw error;
        }

        return new Response(
            JSON.stringify({ success: true, data }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error("[ManageUserAccess] Error fatal:", error.message);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
