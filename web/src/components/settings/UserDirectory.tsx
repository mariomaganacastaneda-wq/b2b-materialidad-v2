import React, { useState, useEffect } from 'react';
import { X, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { updateSupabaseAuth } from '../../lib/supabase';
import { UserList } from './UserList';
import { UserDetails } from './UserDetails';

interface UserDirectoryProps {
    users: any[];
    setUsers: (users: any[]) => void;
    supabase: any;
    currentUser: any;
    setImpersonatedUser?: (user: any) => void;
    realUserProfile?: any;
}

const OrgAccessList: React.FC<{ profileId: string; supabase: any }> = ({ profileId, supabase }) => {
    const [orgs, setOrgs] = React.useState<any[]>([]);
    const [userAccess, setUserAccess] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [updating, setUpdating] = React.useState<string | null>(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    const { getToken } = useAuth();

    React.useEffect(() => {
        let active = true;
        const fetchData = async () => {
            try {
                const { data: orgData, error: orgError } = await supabase.from('organizations').select('id, name, rfc').order('name');
                if (orgError) throw orgError;

                const { data: accessData, error: accessError } = await supabase.from('user_organization_access').select('*').eq('profile_id', profileId);
                if (accessError) throw accessError;

                if (active) {
                    setOrgs(orgData || []);
                    setUserAccess(accessData || []);
                }
            } catch (err: any) {
                if (active) console.error('UserDirectory Error [fetch]:', err);
            } finally {
                if (active) setLoading(false);
            }
        };
        fetchData();
        return () => { active = false; };
    }, [profileId, supabase]);

    const togglePermission = async (orgId: string, field: 'can_manage_quotations' | 'can_manage_payments') => {
        const existingAccess = userAccess.find(a => a.organization_id === orgId);
        const newValue = existingAccess ? !existingAccess[field] : true;
        const otherField = field === 'can_manage_quotations' ? 'can_manage_payments' : 'can_manage_quotations';

        // Optimistic update
        const previousAccess = [...userAccess];
        if (existingAccess) {
            setUserAccess(userAccess.map(a => a.organization_id === orgId ? { ...a, [field]: newValue } : a));
        } else {
            setUserAccess([...userAccess, {
                organization_id: orgId,
                [field]: newValue,
                [otherField]: false,
                profile_id: profileId,
                is_owner: false
            }]);
        }


        try {
            // 0. Sincronización Forzada de Identidad antes del Upsert
            let token: string | null = null;
            try {
                token = await getToken({ template: 'supabase' });
            } catch (err) {
                console.warn('UserDirectory: Supabase JWT template not found, falling back to default token.');
                token = await getToken();
            }

            if (token) updateSupabaseAuth(token);

            const upsertData = {
                profile_id: profileId,
                organization_id: orgId,
                [field]: newValue,
                [otherField]: existingAccess ? !!existingAccess[otherField] : false,
                is_owner: existingAccess ? !!existingAccess.is_owner : false
            };

            const { data: functionData, error: functionError } = await supabase.functions.invoke('manage-user-access', {
                body: {
                    profile_id: profileId,
                    access_data: [upsertData]
                }
            });

            if (functionError) throw functionError;
            const data = functionData?.data?.[0];

            if (data) {
                setUserAccess(prev => {
                    const exists = prev.some(a => a.organization_id === orgId);
                    if (exists) {
                        return prev.map(a => a.organization_id === orgId ? data : a);
                    }
                    return [...prev, data];
                });
            }
        } catch (err: any) {
            console.error('[togglePermission] Failure:', err);
            setUserAccess(previousAccess);
            alert('Error al actualizar permisos: ' + (err.message || 'Error desconocido'));
        }
    };

    const bulkUpdate = async (type: 'issuer' | 'client') => {
        const field = type === 'issuer' ? 'can_manage_quotations' : 'can_manage_payments';
        const otherField = type === 'issuer' ? 'can_manage_payments' : 'can_manage_quotations';

        // Determinar si todas las ORGs visibles ya tienen este permiso
        const allEnabled = orgs.length > 0 && orgs.every(org => {
            const access = userAccess.find(a => a.organization_id === org.id);
            return !!access?.[field];
        });

        // El nuevo valor será el opuesto: si todas están enabled, las quitamos (false)
        const newValue = !allEnabled;

        setUpdating(type);

        console.log(`[bulkUpdate] ${newValue ? 'Enabling' : 'Disabling'} ${type} for profile ${profileId} across ${orgs.length} orgs.`);


        try {
            // 0. Sincronización Forzada de Identidad antes del Upsert
            let token: string | null = null;
            try {
                token = await getToken({ template: 'supabase' });
            } catch (err) {
                console.warn('UserDirectory: Supabase JWT template not found, falling back to default token.');
                token = await getToken();
            }

            if (token) updateSupabaseAuth(token);

            const upsertData = orgs.map(org => {
                const existing = userAccess.find(a => a.organization_id === org.id);

                return {
                    profile_id: profileId,
                    organization_id: org.id,
                    [field]: newValue,
                    [otherField]: existing ? !!existing[otherField] : false,
                    is_owner: existing ? !!existing.is_owner : false
                };
            });

            const { data: functionData, error: functionError } = await supabase.functions.invoke('manage-user-access', {
                body: {
                    profile_id: profileId,
                    access_data: upsertData
                }
            });

            if (functionError) throw functionError;
            const resultData = functionData?.data;

            // 2. Refrescar datos con token sincronizado
            const { data: freshData, error: refreshError } = await supabase
                .from('user_organization_access')
                .select('*')
                .eq('profile_id', profileId);

            if (refreshError) throw refreshError;
            setUserAccess(freshData || []);

        } catch (err: any) {
            console.error('[bulkUpdate] Failure:', err);
            alert('Error en actualización masiva: ' + (err.message || 'Error desconocido'));
        } finally {
            setUpdating(null);
        }
    };

    if (loading) return <div style={{ color: '#94a3b8', fontSize: '11px' }}>Cargando matriz de acceso...</div>;

    const filteredOrgs = orgs.filter(o =>
        !searchTerm ||
        o.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.rfc?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const isAllIssuer = orgs.length > 0 && orgs.every(o => userAccess.find(a => a.organization_id === o.id)?.can_manage_quotations);
    const isAllClient = orgs.length > 0 && orgs.every(o => userAccess.find(a => a.organization_id === o.id)?.can_manage_payments);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '5px' }}>
                <button
                    onClick={() => bulkUpdate('issuer')}
                    disabled={!!updating}
                    style={{
                        flex: 1,
                        padding: '6px',
                        fontSize: '10px',
                        backgroundColor: isAllIssuer ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                        color: isAllIssuer ? '#fca5a5' : '#a5b4fc',
                        border: `1px solid ${isAllIssuer ? 'rgba(239, 68, 68, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    {updating === 'issuer' ? '...' : (isAllIssuer ? 'Desmarcar Todas' : 'Todas como Emisora')}
                </button>
                <button
                    onClick={() => bulkUpdate('client')}
                    disabled={!!updating}
                    style={{
                        flex: 1,
                        padding: '6px',
                        fontSize: '10px',
                        backgroundColor: isAllClient ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: isAllClient ? '#fca5a5' : '#6ee7b7',
                        border: `1px solid ${isAllClient ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    {updating === 'client' ? '...' : (isAllClient ? 'Desmarcar Todas' : 'Todas como Cliente')}
                </button>
            </div>

            {/* Búsqueda de Empresa */}
            <div style={{ position: 'relative', marginBottom: '5px' }}>
                <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                    type="text"
                    placeholder="Buscar empresa por nombre o RFC..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '8px 12px 8px 30px',
                        fontSize: '11px',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        color: 'white',
                        outline: 'none'
                    }}
                />
                {searchTerm && (
                    <X size={12} onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', cursor: 'pointer' }} />
                )}
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #334155', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1e293b', zIndex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                        <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <th style={{ textAlign: 'left', padding: '10px' }}>Empresa / RFC</th>
                            <th style={{ textAlign: 'center', padding: '10px', width: '70px' }}>Emisora</th>
                            <th style={{ textAlign: 'center', padding: '10px', width: '70px' }}>Cliente</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrgs.length > 0 ? filteredOrgs.map(org => {
                            const access = userAccess.find(a => a.organization_id === org.id);
                            return (
                                <tr key={org.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '8px 10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!confirm(`¿Estás seguro de ELIMINAR PERMANENTEMENTE a ${org.name}? Esta acción borrará la empresa y todos sus datos relacionados (facturas, pagos, etc.) de TODA la plataforma y no se puede deshacer.`)) return;

                                                    try {
                                                        const { error } = await supabase.from('organizations').delete().eq('id', org.id);
                                                        if (error) throw error;

                                                        // Optimistically remove from UI
                                                        setOrgs(orgs.filter(o => o.id !== org.id));
                                                        setUserAccess(userAccess.filter(a => a.organization_id !== org.id));
                                                    } catch (err: any) {
                                                        console.error('Error deleting organization:', err);
                                                        alert('Error al eliminar empresa: ' + err.message);
                                                    }
                                                }}
                                                title="Eliminar Empresa de toda la plataforma"
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#ef4444',
                                                    cursor: 'pointer',
                                                    padding: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderRadius: '4px',
                                                    opacity: 0.7,
                                                    transition: 'opacity 0.2s',
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                                onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ fontWeight: '600', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }} title={org.name}>{org.name || 'Sin Nombre'}</div>
                                                <div style={{ fontSize: '9px', color: '#64748b' }}>{org.rfc || 'Sin RFC'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={!!access?.can_manage_quotations}
                                            onChange={() => togglePermission(org.id, 'can_manage_quotations')}
                                            style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                                        />
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={!!access?.can_manage_payments}
                                            onChange={() => togglePermission(org.id, 'can_manage_payments')}
                                            style={{ cursor: 'pointer', transform: 'scale(1.2)', accentColor: '#10b981' }}
                                        />
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                                    No se encontraron empresas.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const UserDirectory: React.FC<UserDirectoryProps> = ({ users, setUsers, supabase, currentUser, setImpersonatedUser, realUserProfile }) => {
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [roles, setRoles] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const isAdmin = currentUser?.role === 'ADMIN';
    const { getToken } = useAuth();

    useEffect(() => {
        const fetchRoles = async () => {
            const { data } = await supabase.from('cat_roles').select('*').order('name');
            setRoles(data || []);
        };
        fetchRoles();
    }, [supabase]);

    const handleUpdateUser = async (payload: any) => {
        if (!selectedUser) return;
        try {
            // Sincronización Forzada
            let token: string | null = null;
            try {
                token = await getToken({ template: 'supabase' });
            } catch (err) {
                console.warn('UserDirectory: Supabase JWT template not found, falling back to default token.');
                token = await getToken();
            }

            if (token) updateSupabaseAuth(token);

            const { error } = await supabase.from('profiles').update(payload).eq('id', selectedUser.id);
            if (error) throw error;

            const updatedUser = { ...selectedUser, ...payload };
            setUsers(users.map((u: any) => u.id === selectedUser.id ? updatedUser : u));
            setSelectedUser(updatedUser);
        } catch (err: any) {
            console.error('Error updating profile:', err);
            alert('Error al actualizar perfil: ' + err.message);
        }
    };

    return (
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '32px' }}>
            <UserList
                users={users}
                selectedUserId={selectedUser?.id}
                onSelectUser={setSelectedUser}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
            />

            <UserDetails
                key={selectedUser?.id || 'empty'}
                user={selectedUser}
                roles={roles}
                isAdmin={isAdmin}
                currentUser={currentUser}
                onUpdate={handleUpdateUser}
                OrgAccessList={OrgAccessList}
                supabase={supabase}
                setImpersonatedUser={setImpersonatedUser}
                realUserProfile={realUserProfile}
            />
        </div>
    );
};

