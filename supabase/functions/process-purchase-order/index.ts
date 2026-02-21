import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// URL del webhook de n8n para OC (Pendiente crear flujo real en n8n)
const N8N_WEBHOOK_URL = "https://n8n-n8n.5gad6x.easypanel.host/webhook/process-po-pdf";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let currentFilePath = "";

  try {
    const body = await req.json();
    currentFilePath = body.filePath;
    const { clientOrgId } = body; // El B2B que sube la Orden de Compra

    if (!currentFilePath || !clientOrgId) {
      throw new Error("filePath o clientOrgId no proporcionados");
    }

    // 1. Download PDF from Storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage.from('purchase_orders').download(currentFilePath);
    if (downloadError) throw new Error(`Error de descarga del PDF de Storage: ${downloadError.message}`);

    // 2. Call n8n Webhook
    console.log(`Enviando ${currentFilePath} a n8n para extracción granular de OC...`);
    const formData = new FormData();
    const blob = new Blob([await fileData.arrayBuffer()], { type: 'application/pdf' });
    formData.append('data', blob, currentFilePath);

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
      const firstItem = Array.isArray(parsed) ? parsed[0] : parsed;
      n8nData = firstItem.json || firstItem;
      console.log("Datos desempaquetados de n8n OC:", JSON.stringify(n8nData).substring(0, 200) + "...");
    } catch (e) {
      console.error("Respuesta de n8n no es JSON válido:", responseText.substring(0, 500));
      throw new Error(`n8n devolvió una respuesta no válida (no JSON).`);
    }

    // Estructura esperada de n8nData
    // {
    //   "po_number": "8241019376",
    //   "emission_date": "2024-03-14",
    //   "issuer_rfc": "GOO000...",
    //   "issuer_name": "Goodyear",
    //   "currency": "MXN",
    //   "subtotal": 1000,
    //   "tax_total": 160,
    //   "grand_total": 1160,
    //   "items": [
    //      { "description": "Llantas", "quantity": 10, "unit_price": 100, "total_amount": 1000 }
    //   ]
    // }

    if (!n8nData || !n8nData.po_number) {
      console.error("Estructura de n8n inválida para OC:", JSON.stringify(n8nData));
      throw new Error("n8n no retornó el campo po_number obligatorio.");
    }

    const rawData = n8nData;

    // 3. Buscar ORG emisora de la OC (Para saber quién te la manda)
    let issuerOrgId = null;
    if (rawData.issuer_rfc) {
      const { data: issuerOrg } = await supabaseClient
        .from('organizations')
        .select('id')
        .eq('rfc', rawData.issuer_rfc)
        .maybeSingle();

      if (issuerOrg) {
        issuerOrgId = issuerOrg.id;
      } else if (rawData.issuer_name) {
        const { data: issuerNameOrg } = await supabaseClient
          .from('organizations')
          .select('id')
          .ilike('name', `%${rawData.issuer_name.split(' ')[0]}%`)
          .maybeSingle();

        if (issuerNameOrg) issuerOrgId = issuerNameOrg.id;
      }
    }

    // 4. Crear Cabecera de Órdenes de Compra
    console.log(`[OC] Creando Cabecera para Folio: ${rawData.po_number}`);
    const sourceUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/purchase_orders/${currentFilePath}`;

    const { data: poHeader, error: poHeaderError } = await supabaseClient
      .from('purchase_orders')
      .insert({
        po_number: rawData.po_number,
        emission_date: rawData.emission_date || new Date().toISOString().split('T')[0],
        issuer_org_id: issuerOrgId,
        client_org_id: clientOrgId, // Tu B2B actual
        currency: rawData.currency || 'MXN',
        subtotal: rawData.subtotal || 0,
        tax_total: rawData.tax_total || 0,
        grand_total: rawData.grand_total || 0,
        status: 'PENDING_REVIEW', // Siempre cae en revisión
        source_file_url: sourceUrl,
        raw_ocr_data: rawData
      })
      .select()
      .single();

    if (poHeaderError) throw poHeaderError;
    const newPoId = poHeader.id;

    // 5. Insertar Partidas Individuales
    if (rawData.items && Array.isArray(rawData.items)) {
      console.log(`[OC] Imprimiendo ${rawData.items.length} detalles para PO ID: ${newPoId}`);
      const itemsToInsert = rawData.items.map((item: any) => ({
        purchase_order_id: newPoId,
        item_code: item.item_code || null,
        description: item.description || "Sin descripción",
        quantity: item.quantity || 1,
        unit_measure: item.unit_measure || 'EA',
        unit_price: item.unit_price || 0,
        total_amount: item.total_amount || 0
      }));

      const { error: itemsError } = await supabaseClient
        .from('purchase_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          po_id: newPoId,
          po_number: rawData.po_number
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("[OC ERROR] Proceso de órden de compra fallido:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
