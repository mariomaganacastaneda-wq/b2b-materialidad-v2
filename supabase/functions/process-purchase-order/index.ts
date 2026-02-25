import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// URL del webhook de n8n para OC (Pendiente crear flujo real en n8n)
const N8N_WEBHOOK_URL = "https://n8n-n8n.5gad6x.easypanel.host/webhook/process-po-pdf";

interface POItem {
  item_code?: string;
  description: string;
  quantity: number;
  unit_measure?: string;
  unit_price: number;
  total_amount: number;
}

interface N8NPOData {
  po_number: string;
  emission_date?: string;
  issuer_rfc?: string;
  issuer_name?: string;
  currency?: string;
  subtotal?: number;
  tax_total?: number;
  grand_total?: number;
  items?: POItem[];
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let currentFilePath = "";

  try {
    const body = await req.json();
    currentFilePath = body.filePath;
    const { clientOrgId } = body;

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

    let n8nData: N8NPOData;
    const responseText = await n8nResponse.text();

    try {
      const parsed = JSON.parse(responseText);
      const firstItem = Array.isArray(parsed) ? parsed[0] : parsed;
      n8nData = (firstItem.json || firstItem) as N8NPOData;
      console.log("Datos desempaquetados de n8n OC:", JSON.stringify(n8nData).substring(0, 200) + "...");
    } catch (e) {
      console.error("Respuesta de n8n no es JSON válido:", responseText.substring(0, 500));
      throw new Error(`n8n devolvió una respuesta no válida (no JSON).`);
    }

    if (!n8nData || !n8nData.po_number) {
      console.error("Estructura de n8n inválida para OC:", JSON.stringify(n8nData));
      throw new Error("n8n no retornó el campo po_number obligatorio.");
    }

    // 3. Buscar ORG emisora de la OC
    let issuerOrgId: string | null = null;
    if (n8nData.issuer_rfc) {
      const { data: issuerOrg } = await supabaseClient
        .from('organizations')
        .select('id')
        .eq('rfc', n8nData.issuer_rfc)
        .maybeSingle();

      if (issuerOrg) {
        issuerOrgId = (issuerOrg as { id: string }).id;
      } else if (n8nData.issuer_name) {
        const { data: issuerNameOrg } = await supabaseClient
          .from('organizations')
          .select('id')
          .ilike('name', `%${n8nData.issuer_name.split(' ')[0]}%`)
          .maybeSingle();

        if (issuerNameOrg) issuerOrgId = (issuerNameOrg as { id: string }).id;
      }
    }

    // 4. Crear Cabecera de Órdenes de Compra
    console.log(`[OC] Creando Cabecera para Folio: ${n8nData.po_number}`);
    const sourceUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/purchase_orders/${currentFilePath}`;

    const { data: poHeader, error: poHeaderError } = await supabaseClient
      .from('purchase_orders')
      .insert({
        po_number: n8nData.po_number,
        emission_date: n8nData.emission_date || new Date().toISOString().split('T')[0],
        issuer_org_id: issuerOrgId,
        client_org_id: clientOrgId,
        currency: n8nData.currency || 'MXN',
        subtotal: n8nData.subtotal || 0,
        tax_total: n8nData.tax_total || 0,
        grand_total: n8nData.grand_total || 0,
        status: 'PENDING_REVIEW',
        source_file_url: sourceUrl,
        raw_ocr_data: n8nData
      })
      .select()
      .single();

    if (poHeaderError) throw poHeaderError;
    const newPoId = (poHeader as { id: string }).id;

    // 5. Insertar Partidas Individuales
    if (n8nData.items && Array.isArray(n8nData.items)) {
      console.log(`[OC] Insertando ${n8nData.items.length} detalles para PO ID: ${newPoId}`);
      const itemsToInsert = n8nData.items.map((item: POItem) => ({
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
          po_number: n8nData.po_number
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[OC ERROR] Proceso de órden de compra fallido:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
