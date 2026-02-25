import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

interface InvoiceNotification {
    type: 'INSERT' | 'UPDATE';
    record: any;
    old_record?: any;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
        const { record, old_record, type }: InvoiceNotification = await req.json();
        const status = record.status;
        const oldStatus = old_record?.status;

        console.log(`[NOTIFY] Invoice ${record.id} status: ${status} (was: ${oldStatus})`);

        // Solo notificar si el estado cambió o es nuevo
        if (type === 'UPDATE' && status === oldStatus) {
            return new Response(JSON.stringify({ message: 'No status change' }), { headers: corsHeaders });
        }

        // 1. Obtener detalles de la organización y el emisor para el mensaje
        const { data: invoiceDetail } = await supabaseClient
            .from('invoices')
            .select('*, organization:organization_id(name)')
            .eq('id', record.id)
            .single();

        let targetProfiles: any[] = [];
        let messageTitle = "";
        let messageBody = "";

        // 2. Definir quién recibe qué según el estado
        if (status === 'SOLICITUD') {
            messageTitle = "🚀 Nueva Solicitud de Factura";
            messageBody = `Se ha solicitado una factura para la organización ${invoiceDetail.organization.name}.\nTotal: $${record.amount_total.toLocaleString()}\nFolio Interno: ${record.internal_number || 'Pendiente'}`;

            // Notificar a administradores y facturación de la organización emisora
            const { data: admins } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('organization_id', record.organization_id)
                .in('role', ['ADMIN', 'FACTURACION']);
            targetProfiles = admins || [];
        }
        else if (status === 'PREFACTURA_PENDIENTE') {
            messageTitle = "📋 Prefactura Lista para Revisión";
            messageBody = `La prefactura de ${invoiceDetail.organization.name} ha sido cargada y está pendiente de su validación.\nFolio: ${record.internal_number}`;

            // Notificar al vendedor o admins
            const { data: recipients } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('organization_id', record.organization_id)
                .in('role', ['ADMIN', 'VENDEDOR']);
            targetProfiles = recipients || [];
        }
        else if (status === 'VALIDADA') {
            messageTitle = "✅ Prefactura Validada";
            messageBody = `La prefactura ${record.internal_number} ha sido validada. Se puede proceder con el timbrado formal.`;

            const { data: billing } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('organization_id', record.organization_id)
                .in('role', ['ADMIN', 'FACTURACION']);
            targetProfiles = billing || [];
        }

        // 3. Enviar notificaciones
        for (const profile of targetProfiles) {
            const channels = profile.notification_prefered_channels || ['EMAIL'];

            // A. Telegram
            if (channels.includes('TELEGRAM') && profile.telegram_chat_id && TELEGRAM_BOT_TOKEN) {
                try {
                    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: profile.telegram_chat_id,
                            text: `*${messageTitle}*\n\n${messageBody}`,
                            parse_mode: 'Markdown'
                        })
                    });
                } catch (e) { console.error("Telegram Error:", e); }
            }

            // B. Email (Resend)
            if (channels.includes('EMAIL') && profile.email && RESEND_API_KEY) {
                try {
                    await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${RESEND_API_KEY}`,
                        },
                        body: JSON.stringify({
                            from: 'B2B Materialidad <noreply@materialidad.mx>',
                            to: [profile.email],
                            subject: messageTitle,
                            html: `
                                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                                    <h2 style="color: #2563eb;">${messageTitle}</h2>
                                    <p>${messageBody.replace(/\n/g, '<br>')}</p>
                                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                                    <p style="font-size: 12px; color: #666;">Este es un mensaje automático de B2B Materialidad.</p>
                                </div>
                            `
                        })
                    });
                } catch (e) { console.error("Email Error:", e); }
            }
        }

        return new Response(JSON.stringify({ success: true, notifiedCount: targetProfiles.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
