import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req: Request) => {
    try {
        const body = await req.json();
        const { proformaId, email, customMessage } = body;

        if (!email) {
            return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400 });
        }

        // 2. Enviar via Resend
        if (RESEND_API_KEY) {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                    from: 'B2B Materialidad <noreply@materialidad.mx>',
                    to: [email],
                    subject: `Proforma de Servicios - B2B Materialidad`,
                    html: `
            <h1>Nueva Proforma de Servicios</h1>
            <p>Hola,</p>
            <p>Se ha generado una nueva proforma para sus servicios.</p>
            <p>${customMessage || 'Adjunto encontrará el detalle de la misma.'}</p>
            <hr />
            <p>Atentamente,<br />Equipo de B2B Materialidad</p>
          `,
                }),
            });
            const data = await res.json();
            return new Response(JSON.stringify(data), { status: 200 });
        }

        return new Response(JSON.stringify({ message: 'Email logic simulated correctly (API Key missing)' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return new Response(JSON.stringify({ error: message }), { status: 500 });
    }
});
