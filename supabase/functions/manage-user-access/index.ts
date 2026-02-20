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
            console.log(`[ManageUserAccess] Eliminando acceso para perfil: ${profile_id}, org: ${organization_id}`);
            const { error } = await supabaseClient
                .from('user_organization_access')
                .delete()
                .match({ profile_id: profile_id, organization_id: organization_id });

            if (error) {
                console.error('[ManageUserAccess] Error en Delete:', error);
                throw error;
            }
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
