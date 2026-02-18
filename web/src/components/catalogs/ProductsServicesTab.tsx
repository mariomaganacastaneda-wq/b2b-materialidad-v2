import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    ChevronRight,
    Search,
    BookOpen,
    Users,
    AlertCircle
} from 'lucide-react';
import type { CFDIProductService } from '../../types';

const ProductsServicesTab = () => {
    const [products, setProducts] = useState<CFDIProductService[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    const fetchInitialDivisions = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('cat_cfdi_productos_servicios')
                .select('*')
                .eq('level', 'DIVISION')
                .order('code');

            if (error) throw error;
            setProducts(data || []);
        } catch (err: any) {
            console.error('Error fetching divisions:', err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchChildren = async (parentCode: string) => {
        try {
            const { data, error } = await supabase
                .from('cat_cfdi_productos_servicios')
                .select('*')
                .eq('parent_code', parentCode)
                .order('code');

            if (error) throw error;

            setProducts(prev => {
                const existingCodes = new Set(prev.map(p => p.code));
                const newItems = (data || []).filter((item: any) => !existingCodes.has(item.code));
                return [...prev, ...newItems];
            });
        } catch (err: any) {
            console.error('Error fetching children:', err.message);
        }
    };

    const fetchSearchResults = async (term: string) => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('cat_cfdi_productos_servicios')
                .select('*')
                .or(`name.ilike.%${term}%,code.ilike.%${term}%,similar_words.ilike.%${term}%`)
                .limit(100);

            if (error) throw error;
            setProducts(data || []);
        } catch (err: any) {
            console.error('Error searching:', err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (searchTerm) {
            const delayDebounceFn = setTimeout(() => {
                fetchSearchResults(searchTerm);
            }, 500);
            return () => clearTimeout(delayDebounceFn);
        } else {
            fetchInitialDivisions();
        }
    }, [searchTerm]);

    const [relatedActivities, setRelatedActivities] = useState<Record<string, any[]>>({});
    const [loadingActivities, setLoadingActivities] = useState<Record<string, boolean>>({});

    const fetchRelatedActivities = async (productCode: string) => {
        try {
            setLoadingActivities(prev => ({ ...prev, [productCode]: true }));

            // 1. Obtener la familia (primeros 6 dígitos) del código de producto
            const familyCode = productCode.substring(0, 6);

            // 2. Buscar actividades vinculadas a esa familia en v3
            const { data, error } = await supabase
                .from('rel_activity_cps_congruence')
                .select('activity_code, score, reason, cat_economic_activities(name)')
                .eq('cps_family_code', familyCode)
                .order('score', { ascending: false });

            if (error) throw error;

            const results = (data || []).map((d: any) => ({
                activity_code: d.activity_code,
                matching_score: d.score,
                reason: d.reason,
                cat_economic_activities: d.cat_economic_activities
            }));

            setRelatedActivities(prev => ({ ...prev, [productCode]: results }));
        } catch (err: any) {
            console.error('Error fetching related activities:', err.message);
        } finally {
            setLoadingActivities(prev => ({ ...prev, [productCode]: false }));
        }
    };


    const toggleNode = async (code: string, level: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        const isCurrentlyExpanded = expandedNodes.has(code);
        const newExpanded = new Set(expandedNodes);

        if (isCurrentlyExpanded) {
            newExpanded.delete(code);
        } else {
            newExpanded.add(code);
            if (level !== 'PRODUCT') {
                const hasKidsFetched = products.some(p => p.parent_code === code);
                if (!hasKidsFetched) {
                    await fetchChildren(code);
                }
            } else {
                // Si es un PRODUCTO, cargar sus actividades relacionadas
                if (!relatedActivities[code]) {
                    await fetchRelatedActivities(code);
                }
            }
        }
        setExpandedNodes(newExpanded);
    };

    const renderProductRow = (item: CFDIProductService, depth: number) => {
        const canHaveChildren = item.level !== 'PRODUCT';
        const isExpanded = expandedNodes.has(item.code);
        const children = products.filter(p => p.parent_code === item.code);
        const related = relatedActivities[item.code] || [];

        return (
            <div key={item.code} style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                    onClick={() => toggleNode(item.code, item.level || 'PRODUCT')}
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
                        <div style={{
                            color: isExpanded ? 'var(--primary-base)' : '#64748b',
                            transition: 'transform 0.2s',
                            transform: isExpanded ? 'rotate(90deg)' : 'none',
                            display: 'flex',
                            alignItems: 'center'
                        }}>
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
                            minWidth: '80px',
                            textAlign: 'center'
                        }}>
                            {item.code}
                        </div>

                        <span style={{
                            fontSize: '13px',
                            fontWeight: isExpanded ? '700' : '500',
                            color: isExpanded ? 'white' : '#94a3b8'
                        }}>
                            {item.name}
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {item.level && (
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
                                {item.level}
                            </span>
                        )}
                        {related.length > 0 && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                border: '1px solid rgba(99, 102, 241, 0.2)'
                            }}>
                                <Users size={12} color="var(--primary-base)" />
                                <span style={{ fontSize: '10px', fontWeight: '900', color: 'var(--primary-base)' }}>{related.length}</span>
                            </div>
                        )}
                    </div>
                </div>

                {isExpanded && (
                    <div style={{
                        padding: canHaveChildren ? '4px 0' : '20px',
                        backgroundColor: 'rgba(15, 23, 42, 0.3)',
                        borderLeft: '3px solid var(--primary-base)',
                        marginLeft: `${depth * 24}px`,
                        marginBottom: '8px',
                        borderRadius: '0 0 12px 12px',
                        borderBottom: '1px solid rgba(99, 102, 241, 0.1)'
                    }} className="fade-in">
                        {canHaveChildren ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {children.map(child => renderProductRow(child, depth + 1))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ padding: '8px', backgroundColor: 'var(--primary-light)', borderRadius: '10px', color: 'var(--primary-base)' }}>
                                        <BookOpen size={18} />
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
                                        Configuración fiscal sugerida para el catálogo de productos y servicios del SAT (CFDI 4.0).
                                    </div>
                                </div>

                                {loadingActivities[item.code] ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                                        Cargando actividades relacionadas...
                                    </div>
                                ) : related.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', marginTop: '8px' }}>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '100px 1fr 100px 80px',
                                            gap: '12px',
                                            padding: '8px 16px',
                                            fontSize: '10px',
                                            fontWeight: '900',
                                            color: '#64748b',
                                            textTransform: 'uppercase',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)'
                                        }}>
                                            <span>Código SCIAN</span>
                                            <span>Actividad Económica</span>
                                            <span style={{ textAlign: 'center' }}>Materialidad</span>
                                            <span style={{ textAlign: 'right' }}>Acciones</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            {related.map(rel => (
                                                <div
                                                    key={rel.activity_code}
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
                                                            {rel.activity_code}
                                                        </span>
                                                        <span style={{ fontSize: '9px', color: '#64748b' }}>SCIAN</span>
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ color: '#e2e8f0', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={rel.cat_economic_activities.name}>
                                                            {rel.cat_economic_activities.name}
                                                        </div>
                                                        <div style={{ fontSize: '9px', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }} title={rel.reason}>
                                                            {rel.reason}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{
                                                            fontSize: '9px',
                                                            padding: '3px 8px',
                                                            borderRadius: '6px',
                                                            background: rel.matching_score >= 1.0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                                                            color: rel.matching_score >= 1.0 ? '#10b981' : 'var(--primary-base)',
                                                            fontWeight: '800',
                                                            border: `1px solid ${rel.matching_score >= 1.0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
                                                            textAlign: 'center'
                                                        }}>
                                                            {rel.matching_score >= 1.0 ? 'PRINCIPAL' : `SCORE: ${rel.matching_score.toFixed(2)}`}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', padding: '10px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                        No se encontraron actividades económicas relacionadas para este producto.
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                                    <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>IVA Trasladado</div>
                                        <div style={{ fontSize: '11px', color: item.includes_iva_transfered ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                                            {item.includes_iva_transfered ? 'SÍ INCLUYE' : 'NO INCLUYE'}
                                        </div>
                                    </div>
                                    <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>IEPS Trasladado</div>
                                        <div style={{ fontSize: '11px', color: item.includes_ieps_transfered ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                                            {item.includes_ieps_transfered ? 'SÍ INCLUYE' : 'NO INCLUYE'}
                                        </div>
                                    </div>
                                </div>

                                {item.similar_words && (
                                    <div style={{ padding: '12px', backgroundColor: 'rgba(99, 102, 241, 0.05)', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                                        <div style={{ fontSize: '9px', fontWeight: '900', color: 'var(--primary-base)', textTransform: 'uppercase', marginBottom: '4px' }}>Palabras Similares / Búsqueda</div>
                                        <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.5' }}>
                                            {item.similar_words}
                                        </div>
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
        ? products
        : products.filter(p => p.level === 'DIVISION');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Search & Stats Header */}
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
                    <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary-base)', opacity: 0.5 }} size={20} />
                    <input
                        type="text"
                        placeholder="Buscar en la taxonomía SAT (División, Grupo, Clase)..."
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
                        <div style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Total Catálogo</div>
                        <div style={{ fontSize: '16px', fontWeight: '900', color: 'white' }}>{products.length.toLocaleString()}</div>
                    </div>
                    <div style={{ padding: '10px 20px', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: '9px', fontWeight: '900', color: 'var(--primary-base)', textTransform: 'uppercase', marginBottom: '2px' }}>Divisiones</div>
                        <div style={{ fontSize: '16px', fontWeight: '900', color: 'white' }}>{products.filter(p => p.level === 'DIVISION').length}</div>
                    </div>
                </div>
            </div>

            {/* List Area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {loading ? (
                    [...Array(8)].map((_, i) => (
                        <div key={i} className="glass-card" style={{ height: '56px', opacity: 0.5, marginBottom: '4px' }}></div>
                    ))
                ) : filtered.length === 0 ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '80px 0',
                        backgroundColor: 'rgba(15, 23, 42, 0.2)',
                        borderRadius: '32px',
                        border: '1px dashed rgba(255, 255, 255, 0.1)',
                        gap: '16px'
                    }}>
                        <Search size={40} style={{ color: '#334155' }} />
                        <p style={{ color: '#64748b' }}>No se encontraron coincidencias para "{searchTerm}"</p>
                    </div>
                ) : (
                    filtered.map((item) => renderProductRow(item, 0))
                )}
            </div>

            {/* Compliance Footer */}
            <div style={{
                padding: '20px',
                borderRadius: '16px',
                backgroundColor: 'rgba(245, 158, 11, 0.05)',
                border: '1px solid rgba(245, 158, 11, 0.1)',
                display: 'flex',
                gap: '16px',
                alignItems: 'center'
            }}>
                <div style={{ padding: '10px', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', color: '#f59e0b' }}>
                    <AlertCircle size={20} />
                </div>
                <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.5', margin: 0 }}>
                    <strong style={{ color: '#f59e0b', marginRight: '8px', textTransform: 'uppercase', fontSize: '9px', fontWeight: '900' }}>Integridad Fiscal:</strong>
                    Navegue por Divisiones y Grupos para encontrar la Clase correcta. La precisión en el código de Producto/Servicio evita discrepancias en auditorías del SAT.
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

export default ProductsServicesTab;
