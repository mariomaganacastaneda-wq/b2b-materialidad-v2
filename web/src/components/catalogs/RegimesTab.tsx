import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Search,
    GraduationCap,
    Users,
    Briefcase,
    BadgeCheck,
    ArrowUpRight,
    SearchCode
} from 'lucide-react';
import type { CFDIRegime } from '../../types';

const RegimesTab = () => {
    const [regimes, setRegimes] = useState<CFDIRegime[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchRegimes = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('cat_cfdi_regimenes')
                    .select('*')
                    .order('code');

                if (error) throw error;
                setRegimes(data || []);
            } catch (err: any) {
                console.error('Error fetching regimes:', err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchRegimes();
    }, []);

    const toggleId = (code: string) => {
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(code)) newExpanded.delete(code);
        else newExpanded.add(code);
        setExpandedIds(newExpanded);
    };

    const filtered = regimes.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.code.includes(searchTerm)
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Contextual Search */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '24px',
                padding: '24px',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '24px',
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ flex: 1, position: 'relative', maxWidth: '600px' }}>
                    <SearchCode style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(148, 163, 184, 0.5)' }} size={20} />
                    <input
                        type="text"
                        placeholder="Filtrar regímenes (Ej. 601, Sueldos)..."
                        aria-label="Filtrar regímenes fiscales"
                        style={{
                            width: '100%',
                            backgroundColor: '#020617',
                            border: '1px solid #1e293b',
                            borderRadius: '16px',
                            padding: '14px 16px 14px 48px',
                            fontSize: '14px',
                            color: 'white',
                            outline: 'none',
                            transition: 'all 0.3s'
                        }}
                        className="sat-search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                }}>
                    <Briefcase size={14} color="var(--primary-base)" />
                    Catálogo CFDI 4.0
                </div>
            </div>

            {/* Content List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {loading ? (
                    [...Array(6)].map((_, i) => (
                        <div key={i} className="glass-card" style={{ height: '56px', opacity: 0.5 }}></div>
                    ))
                ) : filtered.length === 0 ? (
                    <div style={{
                        padding: '80px 0',
                        textAlign: 'center',
                        backgroundColor: 'rgba(15, 23, 42, 0.2)',
                        borderRadius: '32px',
                        border: '1px dashed rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '16px'
                    }}>
                        <Search size={48} style={{ color: '#334155' }} />
                        <p style={{ color: '#64748b' }}>No se encontraron regímenes para "{searchTerm}"</p>
                    </div>
                ) : (
                    filtered.map(r => {
                        const isExpanded = expandedIds.has(r.code);
                        return (
                            <div key={r.code} style={{ display: 'flex', flexDirection: 'column' }}>
                                <div
                                    onClick={() => toggleId(r.code)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '12px 20px',
                                        backgroundColor: isExpanded ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                                        borderRadius: isExpanded ? '12px 12px 0 0' : '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        borderLeft: isExpanded ? '3px solid var(--primary-base)' : '1px solid transparent'
                                    }}
                                    className="hover-row"
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                                        <div style={{
                                            fontSize: '11px',
                                            fontWeight: '800',
                                            color: isExpanded ? 'var(--primary-base)' : 'rgba(148, 163, 184, 0.6)',
                                            fontFamily: 'monospace',
                                            backgroundColor: isExpanded ? 'var(--primary-light)' : 'rgba(255,255,255,0.03)',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            minWidth: '60px',
                                            textAlign: 'center'
                                        }}>
                                            {r.code}
                                        </div>
                                        <span style={{
                                            fontSize: '13px',
                                            fontWeight: isExpanded ? '700' : '500',
                                            color: isExpanded ? 'white' : '#94a3b8'
                                        }}>
                                            {r.name}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {r.applies_to_physical && (
                                                <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', fontSize: '9px', fontWeight: '900' }}>PF</span>
                                            )}
                                            {r.applies_to_moral && (
                                                <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '9px', fontWeight: '900' }}>PM</span>
                                            )}
                                        </div>
                                        <ArrowUpRight
                                            size={16}
                                            style={{
                                                color: isExpanded ? 'var(--primary-base)' : '#334155',
                                                transform: isExpanded ? 'rotate(90deg)' : 'none',
                                                transition: 'transform 0.2s'
                                            }}
                                        />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div style={{
                                        padding: '20px',
                                        backgroundColor: 'rgba(15, 23, 42, 0.3)',
                                        borderLeft: '3px solid var(--primary-base)',
                                        marginBottom: '8px',
                                        borderRadius: '0 0 12px 12px',
                                        borderBottom: '1px solid rgba(99, 102, 241, 0.1)',
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                        gap: '24px'
                                    }} className="fade-in">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descripción del Régimen</span>
                                            <span style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.6' }}>{r.name}</span>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo de Persona</span>
                                            <div style={{ display: 'flex', gap: '16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: r.applies_to_physical ? 1 : 0.3 }}>
                                                    <Users size={14} color={r.applies_to_physical ? '#10b981' : '#475569'} />
                                                    <span style={{ fontSize: '11px', color: r.applies_to_physical ? 'white' : '#475569', fontWeight: '600' }}>Persona Física</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: r.applies_to_moral ? 1 : 0.3 }}>
                                                    <GraduationCap size={14} color={r.applies_to_moral ? '#38bdf8' : '#475569'} />
                                                    <span style={{ fontSize: '11px', color: r.applies_to_moral ? 'white' : '#475569', fontWeight: '600' }}>Persona Moral</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estatus de Validación</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-base)' }}>
                                                <BadgeCheck size={14} />
                                                <span style={{ fontSize: '11px', fontWeight: '700' }}>Vigente SAT 2026</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Advisory Note */}
            <div style={{
                padding: '24px',
                borderRadius: '16px',
                backgroundColor: 'rgba(99, 102, 241, 0.03)',
                border: '1px solid rgba(99, 102, 241, 0.1)',
                display: 'flex',
                gap: '16px',
                alignItems: 'center'
            }}>
                <div style={{ padding: '10px', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', color: 'var(--primary-base)' }}>
                    <BadgeCheck size={20} />
                </div>
                <p style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.6', margin: 0 }}>
                    <strong style={{ color: 'var(--primary-base)', marginRight: '8px', textTransform: 'uppercase', fontSize: '9px', fontWeight: '900' }}>Validación Fiscal:</strong>
                    Los regímenes aquí listados definen las obligaciones y beneficios aplicables a la empresa del contribuyente.
                    Asegúrese de que el régimen coincida con su Constancia de Situación Fiscal (CSF) para evitar rechazos en el timbrado.
                </p>
            </div>

            <style>{`
                .hover-row:hover {
                    background-color: rgba(255, 255, 255, 0.02) !important;
                }
                .sat-search-input:focus {
                    border-color: var(--primary-base) !important;
                    box-shadow: 0 0 0 4px var(--primary-light) !important;
                }
            `}</style>
        </div>
    );
};

export default RegimesTab;
