import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    Camera,
    FileEdit,
    Image as ImageIcon,
    FileText,
    MapPin,
    Hash,
    Clock
} from 'lucide-react';

interface EvidenceProps {
    userProfile: any;
    selectedOrg: any;
}

const Evidence = ({ selectedOrg }: EvidenceProps) => {
    const navigate = useNavigate();
    const [evidenceItems, setEvidenceItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchEvidenceRequests = async () => {
            if (!selectedOrg?.id) return;
            try {
                setLoading(true);
                // Fetch quotations that require evidence or have evidence attached
                const { data, error: fetchError } = await supabase
                    .from('quotations')
                    .select(`
                        id,
                        proforma_number,
                        created_at,
                        evidence_status,
                        req_evidence,
                        organizations(name, rfc),
                        invoices(id, internal_number, evidence(id, type, file_url, created_at, metadata, sha256_hash)),
                        contracts(id, evidence(id, type, file_url, created_at, metadata, sha256_hash))
                    `)
                    .eq('organization_id', selectedOrg.id)
                    .or('req_evidence.eq.true,evidence_status.in.(boceto,solicitada,en_revision,entregada,completada)')
                    .order('created_at', { ascending: false });

                if (fetchError) throw fetchError;

                // Flatten the results to match the table structure
                const flattenedEvidence: any[] = [];
                data?.forEach((q: any) => {
                    const orgData = q.organizations;
                    let hasActualEvidence = false;

                    const processEvidenceArray = (evidenceArray: any[]) => {
                        const evList = Array.isArray(evidenceArray) ? evidenceArray : (evidenceArray ? [evidenceArray] : []);
                        evList.forEach((e: any) => {
                            hasActualEvidence = true;
                            flattenedEvidence.push({
                                id: e.id,
                                type: e.type,
                                file_url: e.file_url,
                                created_at: e.created_at,
                                metadata: e.metadata,
                                sha256_hash: e.sha256_hash,
                                organizations: orgData,
                                quotationObj: q,
                                isPending: false
                            });
                        });
                    };

                    const invList = Array.isArray(q.invoices) ? q.invoices : (q.invoices ? [q.invoices] : []);
                    invList.forEach((inv: any) => {
                        processEvidenceArray(inv.evidence);
                    });

                    const contList = Array.isArray(q.contracts) ? q.contracts : (q.contracts ? [q.contracts] : []);
                    contList.forEach((cont: any) => {
                        processEvidenceArray(cont.evidence);
                    });

                    if (!hasActualEvidence && (q.req_evidence || q.evidence_status === 'solicitada')) {
                        flattenedEvidence.push({
                            id: `pending-${q.id}`,
                            type: 'PENDIENTE',
                            file_url: null,
                            created_at: q.created_at,
                            metadata: null,
                            sha256_hash: null,
                            organizations: orgData,
                            quotationObj: q,
                            isPending: true
                        });
                    }
                });

                setEvidenceItems(flattenedEvidence);
            } catch (err: any) {
                console.error('Error fetching evidence:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchEvidenceRequests();
    }, [selectedOrg]);

    return (
        <div className="fade-in space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Camera className="text-indigo-500" />
                        Evidencia Fotográfica
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Control y seguimiento de evidencia material.
                    </p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    {error}
                </div>
            )}

            <div className="glass-card !p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/5">
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Folio P. / Org</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Tipo / Archivo</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Metadatos</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Fecha Carga</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={4} className="px-6 py-4 h-16 bg-white/5" />
                                    </tr>
                                ))
                            ) : evidenceItems.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">
                                        No se encontraron registros de evidencia material.
                                    </td>
                                </tr>
                            ) : evidenceItems.map((e: any) => {
                                // Cleanup previous references since we inject them directly now

                                return (
                                    <tr key={e.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {e.quotationObj?.id && (
                                                    <button
                                                        onClick={() => navigate(`/ proformas / ${e.quotationObj.id}`)}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors flex-shrink-0"
                                                        title="Abrir Proforma Original"
                                                    >
                                                        <FileEdit className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <div>
                                                    <div className="font-bold text-white leading-tight font-mono text-sm max-w-[150px] truncate">
                                                        {(() => {
                                                            const quote = e.quotationObj;
                                                            const orgPrefix = e.organizations?.rfc?.match(/^[A-Z&]{3,4}/)?.[0] || 'PF';
                                                            const dateStr = quote?.created_at ? new Date(quote.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '') : '000000';
                                                            const folNum = (quote?.proforma_number || 1).toString().padStart(2, '0');
                                                            return `${orgPrefix} - ${dateStr} - ${folNum}`;
                                                        })()}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-tighter truncate max-w-[150px]">
                                                        {e.organizations?.name || 'Org Desconocida'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {e.isPending ? (
                                                    <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                                                ) : e.type === 'FOTO' ? (
                                                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                                                ) : (
                                                    <FileText className="w-4 h-4 text-blue-400" />
                                                )}
                                                <div>
                                                    <div className={`font - bold text - xs ${e.isPending ? 'text-amber-400' : 'text-slate-300'}`}>
                                                        {e.type}
                                                    </div>
                                                    {e.file_url ? (
                                                        <a href={supabase.storage.from('evidence').getPublicUrl(e.file_url).data.publicUrl} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-400 hover:underline">
                                                            Ver Archivo
                                                        </a>
                                                    ) : e.isPending && (
                                                        <span className="text-[10px] text-amber-500/70">Esperando carga...</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                {e.metadata?.gps && (
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded-lg">
                                                        <MapPin className="w-3 h-3 text-emerald-500" />
                                                        Lat/Lng
                                                    </div>
                                                )}
                                                {e.sha256_hash && (
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded-lg" title={e.sha256_hash}>
                                                        <Hash className="w-3 h-3 text-amber-500" />
                                                        SHA256
                                                    </div>
                                                )}
                                                {!e.metadata?.gps && !e.sha256_hash && !e.isPending && (
                                                    <span className="text-xs text-slate-500">Sin metadatos</span>
                                                )}
                                                {e.isPending && (
                                                    <span className="text-xs text-amber-500/50 italic">Pendiente de registro</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs text-slate-400">
                                                {new Date(e.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Evidence;
