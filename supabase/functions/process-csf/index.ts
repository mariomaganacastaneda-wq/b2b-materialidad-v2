import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const N8N_WEBHOOK_URL = "https://n8n-n8n.5gad6x.easypanel.host/webhook/csf-extraction";

interface Identificacion {
    rfc: string;
    denominacion_razon_social?: string;
    nombre_completo?: string;
    nombre?: string;
    primer_apellido?: string;
    segundo_apellido?: string;
    curp?: string;
    id_cif?: string;
    nombre_comercial?: string;
    regimen_capital?: string;
    fecha_inicio_operaciones?: string;
    estatus_padron?: string;
    fecha_ultimo_cambio_estado?: string;
    fecha_emision?: string;
    fecha_emision_raw?: string;
}

interface Domicilio {
    codigo_postal?: string;
    tipo_vialidad?: string;
    nombre_vialidad?: string;
    numero_exterior?: string;
    numero_interior?: string;
    colonia?: string;
    localidad?: string;
    municipality_demarcacion?: string;
    municipio_demarcacion?: string;
    entidad_federativa?: string;
    entre_calle?: string;
    y_calle?: string;
}

interface ActividadEconomica {
    actividad_economica: string;
    orden: string;
    codigo_sat?: string;
    porcentaje: string;
    fecha_inicio: string;
}

interface Regimen {
    regimen?: string;
    regime?: string;
    codigo_sat?: string;
    code?: string;
    regime_code?: string;
    fecha_inicio: string;
    fecha_fin?: string;
}

interface Obligacion {
    descripcion_obligacion: string;
    descripcion_vencimiento: string;
    fecha_inicio: string;
    fecha_fin?: string;
}

interface N8NData {
    identificacion: Identificacion;
    domicilio?: Domicilio;
    actividades_economicas?: ActividadEconomica[];
    regimenes?: Regimen[];
    obligaciones?: Obligacion[];
    tipo_contribuyente?: string;
}

interface ClerkTokenPayload {
    sub: string;
    [key: string]: unknown;
}

function parseSpanishDate(dateStr: string | null): string | null {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('/');
    if (parts.length === 3) {
        // Handle DD/MM/YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    // Handle "DD DE MES DE YYYY"
    const months: Record<string, string> = {
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

function decodeClerkToken(token: string): ClerkTokenPayload | null {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        // Decode base64url
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decoded) as ClerkTokenPayload;
    } catch {
        return null;
    }
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let currentFilePath = "";
    let userId: string | null = null;

    try {
        // --- Identificar al usuario llamante usando Clerk Token ---
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

        let n8nData: N8NData;
        const responseText = await n8nResponse.text();

        try {
            const parsed = JSON.parse(responseText);
            const firstItem = Array.isArray(parsed) ? parsed[0] : parsed;
            n8nData = (firstItem.json || firstItem) as N8NData;
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

        if (!rfc) {
            console.error("[CRITICAL] RFC no detectado.");
            throw new Error("RFC no detectado en el PDF extraído por n8n.");
        }

        // Parse Emission Date from n8n
        const rawEmissionDate = identificacion.fecha_emision || identificacion.fecha_emision_raw;
        const emissionDateStr = rawEmissionDate ? parseSpanishDate(rawEmissionDate) : null;
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
            if (existingOrg.csf_emission_date && emissionDateStr) {
                const existingDate = new Date(existingOrg.csf_emission_date);
                if (emissionDate < existingDate) {
                    throw new Error(`Operación cancelada: El documento cargado (emisión: ${emissionDateStr}) es más antiguo que el actual (${existingOrg.csf_emission_date}).`);
                }
            }
        }

        // 4. Prepare Update/Insert Payload
        const rawType = (n8nData.tipo_contribuyente || '').toUpperCase();
        const taxpayerType = rawType.includes('PERSONA_FISICA') || rawType.includes('PERSONA FISICA')
            ? 'PERSONA FÍSICA'
            : 'PERSONA MORAL';

        const updateData = {
            name: identificacion.denominacion_razon_social || identificacion.nombre_completo || rfc,
            first_name: identificacion.nombre,
            last_name_1: identificacion.primer_apellido,
            last_name_2: identificacion.segundo_apellido,
            rfc: rfc,
            curp: identificacion.curp,
            taxpayer_type: taxpayerType,
            cif_id: identificacion.id_cif,
            brand_name: identificacion.nombre_comercial,
            commercial_name: identificacion.nombre_comercial,
            capital_regime: identificacion.regimen_capital,
            operations_start_date: parseSpanishDate(identificacion.fecha_inicio_operaciones || null),
            tax_status: identificacion.estatus_padron,
            last_status_change_date: parseSpanishDate(identificacion.fecha_ultimo_cambio_estado || null),
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

        if (existingOrg) {
            const { error: updateError } = await supabaseClient.from('organizations').update(updateData).eq('id', finalOrgId);
            if (updateError) throw updateError;
        } else if (isCreatingNew || !finalOrgId) {
            const { data: newOrg, error: insertError } = await supabaseClient.from('organizations').insert({
                ...updateData,
                primary_color: '#6366f1'
            }).select().single();
            if (insertError) throw insertError;
            finalOrgId = (newOrg as { id: string }).id;
        } else {
            await supabaseClient.from('organizations').update(updateData).eq('id', finalOrgId);
        }

        // Archive this document in history
        await supabaseClient.from('organization_csf_history').insert({
            organization_id: finalOrgId,
            file_url: updateData.csf_file_url,
            emission_date: updateData.csf_emission_date,
            extracted_data: { rfc: updateData.rfc, name: updateData.name }
        });

        // Link User to Organization if not linked
        if (userId && finalOrgId) {
            const { data: existingAccess } = await supabaseClient
                .from('user_organization_access')
                .select('id')
                .eq('profile_id', userId)
                .eq('organization_id', finalOrgId)
                .maybeSingle();

            if (!existingAccess) {
                await supabaseClient.from('user_organization_access').insert({
                    profile_id: userId,
                    organization_id: finalOrgId,
                    can_manage_quotations: false,
                    can_manage_payments: true,
                    is_owner: true
                });

                const { data: profile } = await supabaseClient
                    .from('profiles')
                    .select('organization_id')
                    .eq('id', userId)
                    .single();

                if (!profile?.organization_id || isCreatingNew) {
                    await supabaseClient.from('profiles').update({ organization_id: finalOrgId }).eq('id', userId);
                }
            }
        }

        // 5. Granular Synchronization (Activities, Regimes, Obligations)
        if (actividades_economicas && actividades_economicas.length > 0) {
            await supabaseClient.from('organization_activities').delete().eq('organization_id', finalOrgId);

            const preparedActivities = actividades_economicas.map((a: ActividadEconomica) => {
                const cleanDesc = (a.actividad_economica || "")
                    .replace(/\u00A0/g, ' ')
                    .replace(/\s+/g, ' ')
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

            // Smart Mapping
            for (const act of preparedActivities) {
                if (!act.activity_code && act.description) {
                    const { data: catMatches } = await supabaseClient
                        .from('cat_economic_activities')
                        .select('code')
                        .ilike('name', act.description)
                        .order('code', { ascending: false });

                    if (catMatches && catMatches.length > 0) {
                        const bestMatch = (catMatches as { code: string }[]).reduce((acc, curr) =>
                            acc.code.length > curr.code.length ? acc : curr
                        );
                        act.activity_code = bestMatch.code;
                    }
                }
            }

            const { error: actError } = await supabaseClient.from('organization_activities').insert(preparedActivities);
            if (actError) console.error(`[FORENSIC] Error en actividades: ${actError.message}`);
        }

        if (regimenes && regimenes.length > 0) {
            await supabaseClient.from('organization_regimes').delete().eq('organization_id', finalOrgId);

            const regimesData = await Promise.all(regimenes.map(async (r: Regimen) => {
                const rawName = r.regimen || r.regime || "";
                let code = r.codigo_sat || r.code || r.regime_code;

                if (!code && rawName) {
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
                    end_date: parseSpanishDate(r.fecha_fin || null)
                };
            }));

            const { error: regError } = await supabaseClient.from('organization_regimes').insert(regimesData);
            if (regError) console.error(`[FORENSIC] Error en regímenes: ${regError.message}`);
        }

        if (obligaciones && obligaciones.length > 0) {
            await supabaseClient.from('organization_obligations').delete().eq('organization_id', finalOrgId);
            const obligationsData = obligaciones.map((o: Obligacion) => ({
                organization_id: finalOrgId,
                description: o.descripcion_obligacion,
                due_date_description: o.descripcion_vencimiento,
                start_date: parseSpanishDate(o.fecha_inicio),
                end_date: parseSpanishDate(o.fecha_fin || null)
            }));
            const { error: oblError } = await supabaseClient.from('organization_obligations').insert(obligationsData);
            if (oblError) console.error(`[FORENSIC] Error en obligaciones: ${oblError.message}`);
        }

        // 6. Log Success
        await supabaseClient.from('edge_function_logs').insert({
            function_name: 'process-csf',
            event_type: 'GRANULAR_SYNC_V32_TS_SUCCESS',
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
        console.error("[FORENSIC ERROR] Proceso fallido:", (error as Error).message);
        return new Response(
            JSON.stringify({ success: false, error: (error as Error).message }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
