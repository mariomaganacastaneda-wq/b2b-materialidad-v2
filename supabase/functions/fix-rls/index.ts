import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
        const q1 = await supabaseAdmin.storage.createBucket('invoices', { public: true });

        // We can't run raw SQL from the edge function either unless we use postgres driver directly,
        // which requires connection string. 
        // What about we just update the specific invoices via admin key from an edge function/script
        // No, the issue is that the user's browser needs to upload the files.
        // The bucket RLS needs to be fixed.

        return new Response(JSON.stringify({ msg: "To fix RLS, we require raw SQL execution.", q1 }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
