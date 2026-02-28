import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    ShieldAlert,
    ShieldCheck,
    Globe,
    FileText,
    Calendar,
    ExternalLink,
    RefreshCw,
    SearchCode
} from 'lucide-react';

const BlacklistTab = () => {
    const [blacklist, setBlacklist] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [totalCount, setTotalCount] = useState(0);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const fetchBlacklist = async (term = '') => {
        try {
            setLoading(true);
            let query = supabase
                .from('sat_blacklist')
                .select('*', { count: 'exact' });

            if (term) {
                query = query.or(`rfc.ilike.%${term}%,name.ilike.%${term}%`);
            }

            const { data, error, count } = await query
                .order('publishing_date', { ascending: false })
                .range(0, 19);

            if (error) throw error;
            setBlacklist(data || []);
            setTotalCount(count || 0);
        } catch (err: any) {
            console.error('Error fetching blacklist:', err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchBlacklist(searchTerm);
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const toggleId = (id: string) => {
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedIds(newExpanded);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Security Status Header */}
            <div style={{
                padding: '24px',
                borderRadius: '24px',
                background: 'linear-gradient(to bottom right, rgba(244, 63, 94, 0.05), rgba(15, 23, 42, 0.4))',
                border: '1px solid rgba(244, 63, 94, 0.1)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '200px', height: '200px', background: 'rgba(244, 63, 94, 0.05)', filter: 'blur(80px)', marginRight: '-100px', marginTop: '-100px' }}></div>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldAlert size={18} color="#f43f5e" />
                            <span style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#f43f5e' }}>Vigilancia 69-B del SAT</span>
                        </div>
                        <h2 style={{ fontSize: '20px', fontWeight: '900', color: 'white', margin: 0 }}>Módulo de <span style={{ color: '#fb7185' }}>Riesgo Fiscal</span></h2>
                        <p style={{ color: '#64748b', fontSize: '11px', maxWidth: '400px', lineHeight: '1.5', margin: 0 }}>
                            Validación en tiempo real contra la lista oficial de EFOS y EDOS.
                            La integridad tributaria es crítica para la Materialidad.
                        </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', borderRadius: '16px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', minWidth: '140px' }}>
                        <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Alertas Totales</span>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#f43f5e' }}>
                            {totalCount.toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Verification Search Bar */}
            <div style={{ display: 'flex', gap: '12px', padding: '6px', borderRadius: '16px', backgroundColor: 'rgba(2, 6, 23, 0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <SearchCode style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(148, 163, 184, 0.5)' }} size={20} />
                    <input
                        type="text"
                        placeholder="Auditar RFC o Razón Social..."
                        aria-label="Auditar RFC o Razón Social en la lista negra"
                        style={{
                            width: '100%',
                            backgroundColor: 'transparent',
                            border: 'none',
                            padding: '12px 16px 12px 48px',
                            fontSize: '13px',
                            color: 'white',
                            outline: 'none',
                            fontWeight: '600'
                        }}
                        className="sat-search-input-rose"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => fetchBlacklist(searchTerm)}
                    style={{
                        backgroundColor: '#f43f5e',
                        border: 'none',
                        borderRadius: '12px',
                        width: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'white',
                        transition: 'all 0.2s'
                    }}
                    className="hover-bright"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Accordion List Area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {loading && blacklist.length === 0 ? (
                    [...Array(6)].map((_, i) => (
                        <div key={i} className="glass-card" style={{ height: '56px', opacity: 0.5 }}></div>
                    ))
                ) : blacklist.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '24px', backgroundColor: 'rgba(15, 23, 42, 0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <ShieldCheck size={40} style={{ color: '#1e293b' }} />
                        <span style={{ color: '#64748b', fontSize: '12px', fontWeight: '500' }}>No se han detectado coincidencias críticas.</span>
                    </div>
                ) : (
                    blacklist.map((entry) => {
                        const isExpanded = expandedIds.has(entry.id);
                        return (
                            <div key={entry.id} style={{ display: 'flex', flexDirection: 'column' }}>
                                <div
                                    onClick={() => toggleId(entry.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '12px 20px',
                                        backgroundColor: isExpanded ? 'rgba(244, 63, 94, 0.05)' : 'transparent',
                                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                                        borderRadius: isExpanded ? '12px 12px 0 0' : '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        borderLeft: isExpanded ? '3px solid #f43f5e' : '1px solid transparent'
                                    }}
                                    className="hover-row-rose"
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                                        <div style={{
                                            fontSize: '11px',
                                            fontWeight: '800',
                                            color: isExpanded ? '#f43f5e' : '#94a3b8',
                                            fontFamily: 'monospace',
                                            backgroundColor: isExpanded ? 'rgba(244, 63, 94, 0.1)' : 'rgba(255,255,255,0.03)',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            minWidth: '100px',
                                            textAlign: 'center'
                                        }}>
                                            {entry.rfc}
                                        </div>
                                        <span style={{
                                            fontSize: '13px',
                                            fontWeight: isExpanded ? '700' : '500',
                                            color: isExpanded ? 'white' : '#cbd5e1',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            maxWidth: '400px'
                                        }}>
                                            {entry.name}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{
                                            padding: '2px 8px',
                                            backgroundColor: 'rgba(244, 63, 94, 0.1)',
                                            border: '1px solid rgba(244, 63, 94, 0.2)',
                                            color: '#f43f5e',
                                            fontSize: '9px',
                                            fontWeight: '900',
                                            textTransform: 'uppercase',
                                            borderRadius: '4px'
                                        }}>
                                            {entry.situation}
                                        </span>
                                        <ExternalLink
                                            size={14}
                                            style={{
                                                color: isExpanded ? '#f43f5e' : '#334155',
                                                transform: isExpanded ? 'rotate(45deg)' : 'none',
                                                transition: 'transform 0.2s'
                                            }}
                                        />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div style={{
                                        padding: '20px',
                                        backgroundColor: 'rgba(15, 23, 42, 0.3)',
                                        borderLeft: '3px solid #f43f5e',
                                        marginBottom: '8px',
                                        borderRadius: '0 0 12px 12px',
                                        borderBottom: '1px solid rgba(244, 63, 94, 0.1)',
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                        gap: '24px'
                                    }} className="fade-in">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Razón Social Completa</span>
                                            <span style={{ fontSize: '12px', color: 'white', lineHeight: '1.4', fontWeight: '600' }}>{entry.name}</span>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Oficio Global / SAT ID</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <FileText size={14} color="#f43f5e" />
                                                <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '700' }}>{entry.global_publishing_oficio || 'P-4992-0'}</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entidad Federativa</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Globe size={14} color="#64748b" />
                                                <span style={{ fontSize: '12px', color: '#cbd5e1' }}>{entry.entidad_federativa || 'No especificada'}</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fecha de Publicación</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Calendar size={14} color="#64748b" />
                                                <span style={{ fontSize: '12px', color: '#cbd5e1' }}>{entry.publishing_date ? new Date(entry.publishing_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : (entry.fecha_publicacion ? new Date(entry.fecha_publicacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A')}</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Acción Recomendada</span>
                                            <button style={{
                                                width: 'fit-content',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                background: 'rgba(244, 63, 94, 0.1)',
                                                border: '1px solid rgba(244, 63, 94, 0.2)',
                                                color: '#fb7185',
                                                fontSize: '10px',
                                                fontWeight: '900',
                                                padding: '4px 12px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                textTransform: 'uppercase'
                                            }}>
                                                Solicitar Auditoría <ShieldAlert size={12} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Legal Notice */}
            <div style={{
                padding: '24px',
                borderRadius: '16px',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                gap: '16px',
                alignItems: 'center'
            }}>
                <Globe style={{ color: '#334155' }} size={20} />
                <p style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.6', margin: 0 }}>
                    <strong style={{ color: '#94a3b8', textTransform: 'uppercase', marginRight: '6px', fontSize: '9px', fontWeight: '900' }}>Aviso Procedural:</strong>
                    La información se sincroniza con el DOF y SAT. Esta validación es preventiva.
                    En caso de coincidencia, se recomienda suspender operaciones y verificar materialidad.
                </p>
            </div>

            <style>{`
                .sat-search-input-rose:focus {
                    box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.2) !important;
                }
                .hover-row-rose:hover {
                    background-color: rgba(244, 63, 94, 0.02) !important;
                }
                .hover-bright:hover {
                    filter: brightness(1.1);
                }
            `}</style>
        </div>
    );
};

export default BlacklistTab;
