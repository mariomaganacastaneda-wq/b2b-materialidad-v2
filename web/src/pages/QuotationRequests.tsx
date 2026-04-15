import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    FileText,
    Clock,
    CheckCircle2,
    XCircle,
    Eye,
    Upload,
    Send,
    FileEdit,
    ExternalLink,
    Trash2,
    FileCheck,
    Shield,
    Sparkles,
    Loader2
} from 'lucide-react';
import { GlowCard } from '../components/ui/GlowCard';
import { TextGlitch } from '../components/ui/TextGlitch';

type QuotationLifecycle = 'solicitud' | 'enviada' | 'aceptada' | 'completada';
type TabFilter = 'TODAS' | 'SOLICITUD' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA';
type StageKey = 'solicitud' | 'revision_emisor' | 'revision_cliente';

interface QuotationRequestsProps {
    selectedOrg: any;
    userProfile?: any;
}

const QuotationRequests = ({ selectedOrg, userProfile }: QuotationRequestsProps) => {
    const { id: quotationId } = useParams();
    const navigate = useNavigate();
    const [quotes, setQuotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabFilter>('TODAS');

    // Modal states
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState<any>(null);
    const [uploading, setUploading] = useState(false);

    // Non-blocking notification (replaces alert() to avoid React DOM errors)
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const notify = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), type === 'error' ? 6000 : 3000);
    };

    // IA Generation modal
    const [showGenerateModal, setShowGenerateModal] = useState<'solicitud' | 'emision' | null>(null);
    const [generating, setGenerating] = useState(false);
    const [generateForm, setGenerateForm] = useState({
        fechaEmision: new Date().toISOString().split('T')[0],
        vigencia: '30' as string,
        incluyeIVA: true,
        lugarEntrega: '',
        formaPago: 'transferencia' as string,
        condicionesCredito: 'sin_credito' as string,
        observaciones: '',
        firmanteComercial: '',
        firmanteVentas: '',
        firmanteCliente: '',
        formato: 'ambos' as 'ambos' | 'word' | 'html',
    });

    // Ref para evitar stale closure del formato en handleGenerateIA
    const formatoRef = useRef(generateForm.formato);
    formatoRef.current = generateForm.formato;

    const N8N_WEBHOOK_SOLICITUD = 'https://n8n-n8n.5gad6x.easypanel.host/webhook/generar-cotizacion';
    const N8N_WEBHOOK_EMISION = 'https://n8n-n8n.5gad6x.easypanel.host/webhook/generar-emision-cotizacion';

    // Precargar datos de la solicitud previa para el modal de emisión
    const openGenerateModal = async (tipo: 'solicitud' | 'emision') => {
        if (tipo === 'emision' && selectedQuote?.solicitud_url) {
            try {
                const filePath = selectedQuote.solicitud_url;
                if (filePath.endsWith('.html') || filePath.endsWith('.doc')) {
                    const { data: fileData } = await supabase.storage
                        .from('quotations')
                        .download(filePath);
                    if (fileData) {
                        const text = await fileData.text();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(text, 'text/html');
                        const bodyText = doc.body?.textContent || '';

                        // Extraer datos del documento de solicitud
                        const vigenciaMatch = bodyText.match(/Vigencia:\s*(\d+)/i);
                        const lugarMatch = bodyText.match(/Lugar de entrega:\s*([^\n]+)/i);
                        const pagoMatch = bodyText.match(/Forma de pago:\s*([^\n]+)/i);
                        const creditoMatch = bodyText.match(/Condiciones de cr[eé]dito:\s*([^\n]+)/i);

                        // Extraer nombre del firmante del HTML de la solicitud
                        let firmanteSolicitud = '';
                        // Método 1: buscar en elementos con clase .firma
                        const firmaElements = doc.querySelectorAll('.firma');
                        for (const firma of firmaElements) {
                            const rolText = firma.textContent || '';
                            if (rolText.includes('Comercial') || rolText.includes('comercial')) {
                                const strong = firma.querySelector('strong');
                                if (strong) firmanteSolicitud = strong.textContent?.trim() || '';
                                break;
                            }
                        }
                        // Método 2: fallback con regex si no encontró por DOM
                        if (!firmanteSolicitud) {
                            const allStrongs = doc.querySelectorAll('strong');
                            for (let i = 0; i < allStrongs.length; i++) {
                                const next = allStrongs[i].parentElement?.nextElementSibling;
                                if (next?.textContent?.includes('Comercial') || next?.textContent?.includes('comercial')) {
                                    firmanteSolicitud = allStrongs[i].textContent?.trim() || '';
                                    break;
                                }
                            }
                        }
                        // Método 3: regex sobre texto plano
                        if (!firmanteSolicitud) {
                            const match = bodyText.match(/([A-Za-záéíóúñÁÉÍÓÚÑ\s]+?)\s*[AÁa]rea\s*Comercial/i);
                            if (match?.[1]) firmanteSolicitud = match[1].trim();
                        }

                        setGenerateForm(prev => ({
                            ...prev,
                            fechaEmision: new Date().toISOString().split('T')[0],
                            vigencia: vigenciaMatch?.[1] || prev.vigencia,
                            lugarEntrega: lugarMatch?.[1]?.trim() || prev.lugarEntrega,
                            formaPago: pagoMatch?.[1]?.trim().toLowerCase().includes('transfer') ? 'transferencia'
                                : pagoMatch?.[1]?.trim().toLowerCase().includes('cheque') ? 'cheque'
                                : pagoMatch?.[1]?.trim().toLowerCase().includes('efect') ? 'efectivo'
                                : prev.formaPago,
                            condicionesCredito: creditoMatch?.[1]?.trim().toLowerCase().includes('sin') ? 'sin_credito'
                                : creditoMatch?.[1]?.match(/(\d+)/)?.[1] || prev.condicionesCredito,
                            firmanteComercial: firmanteSolicitud || prev.firmanteComercial,
                            firmanteCliente: firmanteSolicitud || '',
                        }));
                    }
                }
            } catch (err) {
                console.warn('[IA-GEN] No se pudieron precargar datos de solicitud:', err);
            }
        } else {
            // Reset para nueva generación
            setGenerateForm({
                fechaEmision: new Date().toISOString().split('T')[0],
                vigencia: '30',
                incluyeIVA: true,
                lugarEntrega: '',
                formaPago: 'transferencia',
                condicionesCredito: 'sin_credito',
                observaciones: '',
                firmanteComercial: '',
                firmanteVentas: '',
                firmanteCliente: '',
                formato: 'ambos',
            });
        }
        setShowGenerateModal(tipo);
    };

    const handleGenerateIA = async () => {
        if (!selectedQuote || !showGenerateModal) return;
        setGenerating(true);
        try {
            // Cargar items de la proforma
            const { data: items } = await supabase
                .from('quotation_items')
                .select('*')
                .eq('quotation_id', selectedQuote.id)
                .order('created_at');

            // Cargar datos de la proforma
            const { data: proforma } = await supabase
                .from('quotations')
                .select('client_name, client_rfc, amount_subtotal, amount_iva, amount_total, currency, description, organization_id')
                .eq('id', selectedQuote.id)
                .single();

            if (!proforma) throw new Error('No se encontró la proforma');

            // Escanear solicitud previa si estamos generando emisión
            let contextoSolicitud = '';
            if (showGenerateModal === 'emision' && selectedQuote.solicitud_url) {
                try {
                    const filePath = selectedQuote.solicitud_url;
                    if (filePath.endsWith('.html') || filePath.endsWith('.doc')) {
                        const { data: fileData } = await supabase.storage
                            .from('quotations')
                            .download(filePath);
                        if (fileData) {
                            const text = await fileData.text();
                            // Extraer texto limpio del HTML
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(text, 'text/html');
                            contextoSolicitud = doc.body?.textContent?.trim() || '';
                        }
                    } else if (filePath.endsWith('.pdf') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.png')) {
                        // Para PDFs/imágenes: descargar y convertir a base64 para enviar a OpenAI Vision
                        const { data: fileData } = await supabase.storage
                            .from('quotations')
                            .download(filePath);
                        if (fileData) {
                            const buffer = await fileData.arrayBuffer();
                            const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
                            const mime = filePath.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
                            contextoSolicitud = `[ARCHIVO_BASE64:${mime}]${base64}`;
                        }
                    }
                    console.log('[IA-GEN] Contexto de solicitud extraído:', contextoSolicitud.substring(0, 200) + '...');
                } catch (err) {
                    console.warn('[IA-GEN] No se pudo leer solicitud previa:', err);
                }
            }

            // Obtener branding del cliente por RFC
            const { data: clientOrg } = await supabase
                .from('organizations')
                .select('name, rfc, logo_url, primary_color, brand_name, theme_config')
                .eq('rfc', proforma.client_rfc)
                .maybeSingle();

            // Obtener branding de la emisora
            const { data: emisoraOrg } = await supabase
                .from('organizations')
                .select('name, rfc, logo_url, primary_color, brand_name, theme_config')
                .eq('id', proforma.organization_id)
                .single();

            const brandingPrincipal = showGenerateModal === 'solicitud'
                ? {
                    nombre: clientOrg?.brand_name || clientOrg?.name || proforma.client_name,
                    rfc: clientOrg?.rfc || proforma.client_rfc,
                    logo_url: clientOrg?.logo_url || '',
                    primary_color: clientOrg?.primary_color || '#1e40af',
                    secondary_color: clientOrg?.theme_config?.secondary_color || '#64748b',
                    accent_color: clientOrg?.theme_config?.accent_color || '#f59e0b',
                    slogan: clientOrg?.theme_config?.slogan || '',
                }
                : {
                    nombre: emisoraOrg?.brand_name || emisoraOrg?.name || '',
                    rfc: emisoraOrg?.rfc || '',
                    logo_url: emisoraOrg?.logo_url || '',
                    primary_color: emisoraOrg?.primary_color || '#1e40af',
                    secondary_color: emisoraOrg?.theme_config?.secondary_color || '#64748b',
                    accent_color: emisoraOrg?.theme_config?.accent_color || '#f59e0b',
                    slogan: emisoraOrg?.theme_config?.slogan || '',
                };

            const payload = {
                tipo: showGenerateModal,
                quotation_id: selectedQuote.id,
                proforma: {
                    folio: selectedQuote.folio || selectedQuote.id.substring(0, 8),
                    items: (items || []).map((i: any) => ({
                        code: i.sat_product_key || '',
                        description: i.description,
                        quantity: parseFloat(i.quantity),
                        unit: i.unit_id || 'E48',
                        unitPrice: parseFloat(i.unit_price),
                        has_iva: i.has_iva ?? true,
                    })),
                    subtotal: parseFloat(proforma.amount_subtotal),
                    iva: parseFloat(proforma.amount_iva),
                    total: parseFloat(proforma.amount_total),
                    currency: proforma.currency || 'MXN',
                    client_name: proforma.client_name,
                    client_rfc: proforma.client_rfc,
                },
                campos_usuario: {
                    fecha_emision: generateForm.fechaEmision,
                    vigencia: generateForm.vigencia,
                    incluye_iva: generateForm.incluyeIVA,
                    lugar_entrega: generateForm.lugarEntrega,
                    forma_pago: generateForm.formaPago,
                    condiciones_credito: generateForm.condicionesCredito,
                    observaciones: generateForm.observaciones,
                    firmante_comercial: generateForm.firmanteComercial,
                    firmante_ventas: generateForm.firmanteVentas,
                    firmante_cliente: '',
                },
                branding_principal: brandingPrincipal,
                branding_contraparte: showGenerateModal === 'solicitud'
                    ? { nombre: emisoraOrg?.name || '', rfc: emisoraOrg?.rfc || '' }
                    : { nombre: proforma.client_name, rfc: proforma.client_rfc },
                contexto_solicitud: contextoSolicitud || '',
            };

            const webhookUrl = showGenerateModal === 'solicitud' ? N8N_WEBHOOK_SOLICITUD : N8N_WEBHOOK_EMISION;
            console.log('[IA-GEN] Enviando al webhook:', webhookUrl, '| tipo:', showGenerateModal);
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            console.log('[IA-GEN] Response status:', response.status, response.statusText);
            const rawText = await response.text();
            console.log('[IA-GEN] Response body (primeros 500 chars):', rawText.substring(0, 500));

            let result: any;
            try {
                result = JSON.parse(rawText);
            } catch {
                throw new Error('Respuesta no válida del servidor (status ' + response.status + '): ' + rawText.substring(0, 200));
            }

            if (!result.success && !result.html_content) {
                throw new Error(result.error || 'Error al generar documento');
            }

            // Guardar solo HTML en Supabase Storage
            if (result.html_content && selectedQuote) {
                const encoder = new TextEncoder();
                const ts = Date.now();
                const htmlBlob = new Blob([encoder.encode(result.html_content)], { type: 'text/html; charset=utf-8' });
                const htmlFileName = `${selectedQuote.id}/${showGenerateModal}_ia_${ts}.html`;

                const { error: uploadErr } = await supabase.storage
                    .from('quotations')
                    .upload(htmlFileName, htmlBlob, { upsert: true, contentType: 'text/html; charset=utf-8' });
                if (uploadErr) console.warn('Error subiendo HTML:', uploadErr.message);

                // Guardar referencia en la cotización
                const urlField = showGenerateModal === 'solicitud' ? 'solicitud_url' : 'revision_emisor_url';
                const atField = showGenerateModal === 'solicitud' ? 'solicitud_at' : 'revision_emisor_at';
                const updates: any = { [urlField]: htmlFileName, [atField]: new Date().toISOString() };

                const merged = { ...selectedQuote, ...updates };
                const newAuth = {
                    solicitud: merged.solicitud_authorized || false,
                    revision_emisor: merged.revision_emisor_authorized || false,
                    revision_cliente: merged.revision_cliente_authorized || false,
                };
                updates.quotation_lifecycle = computeLifecycle(merged, newAuth);
                updates.related_quotation_status = mapToLegacyStatus(updates.quotation_lifecycle);

                await supabase.from('quotations').update(updates).eq('id', selectedQuote.id);
            } else if (result.pdf_url) {
                window.open(result.pdf_url, '_blank');
            }

            setShowGenerateModal(null);
            setShowUploadModal(false);
            resetModalState();
            notify('success', `Documento de ${showGenerateModal === 'solicitud' ? 'Solicitud' : 'Emisión'} generado y guardado con IA.`);
            fetchQuotes();
        } catch (err: any) {
            notify('error', 'Error al generar con IA: ' + err.message);
        } finally {
            setGenerating(false);
        }
    };

    // File inputs for each stage
    const [files, setFiles] = useState<{
        solicitud: File | null;
        revision_emisor: File | null;
        revision_cliente: File | null;
    }>({ solicitud: null, revision_emisor: null, revision_cliente: null });

    // Comments for each stage
    const [comments, setComments] = useState({
        solicitud: '',
        revision_emisor: '',
        revision_cliente: ''
    });

    // Authorization toggles for each stage
    const [authorized, setAuthorized] = useState({
        solicitud: false,
        revision_emisor: false,
        revision_cliente: false
    });

    const fetchQuotes = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('quotations')
                .select(`
                    id, proforma_number, description, amount_total,
                    req_quotation, related_quotation_status, quotation_lifecycle,
                    created_at, request_file_url,
                    solicitud_url, solicitud_comments, solicitud_authorized, solicitud_at, solicitud_authorized_at,
                    revision_emisor_url, revision_emisor_comments, revision_emisor_authorized, revision_emisor_at, revision_emisor_authorized_at,
                    revision_cliente_url, revision_cliente_comments, revision_cliente_authorized, revision_cliente_at, revision_cliente_authorized_at,
                    organizations(name, rfc)
                `)
                .or('req_quotation.eq.true,related_quotation_status.eq.solicitada')
                .order('created_at', { ascending: false });

            if (quotationId) {
                query = query.eq('id', quotationId);
            }

            if (selectedOrg?.id) {
                query = query.eq('organization_id', selectedOrg.id);
            }
            if (userProfile?.view_mode === 'mine' && userProfile?.id) {
                query = query.eq('created_by', userProfile.id);
            }

            const { data, error: fetchError } = await query;
            if (fetchError) throw fetchError;
            setQuotes(data || []);
        } catch (err: any) {
            console.error('Error fetching quotes:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedOrg?.id) {
            fetchQuotes();
        }
    }, [quotationId, selectedOrg]);

    const computeLifecycle = (quote: any, auth: { solicitud: boolean; revision_emisor: boolean; revision_cliente: boolean }): QuotationLifecycle => {
        const allAuthorized = auth.solicitud && auth.revision_emisor && auth.revision_cliente;
        const anyAuthorized = auth.solicitud || auth.revision_emisor || auth.revision_cliente;
        const anyFile = quote.solicitud_url || quote.revision_emisor_url || quote.revision_cliente_url ||
            files.solicitud || files.revision_emisor || files.revision_cliente;

        if (allAuthorized) return 'completada';
        if (anyAuthorized) return 'aceptada';
        if (anyFile) return 'enviada';
        return 'solicitud';
    };

    const mapToLegacyStatus = (lifecycle: QuotationLifecycle): string => {
        switch (lifecycle) {
            case 'solicitud': return 'solicitada';
            case 'enviada': return 'enviada';
            case 'aceptada': return 'aceptada';
            case 'completada': return 'completada';
        }
    };

    const handleUpload = async () => {
        if (!selectedQuote) return;

        const noFileChanges = !files.solicitud && !files.revision_emisor && !files.revision_cliente;
        const noCommentChanges =
            comments.solicitud === (selectedQuote.solicitud_comments || '') &&
            comments.revision_emisor === (selectedQuote.revision_emisor_comments || '') &&
            comments.revision_cliente === (selectedQuote.revision_cliente_comments || '') &&
            authorized.solicitud === (selectedQuote.solicitud_authorized || false) &&
            authorized.revision_emisor === (selectedQuote.revision_emisor_authorized || false) &&
            authorized.revision_cliente === (selectedQuote.revision_cliente_authorized || false);

        if (noFileChanges && noCommentChanges) return;

        try {
            setUploading(true);
            const updates: any = {};

            // Upload solicitud file
            if (files.solicitud) {
                const fileName = `${selectedQuote.id}/solicitud_${Date.now()}.pdf`;
                const { data: pData, error: pError } = await supabase.storage
                    .from('quotations')
                    .upload(fileName, files.solicitud);
                if (pError) throw pError;
                updates.solicitud_url = pData.path;
                updates.solicitud_at = new Date().toISOString();
                updates.request_file_url = pData.path; // Legacy compatibility
            }

            // Upload revision emisor file
            if (files.revision_emisor) {
                const fileName = `${selectedQuote.id}/revision_emisor_${Date.now()}.pdf`;
                const { data: pData, error: pError } = await supabase.storage
                    .from('quotations')
                    .upload(fileName, files.revision_emisor);
                if (pError) throw pError;
                updates.revision_emisor_url = pData.path;
                updates.revision_emisor_at = new Date().toISOString();
            }

            // Upload revision cliente file
            if (files.revision_cliente) {
                const fileName = `${selectedQuote.id}/revision_cliente_${Date.now()}.pdf`;
                const { data: pData, error: pError } = await supabase.storage
                    .from('quotations')
                    .upload(fileName, files.revision_cliente);
                if (pError) throw pError;
                updates.revision_cliente_url = pData.path;
                updates.revision_cliente_at = new Date().toISOString();
            }

            // Comments
            if (comments.solicitud !== (selectedQuote.solicitud_comments || ''))
                updates.solicitud_comments = comments.solicitud;
            if (comments.revision_emisor !== (selectedQuote.revision_emisor_comments || ''))
                updates.revision_emisor_comments = comments.revision_emisor;
            if (comments.revision_cliente !== (selectedQuote.revision_cliente_comments || ''))
                updates.revision_cliente_comments = comments.revision_cliente;

            // Authorization
            if (authorized.solicitud !== (selectedQuote.solicitud_authorized || false)) {
                updates.solicitud_authorized = authorized.solicitud;
                updates.solicitud_authorized_at = authorized.solicitud ? new Date().toISOString() : null;
            }
            if (authorized.revision_emisor !== (selectedQuote.revision_emisor_authorized || false)) {
                updates.revision_emisor_authorized = authorized.revision_emisor;
                updates.revision_emisor_authorized_at = authorized.revision_emisor ? new Date().toISOString() : null;
            }
            if (authorized.revision_cliente !== (selectedQuote.revision_cliente_authorized || false)) {
                updates.revision_cliente_authorized = authorized.revision_cliente;
                updates.revision_cliente_authorized_at = authorized.revision_cliente ? new Date().toISOString() : null;
            }

            // Compute lifecycle
            const merged = { ...selectedQuote, ...updates };
            const newAuth = {
                solicitud: updates.solicitud_authorized ?? selectedQuote.solicitud_authorized ?? false,
                revision_emisor: updates.revision_emisor_authorized ?? selectedQuote.revision_emisor_authorized ?? false,
                revision_cliente: updates.revision_cliente_authorized ?? selectedQuote.revision_cliente_authorized ?? false
            };
            const newLifecycle = computeLifecycle(merged, newAuth);
            updates.quotation_lifecycle = newLifecycle;
            updates.related_quotation_status = mapToLegacyStatus(newLifecycle);

            if (Object.keys(updates).length > 0) {
                const { error: uError } = await supabase
                    .from('quotations')
                    .update(updates)
                    .eq('id', selectedQuote.id);
                if (uError) throw uError;
            }

            setShowUploadModal(false);
            resetModalState();
            fetchQuotes();
            notify('success', 'Cotizacion actualizada con exito.');
        } catch (err: any) {
            notify('error', 'Error al procesar cotizacion: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteFile = async (stage: StageKey) => {
        if (!confirm('¿Seguro que deseas eliminar este archivo? Tendras que subir uno nuevo.')) return;

        try {
            setUploading(true);
            const urlField = `${stage}_url`;
            const atField = `${stage}_at`;
            const authField = `${stage}_authorized`;
            const authAtField = `${stage}_authorized_at`;

            const updates: any = {
                [urlField]: null,
                [atField]: null,
                [authField]: false,
                [authAtField]: null
            };

            // If deleting solicitud, also clear legacy field
            if (stage === 'solicitud') {
                updates.request_file_url = null;
            }

            // Recalculate lifecycle
            const merged = { ...selectedQuote, ...updates };
            const newAuth = {
                solicitud: stage === 'solicitud' ? false : (selectedQuote.solicitud_authorized || false),
                revision_emisor: stage === 'revision_emisor' ? false : (selectedQuote.revision_emisor_authorized || false),
                revision_cliente: stage === 'revision_cliente' ? false : (selectedQuote.revision_cliente_authorized || false)
            };
            const newLifecycle = computeLifecycle(merged, newAuth);
            updates.quotation_lifecycle = newLifecycle;
            updates.related_quotation_status = mapToLegacyStatus(newLifecycle);

            const { error } = await supabase
                .from('quotations')
                .update(updates)
                .eq('id', selectedQuote.id);

            if (error) throw error;

            notify('success', 'Archivo eliminado correctamente.');
            setSelectedQuote({ ...selectedQuote, ...updates });
            // Update local authorized state
            setAuthorized(prev => ({ ...prev, [stage]: false }));
            fetchQuotes();
        } catch (err: any) {
            notify('error', 'Error al eliminar el archivo: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleViewFile = async (filePath: string) => {
        try {
            // Archivos HTML generados por IA: abrir en nueva pestaña
            if (filePath.endsWith('.html') || filePath.endsWith('.doc')) {
                const { data: fileData, error: dlErr } = await supabase.storage
                    .from('quotations')
                    .download(filePath);
                if (dlErr) throw dlErr;
                if (fileData) {
                    const url = URL.createObjectURL(new Blob([fileData], { type: 'text/html; charset=utf-8' }));
                    window.open(url, '_blank');
                    return;
                }
            }
            // PDFs y otros archivos: usar URL firmada
            const { data, error } = await supabase.storage
                .from('quotations')
                .createSignedUrl(filePath, 3600);
            if (error) throw error;
            if (data?.signedUrl) {
                window.open(data.signedUrl, '_blank');
            }
        } catch (err: any) {
            notify('error', 'Error al abrir archivo: ' + err.message);
        }
    };

    const handleOpenAsWord = async (filePath: string) => {
        try {
            const { data: fileData, error } = await supabase.storage
                .from('quotations')
                .download(filePath);
            if (error) throw error;
            if (!fileData) throw new Error('Archivo vacío');

            const htmlText = await fileData.text();
            const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
${htmlText.match(/<style[\s\S]*?<\/style>/)?.[0] || ''}
</head><body>${htmlText.match(/<body[\s\S]*?>([\s\S]*)<\/body>/)?.[1] || htmlText}</body></html>`;

            const blob = new Blob([new TextEncoder().encode(wordHtml)], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filePath.split('/').pop()?.replace('.html', '.doc') || 'cotizacion.doc';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err: any) {
            notify('error', 'Error al convertir a Word: ' + err.message);
        }
    };

    const openModal = (quote: any) => {
        setSelectedQuote(quote);
        setComments({
            solicitud: quote.solicitud_comments || '',
            revision_emisor: quote.revision_emisor_comments || '',
            revision_cliente: quote.revision_cliente_comments || ''
        });
        setAuthorized({
            solicitud: quote.solicitud_authorized || false,
            revision_emisor: quote.revision_emisor_authorized || false,
            revision_cliente: quote.revision_cliente_authorized || false
        });
        setFiles({ solicitud: null, revision_emisor: null, revision_cliente: null });
        setShowUploadModal(true);
    };

    const resetModalState = () => {
        setFiles({ solicitud: null, revision_emisor: null, revision_cliente: null });
        setComments({ solicitud: '', revision_emisor: '', revision_cliente: '' });
        setAuthorized({ solicitud: false, revision_emisor: false, revision_cliente: false });
        setSelectedQuote(null);
    };

    const getLifecycle = (q: any): QuotationLifecycle => {
        return (q.quotation_lifecycle as QuotationLifecycle) || 'solicitud';
    };

    const getStatusIcon = (status: QuotationLifecycle) => {
        switch (status) {
            case 'solicitud': return <Clock className="w-4 h-4 text-amber-500" />;
            case 'enviada': return <Send className="w-4 h-4 text-cyan-500" />;
            case 'aceptada': return <Shield className="w-4 h-4 text-blue-500" />;
            case 'completada': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
        }
    };

    const getStatusColor = (status: QuotationLifecycle) => {
        switch (status) {
            case 'solicitud': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'enviada': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
            case 'aceptada': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'completada': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
        }
    };

    const getStatusLabel = (status: QuotationLifecycle) => {
        switch (status) {
            case 'solicitud': return 'SOLICITUD';
            case 'enviada': return 'ENVIADA';
            case 'aceptada': return 'ACEPTADA';
            case 'completada': return 'COMPLETADA';
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleDateString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const filteredQuotes = quotes.filter(q => {
        if (activeTab === 'TODAS') return true;
        const lifecycle = getLifecycle(q);
        switch (activeTab) {
            case 'SOLICITUD': return lifecycle === 'solicitud';
            case 'ENVIADA': return lifecycle === 'enviada';
            case 'ACEPTADA': return lifecycle === 'aceptada' || lifecycle === 'completada';
            case 'RECHAZADA': return q.related_quotation_status === 'rechazada';
            default: return true;
        }
    });

    return (
        <div className="fade-in space-y-6">
            {/* Non-blocking notification banner */}
            {notification && (
                <div className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-xl shadow-2xl border font-bold text-sm flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${notification.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-300' : 'bg-red-900/90 border-red-500/40 text-red-300'}`}>
                    {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {notification.message}
                    <button onClick={() => setNotification(null)} className="ml-2 opacity-60 hover:opacity-100">&times;</button>
                </div>
            )}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <FileText className="text-white text-xl" />
                        </div>
                        <TextGlitch
                            text={quotationId ? 'Documento de Cotizacion' : 'Gestion de Cotizaciones'}
                            className="text-2xl font-black text-white tracking-tight"
                        />
                    </div>
                    <p className="text-slate-400 text-sm mt-1">
                        Ciclo de vida: Solicitud Cliente, Revision Emisor y Revision Cliente.
                    </p>
                </div>

                <div className="flex bg-slate-800/40 p-1 rounded-xl border border-white/5 flex-wrap">
                    {(['TODAS', 'SOLICITUD', 'ENVIADA', 'ACEPTADA', 'RECHAZADA'] as TabFilter[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${activeTab === tab
                                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* LEYENDA DE COLORES */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 bg-slate-800/30 p-3 rounded-xl border border-white/5">
                <span className="font-bold text-slate-300">Estados de Archivo en Tabla:</span>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-500"></div> Sin documento</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Archivo cargado</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Autorizado</div>
                <div className="border-l border-white/10 h-4 mx-1"></div>
                <span className="font-bold text-slate-300">Tipos de documentos:</span>
                <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black flex items-center justify-center border border-emerald-500/40">S</span> Solicitud</div>
                <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-black flex items-center justify-center border border-cyan-500/40">E</span> Emitida</div>
                <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-black flex items-center justify-center border border-blue-500/40">C</span> Confirmada</div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3">
                    <XCircle className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            <GlowCard className="overflow-hidden p-0 bg-slate-900/40 border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/5">
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Folio P. / Org</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Descripcion</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Monto</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">Semaforo</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Estado</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Fecha</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-6 py-4 h-16 bg-white/5" />
                                    </tr>
                                ))
                            ) : filteredQuotes.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 italic">
                                        No se encontraron requerimientos de cotizacion formal.
                                    </td>
                                </tr>
                            ) : filteredQuotes.map((q: any) => {
                                const lifecycle = getLifecycle(q);
                                return (
                                    <tr key={q.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => navigate(`/proformas/${q.id}`)}
                                                    className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors flex-shrink-0"
                                                    title="Abrir Proforma Original"
                                                >
                                                    <FileEdit className="w-4 h-4" />
                                                </button>
                                                <div>
                                                    <div className="font-bold text-white leading-tight font-mono text-sm max-w-[150px] truncate">
                                                        {(() => {
                                                            const orgPrefix = q.organizations?.rfc?.match(/^[A-Z&]{3,4}/)?.[0] || 'PF';
                                                            const dateStr = q.created_at ? new Date(q.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '') : '000000';
                                                            const folNum = (q.proforma_number || 1).toString().padStart(2, '0');
                                                            return `${orgPrefix}-${dateStr}-${folNum}`;
                                                        })()}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-tighter truncate max-w-[150px]">
                                                        {q.organizations?.name || 'Org Desconocida'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-300 max-w-[200px] truncate">
                                                {q.description || 'Sin descripcion'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="font-bold text-slate-300">
                                                {q.amount_total?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) || '$0.00'}
                                            </div>
                                        </td>
                                        {/* SEMAFORO: 3 circulos S, E, C */}
                                        <td className="px-6 py-4">
                                            <div className="flex gap-1.5 justify-center">
                                                <div
                                                    title={q.solicitud_authorized ? 'Solicitud Autorizada' : (q.solicitud_url ? 'Documento Cargado' : 'Sin Documento')}
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${q.solicitud_authorized
                                                        ? 'bg-blue-500 cursor-pointer hover:ring-2 hover:ring-white/30'
                                                        : q.solicitud_url
                                                            ? 'bg-emerald-500 cursor-pointer hover:ring-2 hover:ring-white/30'
                                                            : 'bg-yellow-500 cursor-help'
                                                        }`}
                                                    onClick={() => q.solicitud_url && handleViewFile(q.solicitud_url)}
                                                >S</div>
                                                <div
                                                    title={q.revision_emisor_authorized ? 'Revision Emisor Autorizada' : (q.revision_emisor_url ? 'Documento Cargado' : 'Sin Documento')}
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${q.revision_emisor_authorized
                                                        ? 'bg-blue-500 cursor-pointer hover:ring-2 hover:ring-white/30'
                                                        : q.revision_emisor_url
                                                            ? 'bg-emerald-500 cursor-pointer hover:ring-2 hover:ring-white/30'
                                                            : 'bg-yellow-500 cursor-help'
                                                        }`}
                                                    onClick={() => q.revision_emisor_url && handleViewFile(q.revision_emisor_url)}
                                                >E</div>
                                                <div
                                                    title={q.revision_cliente_authorized ? 'Revision Cliente Autorizada' : (q.revision_cliente_url ? 'Documento Cargado' : 'Sin Documento')}
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${q.revision_cliente_authorized
                                                        ? 'bg-blue-500 cursor-pointer hover:ring-2 hover:ring-white/30'
                                                        : q.revision_cliente_url
                                                            ? 'bg-emerald-500 cursor-pointer hover:ring-2 hover:ring-white/30'
                                                            : 'bg-yellow-500 cursor-help'
                                                        }`}
                                                    onClick={() => q.revision_cliente_url && handleViewFile(q.revision_cliente_url)}
                                                >C</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getStatusColor(lifecycle)}`}>
                                                {getStatusIcon(lifecycle)}
                                                {getStatusLabel(lifecycle)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs text-slate-400">
                                                {new Date(q.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => navigate(`/proformas/${q.id}`)}
                                                    className="p-2 text-slate-400 hover:text-cyan-500 hover:bg-cyan-500/10 rounded-lg transition-all"
                                                    title="Ir a Proforma Maestra"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openModal(q)}
                                                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
                                                    title="Gestionar Cotizacion"
                                                >
                                                    <Upload className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </GlowCard>

            {/* MODAL DE GESTION DE COTIZACION */}
            {showUploadModal && selectedQuote && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <GlowCard className="w-full max-w-2xl p-0 overflow-hidden bg-slate-900 border-white/10 shadow-2xl shadow-cyan-500/10">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-cyan-600/10 to-transparent">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <FileText className="text-cyan-500 w-5 h-5" />
                                    Gestionar Cotizacion
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Sube documentos y gestiona el ciclo de vida de la cotizacion.
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowUploadModal(false); resetModalState(); }}
                                className="text-slate-500 hover:text-white transition-colors text-2xl"
                            >&times;</button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            {/* SECCION 1: Solicitud Cliente (S) */}
                            <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-amber-500" />
                                        1. Solicitud Cliente
                                    </h4>
                                    <button
                                        onClick={() => openGenerateModal('solicitud')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-violet-500/10 border border-violet-500/30 text-violet-400 hover:bg-violet-500/20 rounded-lg transition-all"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" /> Generar con IA
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archivo PDF/Imagen</label>
                                    {selectedQuote?.solicitud_url && !files.solicitud ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                                    <FileCheck size={16} /> Archivo Cargado
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => handleViewFile(selectedQuote.solicitud_url)} className="text-cyan-400 hover:text-cyan-300 p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors" title="Ver Documento"><Eye size={16} /></button>
                                                    {selectedQuote.solicitud_url?.endsWith('.html') && (
                                                        <button onClick={() => handleOpenAsWord(selectedQuote.solicitud_url)} className="text-blue-400 hover:text-blue-300 p-1.5 hover:bg-blue-500/10 rounded-lg transition-colors" title="Abrir en Word"><FileEdit size={16} /></button>
                                                    )}
                                                    <button onClick={() => handleDeleteFile('solicitud')} className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar Archivo"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                            {selectedQuote.solicitud_at && (
                                                <p className="text-[10px] text-slate-500">Subido: {formatDate(selectedQuote.solicitud_at)}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${files.solicitud ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-cyan-500/30'}`}>
                                            <input
                                                type="file"
                                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={(e) => setFiles(prev => ({ ...prev, solicitud: e.target.files?.[0] || null }))}
                                            />
                                            <div className="text-center">
                                                {files.solicitud ? (
                                                    <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                                                        <FileCheck size={16} /> {files.solicitud.name}
                                                    </div>
                                                ) : (
                                                    <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                                                        <Upload size={20} className="text-slate-600" />
                                                        Sube la solicitud del cliente
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comentarios</label>
                                    <textarea
                                        value={comments.solicitud}
                                        onChange={(e) => setComments(prev => ({ ...prev, solicitud: e.target.value }))}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors custom-scrollbar"
                                        placeholder="Observaciones sobre la solicitud..."
                                        rows={2}
                                    />
                                </div>
                                <div className={`flex items-center gap-3 border p-3 rounded-xl cursor-pointer transition-colors ${authorized.solicitud ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-900 border-white/5 hover:bg-slate-800'}`}
                                    onClick={() => setAuthorized(prev => ({ ...prev, solicitud: !prev.solicitud }))}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${authorized.solicitud ? 'bg-blue-500 border-blue-500 text-white' : 'border-white/20 text-transparent'}`}>
                                        <Shield className="w-3.5 h-3.5" />
                                    </div>
                                    <span className={`text-sm font-medium ${authorized.solicitud ? 'text-blue-400' : 'text-slate-300'}`}>Autorizado</span>
                                </div>
                                {selectedQuote.solicitud_authorized_at && authorized.solicitud && (
                                    <p className="text-[10px] text-blue-400/70">Autorizado: {formatDate(selectedQuote.solicitud_authorized_at)}</p>
                                )}
                            </div>

                            {/* SECCION 2: Revision Emisor (E) */}
                            <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Send className="w-4 h-4 text-cyan-500" />
                                        2. Revision Emisor
                                    </h4>
                                    <button
                                        onClick={() => openGenerateModal('emision')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-violet-500/10 border border-violet-500/30 text-violet-400 hover:bg-violet-500/20 rounded-lg transition-all"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" /> Generar con IA
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archivo PDF/Imagen</label>
                                    {selectedQuote?.revision_emisor_url && !files.revision_emisor ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                                    <FileCheck size={16} /> Archivo Cargado
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => handleViewFile(selectedQuote.revision_emisor_url)} className="text-cyan-400 hover:text-cyan-300 p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors" title="Ver Documento"><Eye size={16} /></button>
                                                    {selectedQuote.revision_emisor_url?.endsWith('.html') && (
                                                        <button onClick={() => handleOpenAsWord(selectedQuote.revision_emisor_url)} className="text-blue-400 hover:text-blue-300 p-1.5 hover:bg-blue-500/10 rounded-lg transition-colors" title="Abrir en Word"><FileEdit size={16} /></button>
                                                    )}
                                                    <button onClick={() => handleDeleteFile('revision_emisor')} className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar Archivo"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                            {selectedQuote.revision_emisor_at && (
                                                <p className="text-[10px] text-slate-500">Subido: {formatDate(selectedQuote.revision_emisor_at)}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${files.revision_emisor ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-cyan-500/30'}`}>
                                            <input
                                                type="file"
                                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={(e) => setFiles(prev => ({ ...prev, revision_emisor: e.target.files?.[0] || null }))}
                                            />
                                            <div className="text-center">
                                                {files.revision_emisor ? (
                                                    <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                                                        <FileCheck size={16} /> {files.revision_emisor.name}
                                                    </div>
                                                ) : (
                                                    <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                                                        <Upload size={20} className="text-slate-600" />
                                                        Sube la revision del emisor
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comentarios</label>
                                    <textarea
                                        value={comments.revision_emisor}
                                        onChange={(e) => setComments(prev => ({ ...prev, revision_emisor: e.target.value }))}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors custom-scrollbar"
                                        placeholder="Observaciones sobre la revision del emisor..."
                                        rows={2}
                                    />
                                </div>
                                <div className={`flex items-center gap-3 border p-3 rounded-xl cursor-pointer transition-colors ${authorized.revision_emisor ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-900 border-white/5 hover:bg-slate-800'}`}
                                    onClick={() => setAuthorized(prev => ({ ...prev, revision_emisor: !prev.revision_emisor }))}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${authorized.revision_emisor ? 'bg-blue-500 border-blue-500 text-white' : 'border-white/20 text-transparent'}`}>
                                        <Shield className="w-3.5 h-3.5" />
                                    </div>
                                    <span className={`text-sm font-medium ${authorized.revision_emisor ? 'text-blue-400' : 'text-slate-300'}`}>Autorizado</span>
                                </div>
                                {selectedQuote.revision_emisor_authorized_at && authorized.revision_emisor && (
                                    <p className="text-[10px] text-blue-400/70">Autorizado: {formatDate(selectedQuote.revision_emisor_authorized_at)}</p>
                                )}
                            </div>

                            {/* SECCION 3: Revision Cliente (C) */}
                            <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    3. Revision Cliente
                                </h4>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archivo PDF/Imagen</label>
                                    {selectedQuote?.revision_cliente_url && !files.revision_cliente ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                                    <FileCheck size={16} /> Archivo Cargado
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => handleViewFile(selectedQuote.revision_cliente_url)} className="text-cyan-400 hover:text-cyan-300 p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors" title="Ver Documento"><Eye size={16} /></button>
                                                    <button onClick={() => handleDeleteFile('revision_cliente')} className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar Archivo"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                            {selectedQuote.revision_cliente_at && (
                                                <p className="text-[10px] text-slate-500">Subido: {formatDate(selectedQuote.revision_cliente_at)}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${files.revision_cliente ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-cyan-500/30'}`}>
                                            <input
                                                type="file"
                                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={(e) => setFiles(prev => ({ ...prev, revision_cliente: e.target.files?.[0] || null }))}
                                            />
                                            <div className="text-center">
                                                {files.revision_cliente ? (
                                                    <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                                                        <FileCheck size={16} /> {files.revision_cliente.name}
                                                    </div>
                                                ) : (
                                                    <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                                                        <Upload size={20} className="text-slate-600" />
                                                        Sube la revision del cliente
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comentarios</label>
                                    <textarea
                                        value={comments.revision_cliente}
                                        onChange={(e) => setComments(prev => ({ ...prev, revision_cliente: e.target.value }))}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors custom-scrollbar"
                                        placeholder="Observaciones sobre la revision del cliente..."
                                        rows={2}
                                    />
                                </div>
                                <div className={`flex items-center gap-3 border p-3 rounded-xl cursor-pointer transition-colors ${authorized.revision_cliente ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-900 border-white/5 hover:bg-slate-800'}`}
                                    onClick={() => setAuthorized(prev => ({ ...prev, revision_cliente: !prev.revision_cliente }))}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${authorized.revision_cliente ? 'bg-blue-500 border-blue-500 text-white' : 'border-white/20 text-transparent'}`}>
                                        <Shield className="w-3.5 h-3.5" />
                                    </div>
                                    <span className={`text-sm font-medium ${authorized.revision_cliente ? 'text-blue-400' : 'text-slate-300'}`}>Autorizado</span>
                                </div>
                                {selectedQuote.revision_cliente_authorized_at && authorized.revision_cliente && (
                                    <p className="text-[10px] text-blue-400/70">Autorizado: {formatDate(selectedQuote.revision_cliente_authorized_at)}</p>
                                )}
                            </div>

                            {/* BOTONES DE ACCION */}
                            <div className="flex gap-3 pt-4 border-t border-white/5">
                                <button
                                    onClick={() => { setShowUploadModal(false); resetModalState(); }}
                                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={uploading}
                                    onClick={handleUpload}
                                    className={`flex-1 px-4 py-2.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg ${uploading
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-cyan-500/20'
                                        }`}
                                >
                                    {uploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={16} />
                                            Guardar Cambios
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </GlowCard>
                </div>
            )}
            {/* MODAL DE GENERACIÓN CON IA */}
            {showGenerateModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-lg bg-slate-900 border border-violet-500/20 rounded-2xl shadow-2xl shadow-violet-500/10 overflow-hidden">
                        <div className="p-5 border-b border-white/5 bg-gradient-to-r from-violet-600/10 to-transparent flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Sparkles className="text-violet-400 w-5 h-5" />
                                    Generar {showGenerateModal === 'solicitud' ? 'Solicitud' : 'Emisión'} con IA
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-1">
                                    {showGenerateModal === 'solicitud'
                                        ? 'Documento del cliente solicitando cotización (sin precios)'
                                        : 'Respuesta de la emisora con precios y condiciones'}
                                </p>
                            </div>
                            <button onClick={() => setShowGenerateModal(null)} className="text-slate-500 hover:text-white text-2xl">&times;</button>
                        </div>
                        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Fecha de Emisión</label>
                                    <input type="date" value={generateForm.fechaEmision}
                                        onChange={e => setGenerateForm(p => ({ ...p, fechaEmision: e.target.value }))}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Vigencia</label>
                                    <select value={generateForm.vigencia}
                                        onChange={e => setGenerateForm(p => ({ ...p, vigencia: e.target.value }))}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                                        <option value="5_habiles">5 días hábiles</option>
                                        <option value="30">30 días</option>
                                        <option value="60">60 días</option>
                                        <option value="90">90 días</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Forma de Pago</label>
                                    <select value={generateForm.formaPago}
                                        onChange={e => setGenerateForm(p => ({ ...p, formaPago: e.target.value }))}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                                        <option value="transferencia">Transferencia</option>
                                        <option value="cheque">Cheque</option>
                                        <option value="efectivo">Efectivo</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Condiciones de Crédito</label>
                                    <select value={generateForm.condicionesCredito}
                                        onChange={e => setGenerateForm(p => ({ ...p, condicionesCredito: e.target.value }))}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                                        <option value="sin_credito">Sin crédito</option>
                                        <option value="30">30 días</option>
                                        <option value="60">60 días</option>
                                        <option value="90">90 días</option>
                                        <option value="120">120 días</option>
                                        <option value="180">180 días</option>
                                    </select>
                                </div>
                            </div>
                            <div className={`flex items-center gap-3 border p-3 rounded-xl cursor-pointer transition-colors ${generateForm.incluyeIVA ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800 border-white/10'}`}
                                onClick={() => setGenerateForm(p => ({ ...p, incluyeIVA: !p.incluyeIVA }))}>
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${generateForm.incluyeIVA ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/20'}`}>
                                    {generateForm.incluyeIVA && <CheckCircle2 className="w-3.5 h-3.5" />}
                                </div>
                                <span className={`text-sm font-medium ${generateForm.incluyeIVA ? 'text-emerald-400' : 'text-slate-400'}`}>Incluye IVA (16%)</span>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Lugar de Entrega / Servicio</label>
                                <input type="text" value={generateForm.lugarEntrega}
                                    onChange={e => setGenerateForm(p => ({ ...p, lugarEntrega: e.target.value }))}
                                    placeholder="Ej: Oficinas del cliente, Planta Guadalajara..."
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Observaciones</label>
                                <textarea value={generateForm.observaciones}
                                    onChange={e => setGenerateForm(p => ({ ...p, observaciones: e.target.value }))}
                                    placeholder="Notas adicionales para el documento..."
                                    rows={2}
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                            </div>
                            <div className="border-t border-white/5 pt-4">
                                <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-3">Firmas del Documento</p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                                            {showGenerateModal === 'solicitud' ? 'Firmante — Área Comercial' : 'Firmante — Área Ventas'}
                                        </label>
                                        <input type="text"
                                            value={showGenerateModal === 'solicitud' ? generateForm.firmanteComercial : generateForm.firmanteVentas}
                                            onChange={e => setGenerateForm(p => ({
                                                ...p,
                                                ...(showGenerateModal === 'solicitud'
                                                    ? { firmanteComercial: e.target.value }
                                                    : { firmanteVentas: e.target.value })
                                            }))}
                                            placeholder="Nombre completo del firmante"
                                            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                                    </div>
                                    {showGenerateModal === 'emision' && (
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Responsable Comercial Emisor (Autoriza)</label>
                                            <input type="text" value={generateForm.firmanteComercial}
                                                onChange={e => setGenerateForm(p => ({ ...p, firmanteComercial: e.target.value }))}
                                                placeholder="Nombre del responsable comercial que autoriza"
                                                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="p-5 border-t border-white/5 flex gap-3">
                            <button onClick={() => setShowGenerateModal(null)}
                                className="flex-1 px-4 py-2.5 font-bold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleGenerateIA} disabled={generating}
                                className="flex-1 px-4 py-2.5 font-bold rounded-xl bg-violet-600 text-white hover:bg-violet-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-violet-500/20">
                                {generating ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
                                ) : (
                                    <><Sparkles className="w-4 h-4" /> Generar PDF con IA</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuotationRequests;
