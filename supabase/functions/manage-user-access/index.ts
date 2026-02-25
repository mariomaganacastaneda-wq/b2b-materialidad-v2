import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AccessData {
    profile_id: string;
    organization_id: string;
    can_manage_quotations: boolean;
    can_manage_payments: boolean;
    is_owner: boolean;
}

interface ActionPayload {
    profile_id: string;
    access_data: AccessData[];
    action: 'upsert' | 'delete';
    organization_id?: string;
}

serve(async (req: Request) => {
    // Manejo de CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const body: ActionPayload = await req.json();
        const { profile_id, access_data, action, organization_id } = body;

        if (!profile_id) {
            throw new Error('Payload inválido: profile_id es requerido.');
        }

        if (action === 'delete') {
            if (!organization_id) throw new Error('organization_id requerido para delete.');

            const { data: accessRecord, error: fetchError } = await supabaseClient
                .from('user_organization_access')
                .select('*')
                .match({ profile_id, organization_id })
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (!accessRecord) {
                throw new Error('No se encontró un vínculo activo para esta empresa en tu perfil.');
            }

            const { error } = await supabaseClient
                .from('user_organization_access')
                .delete()
                .eq('id', (accessRecord as { id: string }).id);

            if (error) throw error;

            return new Response(
                JSON.stringify({ success: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!Array.isArray(access_data)) {
            throw new Error('Payload inválido: access_data (array) es requerido para upsert.');
        }

        // Realizar el upsert masivo usando SERVICE_ROLE (bypassing RLS)
        const { data, error } = await supabaseClient
            .from('user_organization_access')
            .upsert(access_data, {
                onConflict: 'profile_id,organization_id'
            })
            .select();

        if (error) throw error;

        return new Response(
            JSON.stringify({ success: true, data }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[ManageUserAccess] Error fatal:", message);
        return new Response(
            JSON.stringify({ success: false, error: message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
