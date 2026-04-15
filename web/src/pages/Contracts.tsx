import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    FileSignature,
    Clock,
    CheckCircle2,
    XCircle,
    Eye,
    Upload,
    FileEdit,
    FileText,
    ExternalLink,
    Trash2,
    FileCheck,
    Shield
} from 'lucide-react';
import { GlowCard } from '../components/ui/GlowCard';
import { TextGlitch } from '../components/ui/TextGlitch';

type LifecycleStatus = 'requerido' | 'autorizado' | 'rubricado' | 'legalizado';
type TabFilter = 'TODOS' | 'REQUERIDO' | 'AUTORIZADO' | 'RUBRICADO' | 'LEGALIZADO';

interface ContractsProps {
    selectedOrg: any;
}

const Contracts = ({ selectedOrg }: ContractsProps) => {
    const { id: quotationId } = useParams();
    const navigate = useNavigate();
    const [contracts, setContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabFilter>('TODOS');

    // Modal states
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedContract, setSelectedContract] = useState<any>(null);
    const [uploading, setUploading] = useState(false);

    // Proformas vinculadas al contrato
    const [linkedQuotations, setLinkedQuotations] = useState<any[]>([]);
    const [availableQuotations, setAvailableQuotations] = useState<any[]>([]);
    const [showLinkModal, setShowLinkModal] = useState(false);

    // File inputs for each stage
    const [files, setFiles] = useState<{
        requerido: File | null;
        rubricado: File | null;
        legalizado: File | null;
    }>({ requerido: null, rubricado: null, legalizado: null });

    // Comments for each stage
    const [comments, setComments] = useState({
        requerido: '',
        rubricado: '',
        legalizado: ''
    });

    // Authorization toggle for stage R
    const [requeridoAuthorized, setRequeridoAuthorized] = useState(false);

    const fetchContracts = async () => {
        if (!selectedOrg?.id) return;
        try {
            setLoading(true);
            const { data: rawData, error } = await supabase
                .from('quotations')
                .select(`
                    id, proforma_number, contract_status, amount_total, created_at, is_contract_required,
                    organizations!inner(id, name, rfc),
                    contracts(*)
                `)
                .eq('organization_id', selectedOrg.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const flattenedContracts: any[] = [];

            rawData?.forEach((q: any) => {
                const contractList = Array.isArray(q.contracts) ? q.contracts : (q.contracts ? [q.contracts] : []);

                if (contractList.length > 0) {
                    contractList.forEach((c: any) => {
                        flattenedContracts.push({
                            ...c,
                            organizations: q.organizations,
                            quotations: {
                                id: q.id,
                                proforma_number: q.proforma_number,
                                contract_status: q.contract_status,
                                amount_total: q.amount_total,
                                created_at: q.created_at,
                                is_contract_required: q.is_contract_required
                            }
                        });
                    });
                } else if (q.is_contract_required || q.contract_status === 'solicitado') {
                    flattenedContracts.push({
                        id: `pending-${q.id}`,
                        quotation_id: q.id,
                        status: 'SOLICITADO',
                        created_at: q.created_at,
                        organizations: q.organizations,
                        isPending: true,
                        quotations: {
                            id: q.id,
                            proforma_number: q.proforma_number,
                            contract_status: 'solicitado',
                            amount_total: q.amount_total,
                            created_at: q.created_at,
                            is_contract_required: q.is_contract_required
                        }
                    });
                }
            });

            if (quotationId) {
                setContracts(flattenedContracts.filter(c => c.quotation_id === quotationId));
            } else {
                setContracts(flattenedContracts);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Cargar proformas vinculadas a un contrato
    const loadLinkedQuotations = async (contractId: string) => {
        const { data } = await supabase
            .from('contract_quotations')
            .select('*, quotation:quotations(id, proforma_number, description, amount_total, client_name, created_at, organizations(rfc))')
            .eq('contract_id', contractId);
        setLinkedQuotations(data || []);
    };

    // Cargar proformas disponibles para vincular
    const loadAvailableQuotations = async (contractId: string) => {
        const { data: allQuotations } = await supabase
            .from('quotations')
            .select('id, proforma_number, description, amount_total, client_name, created_at, organizations(rfc)')
            .eq('organization_id', selectedOrg.id)
            .order('created_at', { ascending: false })
            .limit(50);

        const { data: alreadyLinked } = await supabase
            .from('contract_quotations')
            .select('quotation_id')
            .eq('contract_id', contractId);

        const linkedIds = new Set((alreadyLinked || []).map((l: any) => l.quotation_id));
        setAvailableQuotations((allQuotations || []).filter((q: any) => !linkedIds.has(q.id)));
    };

    const linkQuotation = async (contractId: string, quotationId: string) => {
        try {
            const { error } = await supabase.from('contract_quotations').insert({ contract_id: contractId, quotation_id: quotationId });
            if (error) throw error;
            // Sincronizar contract_status en la proforma vinculada
            const contract = contracts.find(c => c.id === contractId);
            if (contract?.lifecycle_status) {
                const statusMap: any = { requerido: 'solicitado', autorizado: 'firmado', rubricado: 'firmado', legalizado: 'completado' };
                await supabase.from('quotations').update({
                    is_contract_required: true,
                    contract_status: statusMap[contract.lifecycle_status] || 'solicitado'
                }).eq('id', quotationId);
            }
            await loadLinkedQuotations(contractId);
            await loadAvailableQuotations(contractId);
            fetchContracts();
        } catch (err: any) {
            alert('Error vinculando: ' + err.message);
        }
    };

    const unlinkQuotation = async (contractId: string, quotationId: string, linkId: string) => {
        if (!confirm('¿Desvincular esta proforma del contrato?')) return;
        try {
            await supabase.from('contract_quotations').delete().eq('id', linkId);
            await supabase.from('quotations').update({ contract_status: null }).eq('id', quotationId);
            await loadLinkedQuotations(contractId);
            fetchContracts();
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    // Folio helper
    const buildFolio = (q: any) => {
        if (!q) return '';
        const rfc = q.organizations?.rfc?.match(/^[A-Z&]{3,4}/)?.[0] || 'PF';
        const d = q.created_at ? new Date(q.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '') : '';
        return `${rfc}-${d}-${(q.proforma_number || 1).toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (selectedOrg?.id) {
            fetchContracts();
        }
    }, [quotationId, selectedOrg]);

    const computeLifecycleStatus = (contract: any, authorized: boolean): LifecycleStatus => {
        if (contract.legalizado_url || files.legalizado) return 'legalizado';
        if (contract.rubricado_url || files.rubricado) return 'rubricado';
        if (authorized) return 'autorizado';
        return 'requerido';
    };

    const mapToQuotationStatus = (lifecycle: LifecycleStatus): string => {
        switch (lifecycle) {
            case 'requerido': return 'solicitado';
            case 'autorizado':
            case 'rubricado': return 'firmado';
            case 'legalizado': return 'completado';
        }
    };

    const handleUpload = async () => {
        if (!selectedContract) return;

        const noFileChanges = !files.requerido && !files.rubricado && !files.legalizado;
        const noCommentChanges =
            comments.requerido === (selectedContract.requerido_comments || '') &&
            comments.rubricado === (selectedContract.rubricado_comments || '') &&
            comments.legalizado === (selectedContract.legalizado_comments || '') &&
            requeridoAuthorized === (selectedContract.requerido_authorized || false);

        if (noFileChanges && noCommentChanges) return;

        try {
            setUploading(true);
            const updates: any = {};
            let currentContractId = selectedContract.id;

            // If pending, create contract record first
            if (selectedContract.isPending) {
                const { data: insertedData, error: insertError } = await supabase
                    .from('contracts')
                    .insert({
                        organization_id: selectedContract.organizations.id,
                        quotation_id: selectedContract.quotation_id,
                        lifecycle_status: 'requerido'
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;
                currentContractId = insertedData.id;
            }

            // Upload requerido file
            if (files.requerido) {
                const fileName = `${currentContractId}/requerido_${Date.now()}.pdf`;
                const { data: pData, error: pError } = await supabase.storage
                    .from('contracts')
                    .upload(fileName, files.requerido);
                if (pError) throw pError;
                updates.requerido_url = pData.path;
                updates.requerido_at = new Date().toISOString();
                // Also store in legacy file_url for compatibility
                updates.file_url = pData.path;
                // Calculate SHA-256
                const hashBuffer = await crypto.subtle.digest('SHA-256', await files.requerido.arrayBuffer());
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                updates.sha256_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            }

            // Upload rubricado file
            if (files.rubricado) {
                const fileName = `${currentContractId}/rubricado_${Date.now()}.pdf`;
                const { data: pData, error: pError } = await supabase.storage
                    .from('contracts')
                    .upload(fileName, files.rubricado);
                if (pError) throw pError;
                updates.rubricado_url = pData.path;
                updates.rubricado_at = new Date().toISOString();
            }

            // Upload legalizado file
            if (files.legalizado) {
                const fileName = `${currentContractId}/legalizado_${Date.now()}.pdf`;
                const { data: pData, error: pError } = await supabase.storage
                    .from('contracts')
                    .upload(fileName, files.legalizado);
                if (pError) throw pError;
                updates.legalizado_url = pData.path;
                updates.legalizado_at = new Date().toISOString();
            }

            // Comments
            if (comments.requerido !== (selectedContract.requerido_comments || ''))
                updates.requerido_comments = comments.requerido;
            if (comments.rubricado !== (selectedContract.rubricado_comments || ''))
                updates.rubricado_comments = comments.rubricado;
            if (comments.legalizado !== (selectedContract.legalizado_comments || ''))
                updates.legalizado_comments = comments.legalizado;

            // Authorization
            if (requeridoAuthorized !== (selectedContract.requerido_authorized || false)) {
                updates.requerido_authorized = requeridoAuthorized;
                if (requeridoAuthorized) {
                    updates.requerido_authorized_at = new Date().toISOString();
                } else {
                    updates.requerido_authorized_at = null;
                }
            }

            // Compute lifecycle_status
            const merged = { ...selectedContract, ...updates };
            const newLifecycle = computeLifecycleStatus(merged, updates.requerido_authorized ?? selectedContract.requerido_authorized ?? false);
            updates.lifecycle_status = newLifecycle;

            if (Object.keys(updates).length > 0) {
                const { error: uError } = await supabase
                    .from('contracts')
                    .update(updates)
                    .eq('id', currentContractId);
                if (uError) throw uError;
            }

            // Sync quotation status
            const qStatus = mapToQuotationStatus(updates.lifecycle_status || 'requerido');
            await supabase
                .from('quotations')
                .update({ contract_status: qStatus })
                .eq('id', selectedContract.quotation_id);

            alert('Contrato actualizado con exito.');
            setShowUploadModal(false);
            resetModalState();
            fetchContracts();
        } catch (err: any) {
            alert('Error al procesar contrato: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteFile = async (stage: 'requerido_url' | 'rubricado_url' | 'legalizado_url') => {
        if (!confirm('¿Seguro que deseas eliminar este archivo? Tendras que subir uno nuevo.')) return;

        try {
            setUploading(true);
            const updates: any = {};
            updates[stage] = null;

            // Clear the corresponding date
            const dateField = stage.replace('_url', '_at');
            updates[dateField] = null;

            // If deleting requerido, also clear authorization
            if (stage === 'requerido_url') {
                updates.requerido_authorized = false;
                updates.requerido_authorized_at = null;
                updates.file_url = null;
                updates.sha256_hash = null;
            }

            // Recalculate lifecycle status
            const merged = { ...selectedContract, ...updates };
            const newAuth = stage === 'requerido_url' ? false : (selectedContract.requerido_authorized || false);
            const newLifecycle = computeLifecycleStatus(merged, newAuth);
            updates.lifecycle_status = newLifecycle;

            const { error } = await supabase
                .from('contracts')
                .update(updates)
                .eq('id', selectedContract.id);

            if (error) throw error;

            // Sync quotation
            const qStatus = mapToQuotationStatus(newLifecycle);
            await supabase
                .from('quotations')
                .update({ contract_status: qStatus })
                .eq('id', selectedContract.quotation_id);

            alert('Archivo eliminado correctamente.');
            setSelectedContract({ ...selectedContract, ...updates });
            fetchContracts();
        } catch (err: any) {
            alert('Error al eliminar el archivo: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleViewFile = async (filePath: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('contracts')
                .createSignedUrl(filePath, 3600);
            if (error) throw error;
            if (data?.signedUrl) {
                window.open(data.signedUrl, '_blank');
            }
        } catch (err: any) {
            alert('Error al abrir archivo: ' + err.message);
        }
    };

    const openModal = (contract: any) => {
        setSelectedContract(contract);
        setComments({
            requerido: contract.requerido_comments || '',
            rubricado: contract.rubricado_comments || '',
            legalizado: contract.legalizado_comments || ''
        });
        setRequeridoAuthorized(contract.requerido_authorized || false);
        setFiles({ requerido: null, rubricado: null, legalizado: null });
        setShowUploadModal(true);
        // Cargar proformas vinculadas si es un contrato real (no pending)
        if (!contract.isPending && contract.id) {
            loadLinkedQuotations(contract.id);
            loadAvailableQuotations(contract.id);
        }
    };

    const resetModalState = () => {
        setFiles({ requerido: null, rubricado: null, legalizado: null });
        setComments({ requerido: '', rubricado: '', legalizado: '' });
        setRequeridoAuthorized(false);
        setSelectedContract(null);
    };

    const getLifecycleStatus = (c: any): LifecycleStatus => {
        return (c.lifecycle_status as LifecycleStatus) || 'requerido';
    };

    const getStatusIcon = (status: LifecycleStatus) => {
        switch (status) {
            case 'requerido': return <Clock className="w-4 h-4 text-amber-500" />;
            case 'autorizado': return <Shield className="w-4 h-4 text-blue-500" />;
            case 'rubricado': return <FileSignature className="w-4 h-4 text-emerald-500" />;
            case 'legalizado': return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
        }
    };

    const getStatusColor = (status: LifecycleStatus) => {
        switch (status) {
            case 'requerido': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'autorizado': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'rubricado': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'legalizado': return 'bg-emerald-600/10 text-emerald-400 border-emerald-500/20';
        }
    };

    const getStatusLabel = (status: LifecycleStatus) => {
        switch (status) {
            case 'requerido': return 'REQUERIDO';
            case 'autorizado': return 'AUTORIZADO';
            case 'rubricado': return 'RUBRICADO';
            case 'legalizado': return 'LEGALIZADO';
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleDateString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const filteredContracts = contracts.filter(c => {
        if (activeTab === 'TODOS') return true;
        const status = getLifecycleStatus(c).toUpperCase();
        return status === activeTab;
    });

    return (
        <div className="fade-in space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <FileSignature className="text-white text-xl" />
                        </div>
                        <TextGlitch
                            text={quotationId ? 'Contratos de Proforma' : 'Gestion de Contratos'}
                            className="text-2xl font-black text-white tracking-tight"
                        />
                    </div>
                    <p className="text-slate-400 text-sm mt-1">
                        Ciclo de vida contractual: Requerido, Autorizado, Rubricado y Legalizado.
                    </p>
                </div>

                <div className="flex bg-slate-800/40 p-1 rounded-xl border border-white/5 flex-wrap">
                    {(['TODOS', 'REQUERIDO', 'AUTORIZADO', 'RUBRICADO', 'LEGALIZADO'] as TabFilter[]).map((tab) => (
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
                                        <td colSpan={6} className="px-6 py-4 h-16 bg-white/5" />
                                    </tr>
                                ))
                            ) : filteredContracts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">
                                        No se encontraron contratos registrados.
                                    </td>
                                </tr>
                            ) : filteredContracts.map((c: any) => {
                                const lifecycle = getLifecycleStatus(c);
                                return (
                                    <tr key={c.quotations.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => navigate(`/proformas/${c.quotation_id}`)}
                                                    className={`p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors flex-shrink-0 ${c.isPending ? 'opacity-50' : ''}`}
                                                    title={c.isPending ? 'Ir a Configurar Proforma' : 'Abrir Proforma Original'}
                                                >
                                                    <FileEdit className="w-4 h-4" />
                                                </button>
                                                <div>
                                                    <div className="font-bold text-white leading-tight font-mono text-sm max-w-[150px] truncate">
                                                        {(() => {
                                                            const orgPrefix = c.organizations?.rfc?.match(/^[A-Z&]{3,4}/)?.[0] || 'PF';
                                                            const dateStr = c.quotations?.created_at ? new Date(c.quotations.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '') : '000000';
                                                            const folNum = (c.quotations?.proforma_number || 1).toString().padStart(2, '0');
                                                            return `${orgPrefix}-${dateStr}-${folNum}`;
                                                        })()}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-tighter truncate max-w-[150px]">
                                                        {c.organizations?.name || 'Org Desconocida'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="font-bold text-slate-300">
                                                {c.quotations?.amount_total?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) || '$0.00'}
                                            </div>
                                        </td>
                                        {/* SEMAFORO: 3 circulos R, F, L */}
                                        <td className="px-6 py-4">
                                            <div className="flex gap-1.5 justify-center">
                                                <div
                                                    title={c.requerido_authorized ? 'Autorizado' : (c.requerido_url ? 'Documento Cargado' : 'Sin Documento')}
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${c.requerido_authorized
                                                        ? 'bg-blue-500 cursor-pointer hover:ring-2 hover:ring-white/30'
                                                        : c.requerido_url
                                                            ? 'bg-emerald-500 cursor-pointer hover:ring-2 hover:ring-white/30'
                                                            : 'bg-yellow-500 cursor-help'
                                                        }`}
                                                    onClick={() => c.requerido_url && handleViewFile(c.requerido_url)}
                                                >R</div>
                                                <div
                                                    title={c.rubricado_url ? 'Rubricado — Click para ver' : 'Sin Rubricar'}
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${c.rubricado_url
                                                        ? 'bg-emerald-500 cursor-pointer hover:ring-2 hover:ring-white/30'
                                                        : 'bg-yellow-500 cursor-help'
                                                        }`}
                                                    onClick={() => c.rubricado_url && handleViewFile(c.rubricado_url)}
                                                >F</div>
                                                <div
                                                    title={c.legalizado_url ? 'Legalizado — Click para ver' : 'Sin Legalizar'}
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${c.legalizado_url
                                                        ? 'bg-emerald-500 cursor-pointer hover:ring-2 hover:ring-white/30'
                                                        : 'bg-yellow-500 cursor-help'
                                                        }`}
                                                    onClick={() => c.legalizado_url && handleViewFile(c.legalizado_url)}
                                                >L</div>
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
                                                {new Date(c.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => navigate(`/proformas/${c.quotation_id}`)}
                                                    className="p-2 text-slate-400 hover:text-cyan-500 hover:bg-cyan-500/10 rounded-lg transition-all"
                                                    title="Ir a Proforma Maestra"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openModal(c)}
                                                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
                                                    title="Gestionar Contrato"
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

            {/* MODAL DE GESTION DE CONTRATO */}
            {showUploadModal && selectedContract && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <GlowCard className="w-full max-w-2xl p-0 overflow-hidden bg-slate-900 border-white/10 shadow-2xl shadow-cyan-500/10">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-cyan-600/10 to-transparent">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <FileSignature className="text-cyan-500 w-5 h-5" />
                                    Gestionar Contrato
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Sube documentos y gestiona el ciclo de vida del contrato.
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowUploadModal(false); resetModalState(); }}
                                className="text-slate-500 hover:text-white transition-colors text-2xl"
                            >&times;</button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            {/* SECCION 1: Requerido / Revision / Autorizado (R) */}
                            <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-amber-500" />
                                    1. Requerido / Revision / Autorizado
                                </h4>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archivo PDF/Word (Contrato)</label>
                                    {selectedContract?.requerido_url && !files.requerido ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                                    <FileCheck size={16} /> Archivo Cargado
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => handleViewFile(selectedContract.requerido_url)} className="text-cyan-400 hover:text-cyan-300 p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors" title="Ver Documento"><Eye size={16} /></button>
                                                    <button onClick={() => handleDeleteFile('requerido_url')} className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar Archivo"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                            {selectedContract.requerido_at && (
                                                <p className="text-[10px] text-slate-500">Subido: {formatDate(selectedContract.requerido_at)}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${files.requerido ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-cyan-500/30'}`}>
                                            <input
                                                type="file"
                                                accept=".pdf,.doc,.docx"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={(e) => setFiles(prev => ({ ...prev, requerido: e.target.files?.[0] || null }))}
                                            />
                                            <div className="text-center">
                                                {files.requerido ? (
                                                    <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                                                        <FileCheck size={16} /> {files.requerido.name}
                                                    </div>
                                                ) : (
                                                    <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                                                        <Upload size={20} className="text-slate-600" />
                                                        Sube el contrato en PDF o Word
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Comentarios Requerido */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comentarios</label>
                                    <textarea
                                        value={comments.requerido}
                                        onChange={(e) => setComments(prev => ({ ...prev, requerido: e.target.value }))}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors custom-scrollbar"
                                        placeholder="Observaciones sobre el contrato..."
                                        rows={2}
                                    />
                                </div>

                                {/* Boton Autorizar */}
                                <div className={`flex items-center gap-3 border p-3 rounded-xl cursor-pointer transition-colors ${requeridoAuthorized ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-900 border-white/5 hover:bg-slate-800'}`}
                                    onClick={() => setRequeridoAuthorized(!requeridoAuthorized)}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${requeridoAuthorized ? 'bg-blue-500 border-blue-500 text-white' : 'border-white/20 text-transparent'}`}>
                                        <Shield className="w-3.5 h-3.5" />
                                    </div>
                                    <span className={`text-sm font-medium ${requeridoAuthorized ? 'text-blue-400' : 'text-slate-300'}`}>Autorizado para Firmas</span>
                                </div>
                                {selectedContract.requerido_authorized_at && requeridoAuthorized && (
                                    <p className="text-[10px] text-blue-400/70">Autorizado: {formatDate(selectedContract.requerido_authorized_at)}</p>
                                )}
                            </div>

                            {/* SECCION 2: Rubricado / Firmado (F) */}
                            <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                    <FileSignature className="w-4 h-4 text-emerald-500" />
                                    2. Rubricado / Firmado
                                </h4>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archivo PDF (Contrato Rubricado)</label>
                                    {selectedContract?.rubricado_url && !files.rubricado ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                                    <FileCheck size={16} /> Archivo Cargado
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => handleViewFile(selectedContract.rubricado_url)} className="text-cyan-400 hover:text-cyan-300 p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors" title="Ver Documento"><Eye size={16} /></button>
                                                    <button onClick={() => handleDeleteFile('rubricado_url')} className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar Archivo"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                            {selectedContract.rubricado_at && (
                                                <p className="text-[10px] text-slate-500">Subido: {formatDate(selectedContract.rubricado_at)}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${files.rubricado ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-cyan-500/30'}`}>
                                            <input
                                                type="file"
                                                accept=".pdf,.doc,.docx"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={(e) => setFiles(prev => ({ ...prev, rubricado: e.target.files?.[0] || null }))}
                                            />
                                            <div className="text-center">
                                                {files.rubricado ? (
                                                    <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                                                        <FileCheck size={16} /> {files.rubricado.name}
                                                    </div>
                                                ) : (
                                                    <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                                                        <Upload size={20} className="text-slate-600" />
                                                        Sube el contrato rubricado/firmado
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Comentarios Rubricado */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comentarios</label>
                                    <textarea
                                        value={comments.rubricado}
                                        onChange={(e) => setComments(prev => ({ ...prev, rubricado: e.target.value }))}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors custom-scrollbar"
                                        placeholder="Observaciones sobre el rubricado..."
                                        rows={2}
                                    />
                                </div>
                            </div>

                            {/* SECCION 3: Legalizado (L) */}
                            <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    3. Legalizado
                                </h4>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archivo PDF (Contrato Legalizado)</label>
                                    {selectedContract?.legalizado_url && !files.legalizado ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                                    <FileCheck size={16} /> Archivo Cargado
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => handleViewFile(selectedContract.legalizado_url)} className="text-cyan-400 hover:text-cyan-300 p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors" title="Ver Documento"><Eye size={16} /></button>
                                                    <button onClick={() => handleDeleteFile('legalizado_url')} className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar Archivo"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                            {selectedContract.legalizado_at && (
                                                <p className="text-[10px] text-slate-500">Subido: {formatDate(selectedContract.legalizado_at)}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${files.legalizado ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-cyan-500/30'}`}>
                                            <input
                                                type="file"
                                                accept=".pdf,.doc,.docx"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={(e) => setFiles(prev => ({ ...prev, legalizado: e.target.files?.[0] || null }))}
                                            />
                                            <div className="text-center">
                                                {files.legalizado ? (
                                                    <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                                                        <FileCheck size={16} /> {files.legalizado.name}
                                                    </div>
                                                ) : (
                                                    <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                                                        <Upload size={20} className="text-slate-600" />
                                                        Sube el contrato legalizado/final
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Comentarios Legalizado */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comentarios</label>
                                    <textarea
                                        value={comments.legalizado}
                                        onChange={(e) => setComments(prev => ({ ...prev, legalizado: e.target.value }))}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors custom-scrollbar"
                                        placeholder="Observaciones sobre la legalizacion..."
                                        rows={2}
                                    />
                                </div>
                            </div>

                            {/* PROFORMAS VINCULADAS */}
                            {!selectedContract?.isPending && (
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-amber-500" />
                                            Proformas Vinculadas ({linkedQuotations.length})
                                        </h4>
                                        <button
                                            onClick={() => { loadAvailableQuotations(selectedContract.id); setShowLinkModal(true); }}
                                            className="px-2 py-1 text-[10px] font-bold uppercase bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 rounded-lg flex items-center gap-1"
                                        >
                                            <FileEdit size={10} /> Vincular
                                        </button>
                                    </div>

                                    {/* Proforma principal */}
                                    {selectedContract?.quotations?.id && (
                                        <div className="flex items-center justify-between py-2 px-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/20 px-1.5 py-0.5 rounded">PRINCIPAL</span>
                                                <a href={`/proformas/${selectedContract.quotations.id}`} target="_blank" rel="noreferrer"
                                                    className="text-xs font-mono text-cyan-400 hover:underline">
                                                    {buildFolio(selectedContract.quotations)}
                                                </a>
                                                <span className="text-xs text-slate-400 truncate max-w-[150px]">{selectedContract.quotations.client_name || ''}</span>
                                            </div>
                                            <span className="text-xs font-bold text-white">
                                                ${new Intl.NumberFormat('es-MX').format(selectedContract.quotations.amount_total || 0)}
                                            </span>
                                        </div>
                                    )}

                                    {/* Proformas vinculadas */}
                                    {linkedQuotations.map((lq: any) => (
                                        <div key={lq.id} className="flex items-center justify-between py-2 px-3 bg-slate-700/30 rounded-lg mb-1">
                                            <div className="flex items-center gap-2">
                                                <a href={`/proformas/${lq.quotation?.id}`} target="_blank" rel="noreferrer"
                                                    className="text-xs font-mono text-amber-400 hover:underline">
                                                    {buildFolio(lq.quotation)}
                                                </a>
                                                <span className="text-xs text-slate-400 truncate max-w-[150px]">{lq.quotation?.client_name || ''}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-white">
                                                    ${new Intl.NumberFormat('es-MX').format(lq.quotation?.amount_total || 0)}
                                                </span>
                                                <button onClick={() => unlinkQuotation(selectedContract.id, lq.quotation?.id, lq.id)}
                                                    className="p-1 text-slate-500 hover:text-red-400 transition-colors" title="Desvincular">
                                                    <XCircle size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {linkedQuotations.length === 0 && (
                                        <p className="text-xs text-slate-500 text-center py-2">Sin proformas adicionales vinculadas</p>
                                    )}
                                </div>
                            )}

                            {/* MODAL VINCULAR PROFORMA */}
                            {showLinkModal && (
                                <div className="bg-slate-800 border border-amber-500/20 rounded-xl p-4 mt-2">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-bold text-amber-400">Vincular Proforma</h4>
                                        <button onClick={() => setShowLinkModal(false)} className="text-slate-400 hover:text-white"><XCircle size={16} /></button>
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                                        {availableQuotations.length === 0 && <p className="text-xs text-slate-500 text-center py-2">No hay proformas disponibles</p>}
                                        {availableQuotations.map((q: any) => (
                                            <div key={q.id} className="flex items-center justify-between py-2 px-3 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono text-cyan-400">{buildFolio(q)}</span>
                                                    <span className="text-xs text-slate-400 truncate max-w-[120px]">{q.client_name || q.description || ''}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-white">${new Intl.NumberFormat('es-MX').format(q.amount_total || 0)}</span>
                                                    <button onClick={() => { linkQuotation(selectedContract.id, q.id); }}
                                                        className="px-2 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/30">
                                                        Vincular
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

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
        </div>
    );
};

export default Contracts;
