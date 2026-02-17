import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    ChevronRight,
    Users,
    BookOpen,
    Hash
} from 'lucide-react';
import type { EconomicActivity } from '../../types';

const EconomicActivitiesTab = () => {
    const [activities, setActivities] = useState<EconomicActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [suggestedProducts, setSuggestedProducts] = useState<Record<string, any[]>>({});
    const [loadingProducts, setLoadingProducts] = useState<Record<string, boolean>>({});

    const fetchSuggestedProducts = async (activityCode: string) => {
        try {
            setLoadingProducts(prev => ({ ...prev, [activityCode]: true }));

            // 1. Obtener familias CPS mapeadas desde el nuevo mapeo v3
            const { data: congruenceData, error: congruenceError } = await supabase
                .from('rel_activity_cps_congruence')
                .select('cps_family_code, score, reason')
                .eq('activity_code', activityCode)
                .order('score', { ascending: false });

            if (congruenceError) throw congruenceError;

            if (congruenceData && congruenceData.length > 0) {
                // 2. Obtener productos específicos para esas familias (añadiendo '00' para 8 dígitos)
                const productCodes8Digits = congruenceData.map((c: any) => `${c.cps_family_code}00`);
                const { data: productsData, error: productsError } = await supabase
                    .from('cat_cfdi_productos_servicios')
                    .select('code, name')
                    .in('code', productCodes8Digits);

                if (productsError) throw productsError;

                // 3. Mapear resultados combinando la información de congruencia
                const results = productsData?.map((p: any) => {
                    const family = congruenceData.find((c: any) => p.code === `${c.cps_family_code}00`);
                    return {
                        product_code: p.code,
                        matching_score: family?.score || 0,
                        reason: family?.reason || '',
                        cat_cfdi_productos_servicios: { name: p.name }
                    };
                }).sort((a: any, b: any) => b.matching_score - a.matching_score) || [];

                setSuggestedProducts(prev => ({ ...prev, [activityCode]: results }));
            } else {
                setSuggestedProducts(prev => ({ ...prev, [activityCode]: [] }));
            }
        } catch (err: any) {
            console.error('Error fetching suggested products:', err.message);
        } finally {
            setLoadingProducts(prev => ({ ...prev, [activityCode]: false }));
        }
    };

    const fetchActivities = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('cat_economic_activities')
                .select('*')
                .order('code');

            if (error) throw error;

            const { data: counts } = await supabase
                .from('organization_activities')
                .select('description, organization_id');

            const activitiesWithCounts = (data || []).map((act: any) => {
                const orgCount = counts?.filter((c: any) => c.description?.toLowerCase() === act.name.toLowerCase()).length || 0;
                return { ...act, org_count: orgCount };
            });

            setActivities(activitiesWithCounts);
        } catch (err: any) {
            console.error('Error fetching activities:', err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivities();
    }, []);

    const toggleNode = async (id: string, code: string, _level: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const isCurrentlyExpanded = expandedNodes.has(id);
        const newExpanded = new Set(expandedNodes);

        if (isCurrentlyExpanded) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
            // Cargar productos si es un nivel hoja (sin hijos) o nivel SUBRAMA
            const hasChildren = activities.some(a => a.parent_id === id);
            if (!hasChildren && !suggestedProducts[code]) {
                await fetchSuggestedProducts(code);
            }
        }
        setExpandedNodes(newExpanded);
    };

    const renderActivityRow = (act: EconomicActivity, depth: number) => {
        const hasChildren = activities.some(a => a.parent_id === act.id);
        const isExpanded = expandedNodes.has(act.id);
        const children = activities.filter(a => a.parent_id === act.id);
        const suggested = suggestedProducts[act.code] || [];

        return (
            <div key={act.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                    onClick={() => toggleNode(act.id, act.code, act.level)}
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
                        marginLeft: `${depth * 24}px`,
                        borderLeft: isExpanded ? '3px solid var(--primary-base)' : '1px solid transparent'
                    }}
                    className="hover-row"
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                        <div style={{ color: isExpanded ? 'var(--primary-base)' : '#64748b', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
                            <ChevronRight size={16} />
                        </div>

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
                            {act.code}
                        </div>

                        <span style={{
                            fontSize: '13px',
                            fontWeight: isExpanded ? '700' : '500',
                            color: isExpanded ? 'white' : '#94a3b8'
                        }}>
                            {act.name}
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {(act as any).org_count > 0 && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                border: '1px solid rgba(16, 185, 129, 0.2)'
                            }}>
                                <Users size={12} color="#10b981" />
                                <span style={{ fontSize: '10px', fontWeight: '900', color: '#10b981' }}>{(act as any).org_count}</span>
                            </div>
                        )}
                        {suggested.length > 0 && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                border: '1px solid rgba(99, 102, 241, 0.2)'
                            }}>
                                <Hash size={12} color="var(--primary-base)" />
                                <span style={{ fontSize: '10px', fontWeight: '900', color: 'var(--primary-base)' }}>{suggested.length}</span>
                            </div>
                        )}
                        <span style={{
                            fontSize: '9px',
                            fontWeight: '900',
                            color: '#475569',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            backgroundColor: 'rgba(0,0,0,0.2)',
                            padding: '2px 6px',
                            borderRadius: '4px'
                        }}>
                            {act.level}
                        </span>
                    </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                    <div style={{
                        padding: hasChildren ? '4px 0' : '20px',
                        backgroundColor: 'rgba(15, 23, 42, 0.3)',
                        borderLeft: '3px solid var(--primary-base)',
                        marginLeft: `${depth * 24}px`,
                        marginBottom: '8px',
                        borderRadius: '0 0 12px 12px',
                        borderBottom: '1px solid rgba(99, 102, 241, 0.1)'
                    }} className="fade-in">
                        {hasChildren ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {children.map(child => renderActivityRow(child, depth + 1))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ padding: '8px', backgroundColor: 'var(--primary-light)', borderRadius: '10px', color: 'var(--primary-base)' }}>
                                        <BookOpen size={18} />
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
                                        {act.description || 'Consulta de compatibilidad para contratos y facturación basada en el Catálogo de Actividades Económicas del SAT.'}
                                    </div>
                                </div>

                                {loadingProducts[act.code] ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                                        Cargando sugerencias de materialidad...
                                    </div>
                                ) : suggested.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginTop: '8px' }}>
                                        {suggested.map(prod => (
                                            <div
                                                key={prod.product_code}
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '100px 1fr 100px',
                                                    gap: '12px',
                                                    padding: '10px 16px',
                                                    background: 'rgba(255,255,255,0.02)',
                                                    borderRadius: '8px',
                                                    fontSize: '11px',
                                                    alignItems: 'center',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ color: 'var(--primary-base)', fontWeight: '800', fontFamily: 'monospace' }}>
                                                        {prod.product_code}
                                                    </span>
                                                    <span style={{ fontSize: '9px', color: '#64748b' }}>CPV / SAT</span>
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ color: '#e2e8f0', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={prod.cat_cfdi_productos_servicios.name}>
                                                        {prod.cat_cfdi_productos_servicios.name}
                                                    </div>
                                                    <div style={{ fontSize: '9px', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }} title={prod.reason}>
                                                        {prod.reason}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{
                                                        fontSize: '9px',
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        background: prod.matching_score >= 1.0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                                                        color: prod.matching_score >= 1.0 ? '#10b981' : 'var(--primary-base)',
                                                        fontWeight: '800',
                                                        border: `1px solid ${prod.matching_score >= 1.0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
                                                        textAlign: 'center'
                                                    }}>
                                                        {prod.matching_score >= 1.0 ? 'PRINCIPAL' : `SCORE: ${prod.matching_score.toFixed(2)}`}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', padding: '10px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '8px' }}>
                                        No se encontraron claves SAT sugeridas con score suficiente para esta subrama.
                                    </div>
                                )}

                                {act.metadata && Object.keys(act.metadata).length > 0 && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                                        {Object.entries(act.metadata).map(([key, val]: [string, any]) => (
                                            <div key={key} style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>{key}</div>
                                                <div style={{ fontSize: '11px', color: 'white', fontWeight: '600' }}>{String(val)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const filtered = searchTerm
        ? activities.filter(a =>
            a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.code.includes(searchTerm)
        )
        : activities.filter(a => a.level === 'SECTOR');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Contextual Search & Stats */}
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
                    <Hash style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(148, 163, 184, 0.4)' }} size={20} />
                    <input
                        type="text"
                        placeholder="Buscar en la taxonomía SCIAN..."
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

                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ padding: '10px 20px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                        <div style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Registros</div>
                        <div style={{ fontSize: '16px', fontWeight: '900', color: 'white' }}>{activities.length}</div>
                    </div>
                    <div style={{ padding: '10px 20px', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: '9px', fontWeight: '900', color: 'var(--primary-base)', textTransform: 'uppercase', marginBottom: '2px' }}>Sectores</div>
                        <div style={{ fontSize: '16px', fontWeight: '900', color: 'white' }}>{activities.filter(a => a.level === 'SECTOR').length}</div>
                    </div>
                </div>
            </div>

            {/* Hierarchical List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {loading ? (
                    [...Array(6)].map((_, i) => (
                        <div key={i} className="glass-card" style={{ height: '56px', opacity: 0.5, marginBottom: '4px' }}></div>
                    ))
                ) : filtered.map(act => renderActivityRow(act, 0))}
            </div>

            <style>{`
                .hover-row:hover {
                    background-color: rgba(255, 255, 255, 0.02) !important;
                }
                .sat-search-input:focus {
                    border-color: var(--primary-base) !important;
                    box-shadow: 0 0 0 4px var(--primary-light) !important;
                }
                .fade-in {
                    animation: fadeIn 0.3s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default EconomicActivitiesTab;
