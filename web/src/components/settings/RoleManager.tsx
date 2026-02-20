import React, { useState, useEffect } from 'react';
import { Shield, Plus, X, Check, ChevronRight } from 'lucide-react';

interface RoleManagerProps {
    supabase: any;
    currentUser: any;
}

const AVAILABLE_SCREENS = [
    // Nivel Alto (Administrativos/Configuración)
    { id: 'settings_empresa', label: 'Empresa', category: 'Configuración Administrativa (Sensibilidad Alta)' },
    { id: 'settings_usuarios', label: 'Usuarios', category: 'Configuración Administrativa (Sensibilidad Alta)' },
    { id: 'settings_roles', label: 'Roles', category: 'Configuración Administrativa (Sensibilidad Alta)' },
    { id: 'security', label: 'Centro de Seguridad', category: 'Configuración Administrativa (Sensibilidad Alta)' },

    // Operación Base
    { id: 'dashboard', label: 'Dashboard', category: 'Operación General' },

    // Nivel Medio (Manejo de Dinero/Fiscal)
    { id: 'facturas', label: 'Facturación CFDI', category: 'Gestión Financiera (Sensibilidad Media)' },
    { id: 'bancos', label: 'Cuentas Bancarias', category: 'Gestión Financiera (Sensibilidad Media)' },
    { id: 'materialidad', label: 'Materialidad Fiscal', category: 'Gestión Financiera (Sensibilidad Media)' },
    { id: 'catalogos-sat', label: 'Catálogos SAT', category: 'Gestión Financiera (Sensibilidad Media)' },

    // Nivel Bajo (Comercialización/Ventas)
    { id: 'cotizaciones', label: 'Cotizaciones', category: 'Gestión Comercial (Sensibilidad Baja)' },
    { id: 'proformas', label: 'Proformas / Pre-facturas', category: 'Gestión Comercial (Sensibilidad Baja)' },
    { id: 'evidencia', label: 'Evidencia Fotográfica', category: 'Gestión Comercial (Sensibilidad Baja)' },
    { id: 'reportes', label: 'Centro de Reportes', category: 'Gestión Comercial (Sensibilidad Baja)' },
];

export const RoleManager: React.FC<RoleManagerProps> = ({ supabase, currentUser }) => {
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingRole, setEditingRole] = useState<any>(null);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [newRole, setNewRole] = useState({ id: '', name: '', description: '' });
    const [saving, setSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
        setStatusMsg({ text, type });
        setTimeout(() => setStatusMsg(null), 3000);
    };

    const isAdmin = currentUser?.role === 'ADMIN';

    const loadRoles = async () => {
        setLoading(true);
        try {
            const { data: rolesData, error: rolesError } = await supabase
                .from('cat_roles')
                .select('*')
                .order('name');

            if (rolesError) throw rolesError;

            const { data: profilesData } = await supabase.from('profiles').select('role');
            const counts: { [key: string]: number } = {};
            profilesData?.forEach((p: any) => {
                if (p.role) counts[p.role] = (counts[p.role] || 0) + 1;
            });

            const enrichedRoles = rolesData.map((r: any) => ({
                ...r,
                user_count: counts[r.id] || 0
            }));

            setRoles(enrichedRoles);
        } catch (err: any) {
            console.error('Error loading roles:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadPermissions = async (roleId: string) => {
        const { data, error } = await supabase
            .from('role_permissions')
            .select('*')
            .eq('role_id', roleId);

        if (error) console.error('Error loading permissions:', error);

        const initializedPermissions = AVAILABLE_SCREENS.map(screen => {
            const existing = data?.find((p: any) => p.screen_id === screen.id);
            return existing || {
                role_id: roleId,
                screen_id: screen.id,
                can_view: false,
                can_create: false,
                can_edit: false,
                can_delete: false
            };
        });

        setPermissions(initializedPermissions);
    };

    useEffect(() => {
        loadRoles();
    }, [supabase]);

    const handleAddRole = async () => {
        if (!newRole.id.trim() || !newRole.name.trim()) return;
        setSaving(true);
        try {
            const id = newRole.id.toUpperCase().replace(/\s+/g, '_');
            const { error } = await supabase.from('cat_roles').insert({
                id,
                name: newRole.name,
                description: newRole.description,
                is_system: false
            });

            if (error) throw error;
            setIsAdding(false);
            setNewRole({ id: '', name: '', description: '' });
            showStatus('Rol creado correctamente.');
            loadRoles();
        } catch (err: any) {
            showStatus('Error: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateRole = async () => {
        if (!editingRole || !editingRole.name.trim()) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('cat_roles')
                .update({
                    name: editingRole.name,
                    description: editingRole.description
                })
                .eq('id', editingRole.id);

            if (error) throw error;

            showStatus('Detalles del rol actualizados correctamente.');
            loadRoles(); // Para reflejar el nombre nuevo en la lista izq
        } catch (err: any) {
            showStatus('Error al actualizar rol: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDuplicateRole = async () => {
        if (!editingRole) return;
        setSaving(true);
        try {
            // 1. Create a new Unique ID
            const newId = `${editingRole.id}_COPY_${Math.floor(Math.random() * 1000)}`;
            const newName = `${editingRole.name} (Copia)`;

            // 2. Insert the new role
            const { error: roleError } = await supabase.from('cat_roles').insert({
                id: newId,
                name: newName,
                description: `Copia exacta de ${editingRole.name}`,
                is_system: false
            });

            if (roleError) throw roleError;

            // 3. Fetch current permissions of the selected role (we use state `permissions`)
            const toSave = permissions.map(p => ({
                role_id: newId,
                screen_id: p.screen_id,
                can_view: p.can_view,
                can_create: p.can_create,
                can_edit: p.can_edit,
                can_delete: p.can_delete
            }));

            // 4. Insert copied permissions
            if (toSave.length > 0) {
                const { error: permError } = await supabase.from('role_permissions').insert(toSave);
                if (permError) throw permError;
            }

            showStatus('Rol duplicado correctamente.');
            loadRoles();
        } catch (err: any) {
            showStatus('Error al duplicar rol: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSavePermissions = async () => {
        if (!editingRole) return;
        setSaving(true);
        try {
            const toSave = permissions.map(p => ({
                role_id: p.role_id,
                screen_id: p.screen_id,
                can_view: p.can_view,
                can_create: p.can_create,
                can_edit: p.can_edit,
                can_delete: p.can_delete
            }));

            const { error } = await supabase
                .from('role_permissions')
                .upsert(toSave, { onConflict: 'role_id,screen_id' });

            if (error) throw error;

            showStatus('Permisos guardados correctamente.');
            setEditingRole(null);
        } catch (err: any) {
            showStatus('Error al guardar permisos: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const togglePermission = (screenId: string, field: string) => {
        setPermissions(prev => prev.map(p =>
            p.screen_id === screenId ? { ...p, [field]: !p[field] } : p
        ));
    };

    if (!isAdmin) return <div className="glass-card">Acceso denegado. Se requieren privilegios de Administrador.</div>;

    return (
        <div style={{ position: 'relative' }}>
            {/* NOTIFICACIONES FLOTANTES */}
            {statusMsg && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    backgroundColor: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    zIndex: 10000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(8px)'
                }}>
                    {statusMsg.type === 'success' ? <Check size={18} /> : <X size={18} />}
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>{statusMsg.text}</span>
                </div>
            )}

            <div key="role-grid-container" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
                {/* LISTA DE ROLES */}
                <div key="roles-list-panel" className="glass-card" style={{ height: 'fit-content', background: 'rgba(15, 23, 42, 0.6)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'white' }}>Roles del Sistema</h2>
                        {!editingRole && (
                            <button onClick={() => setIsAdding(true)} className="primary-button" style={{ padding: '8px' }}>
                                <Plus size={18} />
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Cargando roles...</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {roles.map(r => (
                                <div
                                    key={r.id}
                                    onClick={() => { setEditingRole(r); loadPermissions(r.id); }}
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: '10px',
                                        backgroundColor: editingRole?.id === r.id ? 'var(--primary-glow)' : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${editingRole?.id === r.id ? 'var(--primary-base)' : 'rgba(255,255,255,0.05)'}`,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '14px', color: 'white' }}>{r.name}</div>
                                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{r.user_count} usuarios</div>
                                    </div>
                                    <ChevronRight size={16} color={editingRole?.id === r.id ? 'white' : '#475569'} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* MATRIZ DE PERMISOS / ESTADO VACÍO */}
                <div key="side-content-panel" style={{ minHeight: '400px' }}>
                    {editingRole ? (
                        <div key={`matrix-${editingRole.id}`} className="glass-card" style={{ background: 'rgba(15, 23, 42, 0.4)', height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <input
                                            type="text"
                                            value={editingRole.name}
                                            onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                                            style={{ backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: '20px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px' }}
                                        />
                                        {!editingRole.is_system && (
                                            <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', color: '#94a3b8' }}>Personalizado</span>
                                        )}
                                    </div>
                                    <div style={{ marginTop: '4px' }}>
                                        <input
                                            type="text"
                                            value={editingRole.description || ''}
                                            onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                                            placeholder="Descripción del rol..."
                                            style={{ width: '300px', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '13px', padding: '4px 8px', borderRadius: '4px' }}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <button onClick={handleDuplicateRole} disabled={saving} className="secondary-button" style={{ minWidth: '160px', height: '44px', padding: '0 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                                        {saving ? '...' : 'Duplicar'}
                                    </button>
                                    <button onClick={handleUpdateRole} disabled={saving} className="primary-button" style={{ minWidth: '160px', height: '44px', padding: '0 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                                        {saving ? '...' : 'Actualizar Nombre'}
                                    </button>
                                    <div style={{ width: '1px', height: '30px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 4px' }}></div>
                                    <button onClick={handleSavePermissions} disabled={saving} className="primary-button" style={{ minWidth: '160px', height: '44px', padding: '0 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: 'none', borderRadius: '6px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                                        {saving ? 'Guardando...' : 'Guardar Permisos'}
                                    </button>
                                    <button onClick={() => setEditingRole(null)} className="secondary-button" style={{ minWidth: '160px', height: '44px', padding: '0 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                                        Cerrar
                                    </button>
                                </div>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                                    <thead>
                                        <tr style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            <th style={{ textAlign: 'left', padding: '0 16px' }}>Módulo</th>
                                            <th style={{ textAlign: 'center', padding: '0 8px' }}>Ver</th>
                                            <th style={{ textAlign: 'center', padding: '0 8px' }}>Crear</th>
                                            <th style={{ textAlign: 'center', padding: '0 8px' }}>Editar</th>
                                            <th style={{ textAlign: 'center', padding: '0 8px' }}>Borrar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from(new Set(AVAILABLE_SCREENS.map(s => s.category))).map(category => (
                                            <React.Fragment key={category}>
                                                <tr>
                                                    <td colSpan={5} style={{ padding: '16px 16px 8px 16px', color: '#60a5fa', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                        {category}
                                                    </td>
                                                </tr>
                                                {AVAILABLE_SCREENS.filter(s => s.category === category).map(screen => {
                                                    const p = permissions.find(pm => pm.screen_id === screen.id);
                                                    if (!p) return null;
                                                    return (
                                                        <tr key={p.screen_id} style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                                            <td style={{ padding: '12px 16px', borderRadius: '10px 0 0 10px', fontWeight: '500', color: '#e2e8f0', fontSize: '14px', paddingLeft: '24px' }}>
                                                                {screen.label}
                                                            </td>
                                                            {['can_view', 'can_create', 'can_edit', 'can_delete'].map(field => (
                                                                <td key={field} style={{ textAlign: 'center', padding: '8px' }}>
                                                                    <div
                                                                        onClick={() => togglePermission(p.screen_id, field)}
                                                                        style={{
                                                                            width: '24px',
                                                                            height: '24px',
                                                                            borderRadius: '6px',
                                                                            backgroundColor: p[field] ? 'var(--primary-base)' : 'rgba(255,255,255,0.05)',
                                                                            border: `1px solid ${p[field] ? 'var(--primary-base)' : 'rgba(255,255,255,0.1)'}`,
                                                                            margin: '0 auto',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            cursor: 'pointer',
                                                                            transition: 'all 0.2s'
                                                                        }}
                                                                    >
                                                                        {p[field] && <Check size={14} color="white" />}
                                                                    </div>
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div key="empty-state" style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '20px' }}>
                            <div style={{ textAlign: 'center', color: '#475569' }}>
                                <Shield size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                                <p style={{ fontSize: '14px' }}>Selecciona un rol para configurar accesos</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL CREACIÓN (Z-INDEX 9999) */}
            {isAdding && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '400px', background: '#0f172a', border: '1px solid #334155' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0, color: 'white' }}>Crear Nuevo Rol</h3>
                            <button onClick={() => setIsAdding(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="input-group">
                                <label style={{ color: '#94a3b8', fontSize: '12px' }}>ID Único (Ej: AUDITOR)</label>
                                <input
                                    type="text"
                                    placeholder="ID_DEL_ROL"
                                    value={newRole.id}
                                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid #334155', color: 'white', padding: '10px', borderRadius: '8px' }}
                                    onChange={(e) => setNewRole({ ...newRole, id: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div className="input-group">
                                <label style={{ color: '#94a3b8', fontSize: '12px' }}>Nombre Legible</label>
                                <input
                                    type="text"
                                    placeholder="Nombre del rol"
                                    value={newRole.name}
                                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid #334155', color: 'white', padding: '10px', borderRadius: '8px' }}
                                    onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                                />
                            </div>
                            <div className="input-group">
                                <label style={{ color: '#94a3b8', fontSize: '12px' }}>Descripción</label>
                                <textarea
                                    placeholder="Descripción de responsabilidades"
                                    value={newRole.description}
                                    onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                                    style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid #334155', color: 'white' }}
                                />
                            </div>
                            <button onClick={handleAddRole} disabled={saving} className="primary-button" style={{ justifyContent: 'center', width: '100%' }}>
                                {saving ? 'Procesando...' : 'Confirmar Creación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
