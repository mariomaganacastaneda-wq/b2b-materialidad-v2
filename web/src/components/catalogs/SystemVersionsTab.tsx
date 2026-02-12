import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    History,
    Sparkles,
    Wrench,
    ShieldCheck,
    Zap,
    ChevronDown,
    ChevronUp,
    Code2,
    Calendar,
    ArrowLeftRight
} from 'lucide-react';
import type { SystemVersion } from '../../types';

const SystemVersionsTab = () => {
    const [versions, setVersions] = useState<SystemVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set(['v1.5.0'])); // Expand latest by default

    const fetchVersions = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('sys_versions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setVersions(data || []);
        } catch (err: any) {
            console.error('Error fetching versions:', err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVersions();
    }, []);

    const toggleTag = (tag: string) => {
        const newExpanded = new Set(expandedTags);
        if (newExpanded.has(tag)) newExpanded.delete(tag);
        else newExpanded.add(tag);
        setExpandedTags(newExpanded);
    };

    const getIconForType = (type: string) => {
        switch (type) {
            case 'feat': return <Sparkles size={12} style={{ color: '#10b981' }} />;
            case 'fix': return <Wrench size={12} style={{ color: '#ef4444' }} />;
            case 'ui': return <Zap size={12} style={{ color: '#6366f1' }} />;
            case 'perf': return <ShieldCheck size={12} style={{ color: '#f59e0b' }} />;
            default: return <Code2 size={12} />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'feat': return 'rgba(16, 185, 129, 0.1)';
            case 'fix': return 'rgba(239, 68, 68, 0.1)';
            case 'ui': return 'rgba(99, 102, 241, 0.1)';
            case 'perf': return 'rgba(245, 158, 11, 0.1)';
            default: return 'rgba(255, 255, 255, 0.05)';
        }
    };

    const getTypeText = (type: string) => {
        switch (type) {
            case 'feat': return 'NUEVO';
            case 'fix': return 'ARREGLO';
            case 'ui': return 'DISEÑO';
            case 'perf': return 'PERF';
            default: return 'OTRO';
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Timeline Header */}
            <div style={{
                padding: '24px',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '24px',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
            }}>
                <div style={{ padding: '12px', backgroundColor: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary-base)' }}>
                    <History size={24} />
                </div>
                <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '900', color: 'white', margin: 0 }}>Historial de Versiones</h3>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Registro cronológico de evoluciones y despliegues técnicos del sistema.</p>
                </div>
            </div>

            {/* Versions List */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Timeline vertical bar */}
                <div style={{
                    position: 'absolute',
                    left: '27px',
                    top: '24px',
                    bottom: '24px',
                    width: '1px',
                    background: 'linear-gradient(to bottom, var(--primary-base), rgba(255,255,255,0.05))',
                    zIndex: 0
                }}></div>

                {loading ? (
                    [...Array(3)].map((_, i) => (
                        <div key={i} className="glass-card" style={{ height: '100px', marginLeft: '56px', opacity: 0.5 }}></div>
                    ))
                ) : versions.length === 0 ? (
                    <div style={{ marginLeft: '56px', padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        No se han registrado versiones aún.
                    </div>
                ) : (
                    versions.map((version, index) => {
                        const isExpanded = expandedTags.has(version.tag);
                        const isLatest = index === 0;

                        return (
                            <div key={version.tag} style={{ position: 'relative', zIndex: 1, marginLeft: '56px' }}>
                                {/* Timeline Dot */}
                                <div style={{
                                    position: 'absolute',
                                    left: '-36px',
                                    top: '20px',
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '50%',
                                    backgroundColor: isLatest ? 'var(--primary-base)' : '#1e293b',
                                    border: `3px solid ${isLatest ? 'var(--primary-light)' : 'rgba(255,255,255,0.05)'}`,
                                    boxShadow: isLatest ? '0 0 15px var(--primary-base)' : 'none'
                                }}></div>

                                <div
                                    className="glass-card"
                                    style={{
                                        padding: '0',
                                        overflow: 'hidden',
                                        border: isLatest ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid rgba(255,255,255,0.05)',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <div
                                        onClick={() => toggleTag(version.tag)}
                                        style={{
                                            padding: '20px 24px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            backgroundColor: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{
                                                        fontSize: '14px',
                                                        fontWeight: '900',
                                                        color: isLatest ? 'var(--primary-base)' : 'white',
                                                        letterSpacing: '0.05em'
                                                    }}>
                                                        {version.tag}
                                                    </span>
                                                    {isLatest && (
                                                        <span style={{
                                                            fontSize: '9px',
                                                            fontWeight: '900',
                                                            backgroundColor: 'var(--primary-light)',
                                                            color: 'var(--primary-base)',
                                                            padding: '2px 8px',
                                                            borderRadius: '4px'
                                                        }}>ACTUAL</span>
                                                    )}
                                                </div>
                                                <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'white', margin: '4px 0 0' }}>{version.name}</h4>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                                                <Calendar size={14} />
                                                <span style={{ fontSize: '12px' }}>
                                                    {new Date(version.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                            {isExpanded ? <ChevronUp size={20} color="#334155" /> : <ChevronDown size={20} color="#334155" />}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            <div style={{
                                                fontSize: '14px',
                                                color: '#94a3b8',
                                                lineHeight: '1.6',
                                                padding: '16px',
                                                backgroundColor: 'rgba(15, 23, 42, 0.3)',
                                                borderRadius: '12px',
                                                border: '1px solid rgba(255,255,255,0.03)'
                                            }}>
                                                {version.description}
                                            </div>

                                            <div>
                                                <div style={{ fontSize: '10px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '20px', height: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
                                                    Bitácora de Cambios
                                                    <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {version.changelog.map((change, idx) => (
                                                        <div key={idx} style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '12px',
                                                            padding: '8px 12px',
                                                            borderRadius: '8px',
                                                            backgroundColor: 'rgba(255,255,255,0.01)'
                                                        }}>
                                                            <div style={{
                                                                padding: '4px 8px',
                                                                borderRadius: '6px',
                                                                backgroundColor: getTypeColor(change.type),
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px'
                                                            }}>
                                                                {getIconForType(change.type)}
                                                                <span style={{ fontSize: '8px', fontWeight: '900', color: 'white' }}>{getTypeText(change.type)}</span>
                                                            </div>
                                                            <span style={{ fontSize: '13px', color: '#cbd5e1' }}>{change.desc}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {version.rollback_script && (
                                                <div style={{
                                                    marginTop: '8px',
                                                    padding: '16px',
                                                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                                                    border: '1px solid rgba(239, 68, 68, 0.1)',
                                                    borderRadius: '12px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <ArrowLeftRight size={18} color="#ef4444" style={{ opacity: 0.6 }} />
                                                        <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '700' }}>Reversión Técnica Disponible</span>
                                                    </div>
                                                    <button
                                                        onClick={() => alert(`Script de rollback para ${version.tag}:\n\n${version.rollback_script}`)}
                                                        style={{
                                                            padding: '6px 12px',
                                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            color: '#ef4444',
                                                            fontSize: '11px',
                                                            fontWeight: '800',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        VER SCRIPT
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <style>{`
                .glass-card:hover {
                    box-shadow: 0 10px 40px -10px rgba(0,0,0,0.5);
                    border-color: rgba(255,255,255,0.1);
                }
            `}</style>
        </div>
    );
};

export default SystemVersionsTab;
