import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const N8N_WEBHOOK_URL = "https://n8n-n8n.5gad6x.easypanel.host/webhook/csf-extraction";

function parseSpanishDate(dateStr: string | null): string | null {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('/');
    if (parts.length === 3) {
        // Handle DD/MM/YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    // Handle "DD DE MES DE YYYY"
    const months: any = {
        'ENERO': '01', 'FEBRERO': '02', 'MARZO': '03', 'ABRIL': '04',
        'MAYO': '05', 'JUNIO': '06', 'JULIO': '07', 'AGOSTO': '08',
        'SEPTIEMBRE': '09', 'OCTUBRE': '10', 'NOVIEMBRE': '11', 'DICIEMBRE': '12'
    };
    const longDateMatch = dateStr.match(/(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(\d{4})/i);
    if (longDateMatch) {
        const day = longDateMatch[1].padStart(2, '0');
        const month = months[longDateMatch[2].toUpperCase()] || '01';
        const year = longDateMatch[3];
        return `${year}-${month}-${day}`;
    }
    return null;
}

function decodeClerkToken(token: string): any {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        // Decode base64url
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let currentFilePath = "";
    let userId: string | null = null;

    try {
        // --- NEW: Identify the caller using Clerk Token ---
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const decoded = decodeClerkToken(token);
            userId = decoded?.sub || null;
            console.log(`[FORENSIC] Clerk Token detectado. Usuario decodificado: ${userId || 'No identificado'}`);
        }

        const body = await req.json();
        currentFilePath = body.filePath;
        const { organizationId, isCreatingNew } = body;

        // 1. Download PDF from Storage
        const { data: fileData, error: downloadError } = await supabaseClient.storage.from('csf').download(currentFilePath);
        if (downloadError) throw new Error(`Error de descarga: ${downloadError.message}`);

        // 2. Call n8n Webhook
        console.log(`Enviando ${currentFilePath} a n8n para extracción granular...`);
        const formData = new FormData();
        // fileData is a Blob from download()
        const fileName = currentFilePath.split('/').pop() || 'document.pdf';
        formData.append('data', fileData, fileName);

        const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            body: formData
        });

        if (!n8nResponse.ok) {
            const errorText = await n8nResponse.text();
            throw new Error(`Fallo en n8n (${n8nResponse.status}): ${errorText}`);
        }

        let n8nData: any;
        const responseText = await n8nResponse.text();

        try {
            const parsed = JSON.parse(responseText);
            // n8n nodes often return an array. Python node wraps results in a .json property.
            const firstItem = Array.isArray(parsed) ? parsed[0] : parsed;
            n8nData = firstItem.json || firstItem;
            console.log("Datos desempaquetados de n8n:", JSON.stringify(n8nData).substring(0, 200) + "...");
        } catch (e) {
            console.error("Respuesta de n8n no es JSON válido:", responseText.substring(0, 500));
            throw new Error(`n8n devolvió una respuesta no válida (no JSON). Verifique los logs de n8n.`);
        }

        if (!n8nData || !n8nData.identificacion) {
            console.error("Estructura de n8n inválida. Datos recibidos:", JSON.stringify(n8nData));
            throw new Error("n8n no retornó la estructura de identificación esperada (identificacion).");
        }

        const { identificacion, domicilio, actividades_economicas, regimenes, obligaciones } = n8nData;
        const rfc = identificacion.rfc;

        console.log(`[FORENSIC] RFC detectado: "${rfc}"`);
        console.log(`[FORENSIC] Tipo Contribuyente: ${n8nData.tipo_contribuyente}`);
        console.log(`[FORENSIC] Conteo Actividades: ${actividades_economicas?.length || 0}`);
        console.log(`[FORENSIC] Conteo Régimenes: ${regimenes?.length || 0}`);
        console.log(`[FORENSIC] Conteo Obligaciones: ${obligaciones?.length || 0}`);

        if (!rfc) {
            console.error("[CRITICAL] RFC no detectado. Objeto identificacion completo:", JSON.stringify(identificacion));
            throw new Error("RFC no detectado en el PDF extraído por n8n.");
        }

        // Parse Emission Date from n8n
        const rawEmissionDate = identificacion.fecha_emision || identificacion.fecha_emision_raw;
        const emissionDateStr = rawEmissionDate ? parseSpanishDate(rawEmissionDate) : null;
        console.log(`[FORENSIC] Fecha Emisión Raw: ${rawEmissionDate} -> Parsed: ${emissionDateStr}`);
        const emissionDate = emissionDateStr ? new Date(emissionDateStr) : new Date();

        // 3. Resolve Organization and Check for Updates/Versions
        let finalOrgId = organizationId;
        const { data: existingOrg } = await supabaseClient
            .from('organizations')
            .select('id, name, rfc, csf_emission_date, csf_file_url')
            .eq('rfc', rfc)
            .maybeSingle();

        if (existingOrg) {
            finalOrgId = existingOrg.id;
            console.log(`[FORENSIC] Organización existente encontrada: ${finalOrgId} (${existingOrg.name})`);

            // VALIDATION: Check if new CSF is older than existing one
            if (existingOrg.csf_emission_date && emissionDateStr) {
                const existingDate = new Date(existingOrg.csf_emission_date);
                if (emissionDate < existingDate) {
                    throw new Error(`Operación cancelada: El documento cargado (emisión: ${emissionDateStr}) es más antiguo que el actual (${existingOrg.csf_emission_date}).`);
                }
            }
        } else {
            console.log(`[FORENSIC] No se encontró organización existente para RFC: ${rfc}`);
        }

        // 4. Prepare Update/Insert Payload
        const rawType = (n8nData.tipo_contribuyente || '').toUpperCase();
        const taxpayerType = rawType.includes('PERSONA_FISICA') || rawType.includes('PERSONA FISICA')
            ? 'PERSONA FÍSICA'
            : 'PERSONA MORAL';

        const updateData: any = {
            name: identificacion.denominacion_razon_social || identificacion.nombre_completo || rfc,
            first_name: identificacion.nombre, // Cambiado de nombres a nombre según script n8n
            last_name_1: identificacion.primer_apellido,
            last_name_2: identificacion.segundo_apellido,
            rfc: rfc,
            curp: identificacion.curp,
            taxpayer_type: taxpayerType,
            cif_id: identificacion.id_cif,
            brand_name: identificacion.nombre_comercial,
            commercial_name: identificacion.nombre_comercial,
            capital_regime: identificacion.regimen_capital,
            operations_start_date: parseSpanishDate(identificacion.fecha_inicio_operaciones),
            tax_status: identificacion.estatus_padron,
            last_status_change_date: parseSpanishDate(identificacion.fecha_ultimo_cambio_estado),
            tax_domicile: domicilio ? `CP: ${domicilio.codigo_postal}` : null,
            vialidad_type: domicilio?.tipo_vialidad,
            vialidad_name: domicilio?.nombre_vialidad,
            exterior_number: domicilio?.numero_exterior,
            interior_number: domicilio?.numero_interior,
            colony: domicilio?.colonia,
            locality: domicilio?.localidad,
            municipality: domicilio?.municipio_demarcacion,
            state: domicilio?.entidad_federativa,
            between_street_1: domicilio?.entre_calle,
            between_street_2: domicilio?.y_calle,
            csf_file_url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/csf/${currentFilePath}`,
            csf_emission_date: emissionDateStr || new Date().toISOString().split('T')[0],
            last_csf_update: new Date().toISOString()
        };

        console.log(`[FORENSIC] Payload preparado para RFC ${rfc}. Tipo: ${taxpayerType}`);

        if (existingOrg) {
            console.log(`[FORENSIC] Actualizando organización: ${finalOrgId}`);
            const { error: updateError } = await supabaseClient.from('organizations').update(updateData).eq('id', finalOrgId);
            if (updateError) throw updateError;
        } else if (isCreatingNew || !finalOrgId) {
            console.log(`[FORENSIC] Insertando nueva organización para RFC: ${rfc}`);
            const { data: newOrg, error: insertError } = await supabaseClient.from('organizations').insert({
                ...updateData,
                primary_color: '#6366f1'
            }).select().single();
            if (insertError) throw insertError;
            finalOrgId = newOrg.id;
            console.log(`[FORENSIC] Nueva organización creada con ID: ${finalOrgId}`);
        } else {
            console.log(`[FORENSIC] Actualizando organización (fall-through): ${finalOrgId}`);
            await supabaseClient.from('organizations').update(updateData).eq('id', finalOrgId);
        }

        // --- NEW: Archive this document in history ---
        console.log(`[FORENSIC] Registrando nuevo documento en el historial para Org: ${finalOrgId}`);
        await supabaseClient.from('organization_csf_history').insert({
            organization_id: finalOrgId,
            file_url: updateData.csf_file_url,
            emission_date: updateData.csf_emission_date,
            extracted_data: { rfc: updateData.rfc, name: updateData.name }
        });

        // --- NEW: Link User to Organization if not linked ---
        if (userId && finalOrgId) {
            const { data: existingAccess } = await supabaseClient
                .from('user_organization_access')
                .select('id')
                .eq('profile_id', userId)
                .eq('organization_id', finalOrgId)
                .maybeSingle();

            if (!existingAccess) {
                console.log(`[FORENSIC] Vinculando usuario ${userId} a la organización ${finalOrgId}...`);
                const { error: linkError } = await supabaseClient
                    .from('user_organization_access')
                    .insert({
                        profile_id: userId,
                        organization_id: finalOrgId,
                        can_manage_quotations: false, // Default to false (Admin must promote)
                        can_manage_payments: true, // Default to true (Client role)
                        is_owner: true // Default to true if they uploaded the CSF to register/update it
                    });

                if (linkError) {
                    console.error(`[FORENSIC] Error al vincular usuario: ${linkError.message}`);
                } else {
                    // Update user's active organization if they don't have one or if it's a new registration
                    const { data: profile } = await supabaseClient
                        .from('profiles')
                        .select('organization_id')
                        .eq('id', userId)
                        .single();

                    if (!profile?.organization_id || isCreatingNew) {
                        console.log(`[FORENSIC] Estableciendo ${finalOrgId} como organización activa para el usuario ${userId}`);
                        await supabaseClient.from('profiles').update({ organization_id: finalOrgId }).eq('id', userId);
                    }
                }
            }
        }

        // 5. Granular Synchronization (Activities, Regimes, Obligations)
        console.log(`[FORENSIC] Sincronizando datos granulares para Org: ${finalOrgId}`);

        // Activities
        if (actividades_economicas && actividades_economicas.length > 0) {
            console.log(`[FORENSIC] Reemplazando actividades económicas para Org: ${finalOrgId}`);
            // Borrar existentes para evitar duplicados en re-cargas
            await supabaseClient.from('organization_activities').delete().eq('organization_id', finalOrgId);

            // First, map activities and prepare descriptions
            const preparedActivities = actividades_economicas.map((a: any) => {
                const rawDesc = a.actividad_economica || "";
                // Normalización agresiva: remover NBSP, espacios múltiples y trim
                const cleanDesc = rawDesc
                    .replace(/\u00A0/g, ' ') // Reemplazar Non-breaking spaces
                    .replace(/\s+/g, ' ')    // Colapsar múltiples espacios
                    .trim();

                return {
                    organization_id: finalOrgId,
                    activity_order: parseInt(a.orden) || 1,
                    description: cleanDesc,
                    activity_code: a.codigo_sat,
                    percentage: parseInt(a.porcentaje) || 0,
                    start_date: parseSpanishDate(a.fecha_inicio)
                };
            });

            // Smart Mapping: Resolve missing codes by name
            for (const act of preparedActivities) {
                if (!act.activity_code && act.description) {
                    const { data: catMatches } = await supabaseClient
                        .from('cat_economic_activities')
                        .select('code')
                        .ilike('name', act.description)
                        .order('code', { ascending: false });

                    if (catMatches && catMatches.length > 0) {
                        // Seleccionamos el código más largo para asegurar especificidad
                        const bestMatch = catMatches.reduce((a: any, b: any) => a.code.length > b.code.length ? a : b);
                        console.log(`[FORENSIC] Código resuelto por nombre para "${act.description}": ${bestMatch.code}`);
                        act.activity_code = bestMatch.code;
                    } else {
                        console.log(`[FORENSIC] Intento fallido para: "${act.description}"`);
                    }
                }
            }

            const { error: actError } = await supabaseClient.from('organization_activities').insert(preparedActivities);
            if (actError) console.error(`[FORENSIC] Error en actividades: ${actError.message}`);
        }

        // Regimes
        if (regimenes && regimenes.length > 0) {
            console.log(`[FORENSIC] Insertando ${regimenes.length} regímenes...`);
            await supabaseClient.from('organization_regimes').delete().eq('organization_id', finalOrgId);

            // Map names to codes if missing
            const regimesData = await Promise.all(regimenes.map(async (r: any) => {
                const rawName = r.regimen || r.regime || "";
                let code = r.codigo_sat || r.code || r.regime_code;

                if (!code && rawName) {
                    // Try to find the code by name in our catalog
                    const { data: catReg } = await supabaseClient
                        .from('cat_cfdi_regimenes')
                        .select('code')
                        .ilike('name', `%${rawName}%`)
                        .maybeSingle();

                    if (catReg) code = catReg.code;
                }

                return {
                    organization_id: finalOrgId,
                    regime_name: rawName,
                    regime_code: code,
                    start_date: parseSpanishDate(r.fecha_inicio),
                    end_date: parseSpanishDate(r.fecha_fin)
                };
            }));

            const { error: regError } = await supabaseClient.from('organization_regimes').insert(regimesData);
            if (regError) console.error(`[FORENSIC] Error en regímenes: ${regError.message}`);
        }

        // Obligations
        if (obligaciones && obligaciones.length > 0) {
            console.log(`[FORENSIC] Insertando ${obligaciones.length} obligaciones...`);
            await supabaseClient.from('organization_obligations').delete().eq('organization_id', finalOrgId);
            const obligationsData = obligaciones.map((o: any) => ({
                organization_id: finalOrgId,
                description: o.descripcion_obligacion,
                due_date_description: o.descripcion_vencimiento,
                start_date: parseSpanishDate(o.fecha_inicio),
                end_date: parseSpanishDate(o.fecha_fin)
            }));
            const { error: oblError } = await supabaseClient.from('organization_obligations').insert(obligationsData);
            if (oblError) console.error(`[FORENSIC] Error en obligaciones: ${oblError.message}`);
        }

        // 6. Log Success
        await supabaseClient.from('edge_function_logs').insert({
            function_name: 'process-csf',
            event_type: 'GRANULAR_SYNC_V30_SUCCESS',
            payload: { rfc, name: updateData.name, orgId: finalOrgId, emissionDate: emissionDateStr }
        });

        return new Response(
            JSON.stringify({
                success: true,
                data: { rfc, name: updateData.name, orgId: finalOrgId, emissionDate: emissionDateStr }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error("[FORENSIC ERROR] Proceso fallido:", error.message);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
