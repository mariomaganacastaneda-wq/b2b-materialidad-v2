
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ywovtkubsanalddsdedi.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_4TZm-phlmGg4Hu-IA_Weqg_IkhwANh1';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seedProformas() {
    console.log('Seeding test proformas...');

    // 1. Get an organization (Issuer) and a client
    const { data: orgs } = await supabase.from('organizations').select('id, name').eq('is_issuer', true).limit(1);
    const { data: clients } = await supabase.from('organizations').select('id, name').eq('is_client', true).limit(2);

    if (!orgs?.length || !clients?.length) {
        console.error('No organizations found to seed data.');
        return;
    }

    const orgId = orgs[0].id;
    const client1 = clients[0];
    const client2 = clients[1] || clients[0];

    // --- PROFORMA 1: PENDIENTE (Solo Proforma) ---
    const { data: q1 } = await supabase.from('quotations').insert({
        organization_id: orgId,
        description: 'Servicios de Consultoría TI - Fase 1',
        amount_total: 150000,
        status: 'PENDIENTE',
        is_contract_required: true,
        currency: 'MXN'
    }).select().single();

    // --- PROFORMA 2: ACEPTADA CON CONTRATO ---
    const { data: q2 } = await supabase.from('quotations').insert({
        organization_id: orgId,
        description: 'Mantenimiento de Infraestructura Eléctrica',
        amount_total: 85000,
        status: 'ACEPTADA',
        is_contract_required: true,
        currency: 'MXN'
    }).select().single();

    if (q2) {
        await supabase.from('contracts').insert({
            organization_id: orgId,
            quotation_id: q2.id,
            file_url: 'https://example.com/contract_85k.pdf',
            is_signed_representative: true,
            is_signed_vendor: true
        });
    }

    // --- PROFORMA 3: COMPLETA (CONTRATO + FACTURA + EVIDENCIA) ---
    const { data: q3 } = await supabase.from('quotations').insert({
        organization_id: orgId,
        description: 'Construcción de Nave Industrial - Etapa Cimentación',
        amount_total: 1250000,
        status: 'ACEPTADA',
        is_contract_required: true,
        currency: 'MXN'
    }).select().single();

    if (q3) {
        const { data: contract } = await supabase.from('contracts').insert({
            organization_id: orgId,
            quotation_id: q3.id,
            file_url: 'https://example.com/contract_construction.pdf',
            is_signed_representative: true,
            is_signed_vendor: true
        }).select().single();

        const { data: invoice } = await supabase.from('invoices').insert({
            organization_id: orgId,
            quotation_id: q3.id,
            contract_id: contract?.id,
            amount_total: 1250000,
            status: 'TIMBRADA',
            internal_number: 'INV-2026-001',
            rfc_emisor: 'HEV123456789', // Dummy
            rfc_receptor: 'CAT987654321' // Dummy
        }).select().single();

        if (invoice) {
            await supabase.from('evidence').insert({
                organization_id: orgId,
                invoice_id: invoice.id,
                type: 'FOTOGRAFIA',
                file_url: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80',
                metadata: { description: 'Foto de cimentación avanzada' }
            });
        }
    }

    console.log('Seeding complete!');
}

seedProformas();
