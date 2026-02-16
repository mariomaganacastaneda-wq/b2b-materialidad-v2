import React from 'react';
import { Search, Filter, X } from 'lucide-react';

interface CompanyListProps {
    orgs: any[];
    selectedOrgId: string | null;
    onSelectOrg: (org: any) => void;
    filters: {
        searchTerm: string;
        setSearchTerm: (term: string) => void;
        activityFilter: string;
        setActivityFilter: (activity: string) => void;
        typeFilter: any;
        setTypeFilter: (type: any) => void;
        csfFilter: any;
        setCsfFilter: (csf: any) => void;
    };
    uniqueActivities: string[];
}

export const CompanyList: React.FC<CompanyListProps> = ({
    orgs,
    selectedOrgId,
    onSelectOrg,
    filters,
    uniqueActivities,
}) => {
    const {
        searchTerm,
        setSearchTerm,
        activityFilter,
        setActivityFilter,
        typeFilter,
        setTypeFilter,
        csfFilter,
        setCsfFilter,
    } = filters;

    return (
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--primary-color)' }}>Empresas</h3>
                    <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', color: '#64748b' }}>{orgs.length}</span>
                </div>
                <button onClick={() => onSelectOrg(null)} className="secondary-button" style={{ fontSize: '11px', padding: '6px 12px' }}>+ Registrar</button>
            </div>

            {/* --- SECCIÓN DE FILTROS --- */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                {/* Búsqueda */}
                <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                        type="text"
                        placeholder="Buscar por Nombre o RFC..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px 8px 32px', fontSize: '12px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white' }}
                    />
                    {searchTerm && (
                        <X size={14} onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', cursor: 'pointer' }} />
                    )}
                </div>

                {/* Filtro de Actividades */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Filter size={14} style={{ color: 'var(--primary-base)' }} />
                    <select
                        value={activityFilter}
                        onChange={(e) => setActivityFilter(e.target.value)}
                        style={{ flex: 1, padding: '4px 8px', fontSize: '11px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#cbd5e1', outline: 'none' }}
                    >
                        <option value="all">Todas las actividades</option>
                        {uniqueActivities.map(act => (
                            <option key={act} value={act}>{act.substring(0, 45)}{act.length > 45 ? '...' : ''}</option>
                        ))}
                    </select>
                </div>

                {/* Chips de Filtrado Rápido */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    <button
                        onClick={() => setTypeFilter(typeFilter === 'persona_moral' ? 'all' : 'persona_moral')}
                        style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '10px', border: '1px solid', borderColor: typeFilter === 'persona_moral' ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)', backgroundColor: typeFilter === 'persona_moral' ? 'rgba(99, 102, 241, 0.1)' : 'transparent', color: typeFilter === 'persona_moral' ? 'white' : '#64748b', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
                    >
                        Morales
                    </button>
                    <button
                        onClick={() => setTypeFilter(typeFilter === 'persona_fisica' ? 'all' : 'persona_fisica')}
                        style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '10px', border: '1px solid', borderColor: typeFilter === 'persona_fisica' ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)', backgroundColor: typeFilter === 'persona_fisica' ? 'rgba(99, 102, 241, 0.1)' : 'transparent', color: typeFilter === 'persona_fisica' ? 'white' : '#64748b', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
                    >
                        Físicas
                    </button>
                    <div style={{ width: '1px', height: '14px', backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', flexShrink: 0 }}></div>
                    <button
                        onClick={() => setCsfFilter(csfFilter === 'with' ? 'all' : 'with')}
                        style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '10px', border: '1px solid', borderColor: csfFilter === 'with' ? '#10b981' : 'rgba(255,255,255,0.1)', backgroundColor: csfFilter === 'with' ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: csfFilter === 'with' ? '#10b981' : '#64748b', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
                    >
                        Con CSF
                    </button>
                </div>
            </div>

            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {orgs.length > 0 ? (
                    orgs.map((org: any) => (
                        <div key={org.id} onClick={() => onSelectOrg(org)} style={{ padding: '16px 20px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)', backgroundColor: selectedOrgId === org.id ? 'var(--primary-glow)' : 'transparent', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: org.primary_color || '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                                {org.logo_url ? <img src={org.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="" /> : org.rfc?.substring(0, 2)}
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: selectedOrgId === org.id ? 'white' : '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>{org.rfc}</div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                        No se encontraron empresas con los filtros actuales.
                    </div>
                )}
            </div>
        </div>
    );
};
