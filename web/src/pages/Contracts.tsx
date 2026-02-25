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
    FileText
} from 'lucide-react';

interface ContractsProps {
    selectedOrg: any;
}

const Contracts = ({ selectedOrg }: ContractsProps) => {
    const { id: quotationId } = useParams();
    const navigate = useNavigate();
    const [contracts, setContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'TODOS' | 'SOLICITADO' | 'FIRMADO' | 'COMPLETADO'>('TODOS');

    // Modal states
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedContract, setSelectedContract] = useState<any>(null);
    const [uploading, setUploading] = useState(false);
    const [files, setFiles] = useState<{ pdf: File | null }>({ pdf: null });

    const fetchContracts = async () => {
        if (!selectedOrg?.id) return;
        try {
            setLoading(true);
            const { data: rawData, error } = await supabase
                .from('quotations')
                .select(`
                    id, proforma_number, contract_status, amount_total, created_at, is_contract_required,
                    organizations!inner(name, rfc),
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

    useEffect(() => {
        if (selectedOrg?.id) {
            fetchContracts();
        }
    }, [quotationId, selectedOrg]);

    const handleUpload = async () => {
        if (!selectedContract || !files.pdf) return;

        try {
            setUploading(true);
            const fileName = `${selectedContract.id}/contrato_firmado_${Date.now()}.pdf`;
            const { data: pData, error: pError } = await supabase.storage
                .from('contracts')
                .upload(fileName, files.pdf);

            if (pError) throw pError;

            // Update Contract record
            const { error: uError } = await supabase
                .from('contracts')
                .update({ file_url: pData.path, is_signed_vendor: true }) // Assuming vendor upload
                .eq('id', selectedContract.id);

            if (uError) throw uError;

            // Update Quotation status
            const { error: qError } = await supabase
                .from('quotations')
                .update({ contract_status: 'firmado' })
                .eq('id', selectedContract.quotation_id);

            if (qError) throw qError;

            alert('Contrato subido con éxito.');
            setShowUploadModal(false);
            setFiles({ pdf: null });
            fetchContracts();
        } catch (err: any) {
            alert('Error al subir contrato: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleValidate = async (contractId: string, quotationId: string) => {
        if (!confirm('¿Desea marcar este contrato como completado/validado?')) return;

        try {
            const { error: cError } = await supabase
                .from('contracts')
                .update({ is_signed_representative: true })
                .eq('id', contractId);

            if (cError) throw cError;

            const { error: qError } = await supabase
                .from('quotations')
                .update({ contract_status: 'completado' })
                .eq('id', quotationId);

            if (qError) throw qError;

            fetchContracts();
        } catch (err: any) {
            alert('Error al validar: ' + err.message);
        }
    };

    const getStatusIcon = (status: string) => {
        const s = status ? status.toLowerCase() : 'solicitado';
        switch (s) {
            case 'solicitado': return <Clock className="w-4 h-4 text-amber-500" />;
            case 'firmado': return <FileSignature className="w-4 h-4 text-emerald-500" />;
            case 'completado': return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
            case 'rechazado': return <XCircle className="w-4 h-4 text-red-500" />;
            default: return <FileText className="w-4 h-4 text-slate-400" />;
        }
    };

    const getStatusColor = (status: string) => {
        const s = status ? status.toLowerCase() : 'solicitado';
        switch (s) {
            case 'solicitado': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'firmado': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'completado': return 'bg-emerald-600/10 text-emerald-400 border-emerald-500/20';
            case 'rechazado': return 'bg-red-500/10 text-red-500 border-red-500/20';
            default: return 'bg-slate-500/10 text-slate-400 border-white/5';
        }
    };

    const filteredContracts = contracts.filter(c => {
        if (activeTab === 'TODOS') return true;
        const status = c.quotations?.contract_status ? c.quotations.contract_status.toUpperCase() : 'SOLICITADO';
        return status === activeTab;
    });

    return (
        <div className="fade-in space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <FileSignature className="text-indigo-500" />
                        {quotationId ? 'Contratos de Proforma' : 'Gestión de Contratos'}
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Control de firmas y documentación legal de las proformas.
                    </p>
                </div>

                <div className="flex bg-slate-800/40 p-1 rounded-xl border border-white/5">
                    {['TODOS', 'SOLICITADO', 'FIRMADO', 'COMPLETADO'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3">
                    <XCircle className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            <div className="glass-card !p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/5">
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Folio P. / Org</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Monto</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Estado</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Fecha Solicitud</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-4 h-16 bg-white/5" />
                                    </tr>
                                ))
                            ) : filteredContracts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">
                                        No se encontraron contratos registrados.
                                    </td>
                                </tr>
                            ) : filteredContracts.map((c: any) => (
                                <tr key={c.quotations.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {c.isPending ? (
                                                <button
                                                    onClick={() => navigate(`/proformas/${c.quotation_id}`)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors flex-shrink-0 opacity-50 cursor-pointer"
                                                    title="Ir a Configurar Proforma"
                                                >
                                                    <FileEdit className="w-4 h-4" /> {/* Assuming FileEdit is the intended icon */}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => navigate(`/proformas/${c.quotation_id}`)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors flex-shrink-0"
                                                    title="Abrir Proforma Original"
                                                >
                                                    <FileEdit className="w-4 h-4" />
                                                </button>
                                            )}
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
                                    <td className="px-6 py-4">
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getStatusColor(c.quotations?.contract_status)}`}>
                                            {getStatusIcon(c.quotations?.contract_status)}
                                            {c.quotations?.contract_status || 'SOLICITADO'}
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
                                                className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-all"
                                                title="Ir a Proforma Maestra"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>

                                            {(!c.quotations?.contract_status || c.quotations.contract_status === 'solicitado') && (
                                                <button
                                                    onClick={() => { setSelectedContract(c); setShowUploadModal(true); }}
                                                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
                                                    title="Subir Contrato Firmado"
                                                >
                                                    <Upload className="w-4 h-4" />
                                                </button>
                                            )}

                                            {(c.quotations?.contract_status === 'firmado') && (
                                                <button
                                                    onClick={() => handleValidate(c.id, c.quotation_id)}
                                                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
                                                    title="Marcar como Completado"
                                                >
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DE CARGA */}
            {showUploadModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden shadow-indigo-500/10">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-600/10 to-transparent">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Upload className="text-indigo-500 w-5 h-5" />
                                    Subir Contrato
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">Sube el documento PDF o Word del contrato.</p>
                            </div>
                            <button onClick={() => setShowUploadModal(false)} className="text-slate-500 hover:text-white transition-colors">&times;</button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archivo PDF/Word</label>
                                    <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${files.pdf ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-indigo-500/30'}`}>
                                        <input
                                            type="file"
                                            accept=".pdf,.doc,.docx"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={(e) => setFiles(prev => ({ ...prev, pdf: e.target.files?.[0] || null }))}
                                        />
                                        <div className="text-center">
                                            {files.pdf ? (
                                                <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                                                    <FileSignature size={16} /> {files.pdf.name}
                                                </div>
                                            ) : (
                                                <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                                                    <Upload size={20} className="text-slate-600" />
                                                    Arrastra o selecciona el documento
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-white/5">
                                <button
                                    onClick={() => setShowUploadModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={uploading || !files.pdf}
                                    onClick={handleUpload}
                                    className={`flex-1 px-4 py-2.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg ${uploading || !files.pdf
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/20'
                                        }`}
                                >
                                    {uploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                            Subiendo...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={16} />
                                            Subir Contrato
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contracts;
