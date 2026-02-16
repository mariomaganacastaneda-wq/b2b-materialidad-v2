import { useState, useEffect } from 'react';
import { supabase } from '../../App';
import {
    Check,
    Trash2,
    AlertCircle,
    Clock,
    Printer,
    Edit3,
    FileSearch
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MaterialityStep {
    id: string;
    description: string;
    amount_total: number;
    status: string;
    proforma_number?: number;
    total_proformas?: number;
    created_at: string;
    // Relaciones para estados
    contract_id?: string;
    invoice_id?: string;
    has_evidence?: boolean;
    consecutive_id?: number;
}

const MaterialityBoard = ({ selectedOrg }: { selectedOrg: any }) => {
    const [loading, setLoading] = useState(true);
    const [proformas, setProformas] = useState<MaterialityStep[]>([]);
    const [totalSystemProformas, setTotalSystemProformas] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        fetchGlobalStats();
        if (selectedOrg?.id) {
            fetchProformas();
        }
    }, [selectedOrg]);

    const fetchGlobalStats = async () => {
        const { count, error } = await supabase
            .from('quotations')
            .select('*', { count: 'exact', head: true });
        if (!error && count !== null) setTotalSystemProformas(count);
    };

    const fetchProformas = async () => {
        setLoading(true);
        try {
            // Consulta compleja para traer proformas y sus estados vinculados
            const { data, error } = await supabase
                .from('quotations')
                .select(`
                    id, 
                    description, 
                    amount_total, 
                    status, 
                    proforma_number, 
                    total_proformas, 
                    created_at,
                    consecutive_id,
                    contracts (id),
                    invoices (id)
                `)
                .eq('organization_id', selectedOrg.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mappedData = data.map((q: any) => ({
                id: q.id,
                description: q.description || 'Sin descripción',
                amount_total: q.amount_total,
                status: q.status,
                proforma_number: q.proforma_number,
                total_proformas: q.total_proformas,
                created_at: q.created_at,
                contract_id: q.contracts?.[0]?.id,
                invoice_id: q.invoices?.[0]?.id,
                has_evidence: false,
                consecutive_id: q.consecutive_id
            }));

            setProformas(mappedData);
        } catch (err) {
            console.error('Error fetching proformas for board:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar esta proforma? Esta acción no se puede deshacer.')) return;

        try {
            // El borrado en cascada debería manejar los items si está configurado en DB, 
            // pero si no, borramos ítems primero por precaución.
            await supabase.from('quotation_items').delete().eq('quotation_id', id);
            const { error } = await supabase.from('quotations').delete().eq('id', id);

            if (error) throw error;

            setProformas(prev => prev.filter(p => p.id !== id));
            fetchGlobalStats();
        } catch (err) {
            console.error('Error deleting proforma:', err);
            alert('No se pudo eliminar la proforma.');
        }
    };

    const StatusBadge = ({ active, label, onClick }: { active: boolean, label: string, onClick?: () => void }) => (
        <div
            onClick={onClick}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                cursor: onClick ? 'pointer' : 'default',
                opacity: active ? 1 : 0.3,
                transition: 'all 0.2s'
            }}
        >
            <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: active ? 'var(--primary-color)' : '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: active ? '0 0 10px var(--primary-glow)' : 'none'
            }}>
                {active ? <Check size={16} color="white" /> : <Clock size={16} color="#94a3b8" />}
            </div>
            <span style={{ fontSize: '10px', fontWeight: '600', color: active ? 'white' : '#64748b' }}>{label}</span>
        </div>
    );

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px' }}>Tablero de Materialidad</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <p style={{ color: '#94a3b8' }}>Rastreo completo del ciclo de vida de tus servicios y cumplimiento fiscal.</p>
                        <div style={{
                            backgroundColor: 'rgba(56, 189, 248, 0.1)',
                            color: 'var(--primary-color)',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700',
                            border: '1px solid rgba(56, 189, 248, 0.2)'
                        }}>
                            {totalSystemProformas} Registros Globales
                        </div>
                    </div>
                </div>
                <button
                    className="primary-button"
                    onClick={() => navigate('/proformas')}
                >
                    + Nueva Proforma
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '100px', color: '#64748b' }}>Cargando proformas...</div>
            ) : proformas.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '60px' }}>
                    {totalSystemProformas > 0 ? (
                        <div style={{ marginBottom: '24px' }}>
                            <AlertCircle size={48} color="var(--primary-color)" style={{ marginBottom: '16px', opacity: 0.5 }} />
                            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Filtro de Organización Activo</h3>
                            <p style={{ color: '#94a3b8', maxWidth: '400px', margin: '0 auto 24px' }}>
                                Hay <b>{totalSystemProformas} proformas</b> en el sistema, pero ninguna pertenece a <b>{selectedOrg?.name}</b>.
                                Selecciona la empresa correspondiente en el menú superior para ver sus datos.
                            </p>
                        </div>
                    ) : (
                        <>
                            <Edit3 size={48} color="#334155" style={{ marginBottom: '16px' }} />
                            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>No hay proformas registradas</h3>
                            <p style={{ color: '#64748b', marginBottom: '24px' }}>Inicia el proceso de materialidad creando tu primera proforma.</p>
                        </>
                    )}
                    <button className="primary-button" onClick={() => navigate('/proformas')}>Empezar Proceso</button>
                </div>
            ) : (
                <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>SERVICIO / PROFORMA</th>
                                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#64748b', fontWeight: '600', textAlign: 'center' }}>FLUJO DE MATERIALIDAD</th>
                                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#64748b', fontWeight: '600', textAlign: 'right' }}>MONTO</th>
                                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#64748b', fontWeight: '600', textAlign: 'right' }}>ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {proformas.map((p) => (
                                <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} className="table-row-hover">
                                    <td style={{ padding: '20px 24px' }}>
                                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{p.description}</div>
                                        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{
                                                backgroundColor: 'rgba(255,255,255,0.05)',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                color: 'var(--primary-color)',
                                                fontWeight: '700'
                                            }}>
                                                # {p.consecutive_id || p.id.slice(0, 5)}
                                            </span>
                                            {p.proforma_number && <span>Seq: {p.proforma_number}/{p.total_proformas}</span>}
                                            <span>• {new Date(p.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px' }}>
                                            <StatusBadge active={true} label="Proforma" onClick={() => navigate(`/proformas/${p.id}`)} />
                                            <StatusBadge active={p.status === 'APROBADA'} label="Cotización" />
                                            <StatusBadge active={!!p.contract_id} label="Contrato" />
                                            <StatusBadge active={!!p.has_evidence} label="Evidencia" />
                                            <StatusBadge active={!!p.invoice_id} label="Factura" />
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: '700', fontSize: '16px' }}>
                                        ${p.amount_total.toLocaleString()}
                                    </td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            <button
                                                title="Ver Detalles"
                                                onClick={() => navigate(`/proformas/${p.id}`)}
                                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', cursor: 'pointer', color: '#94a3b8' }}
                                            >
                                                <FileSearch size={18} />
                                            </button>
                                            <button
                                                title="Imprimir"
                                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', cursor: 'pointer', color: '#94a3b8' }}
                                            >
                                                <Printer size={18} />
                                            </button>
                                            <button
                                                key={`del-${p.id}`}
                                                title="Eliminar"
                                                onClick={() => handleDelete(p.id)}
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.05)',
                                                    border: '1px solid rgba(239, 68, 68, 0.1)',
                                                    padding: '8px',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    color: '#f87171'
                                                }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <style>{`
                .table-row-hover:hover {
                    background-color: rgba(255, 255, 255, 0.02);
                }
            `}</style>
        </div>
    );
};

export default MaterialityBoard;
