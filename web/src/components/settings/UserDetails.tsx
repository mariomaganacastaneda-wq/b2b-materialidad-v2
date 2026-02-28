import React from 'react';
import { User, Shield, Activity, Mail, Trash2, Save, Eye, MessageCircle, Send } from 'lucide-react';
/* OrgAccessList is imported in the parent and passed or imported here? 
   Since it was in UserDirectory.tsx as a sub-component, I should probably move it to its own file or keep it in UserDirectory for now.
   Actually, the user asked to make it like CompanyDetails. Let's assume OrgAccessList stays available.
*/

interface UserDetailsProps {
    user: any;
    roles: any[];
    isAdmin: boolean;
    currentUser: any;
    onUpdate: (payload: any) => Promise<void>;
    onDelete?: (userId: string) => Promise<void>;
    OrgAccessList: React.FC<{ profileId: string; supabase: any }>;
    supabase: any;
    setImpersonatedUser?: (user: any) => void;
    realUserProfile?: any;
}

export const UserDetails: React.FC<UserDetailsProps> = ({
    user,
    roles,
    isAdmin,
    currentUser,
    onUpdate,
    onDelete,
    OrgAccessList,
    supabase,
    setImpersonatedUser,
    realUserProfile
}) => {
    const [localUser, setLocalUser] = React.useState<any>(user);

    if (!user) {
        return (
            <div className="glass-card" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px', flexDirection: 'column', gap: '12px' }}>
                <User size={48} style={{ opacity: 0.2 }} />
                Selecciona un colaborador para ver sus detalles
            </div>
        );
    }

    const handleChange = (field: string, value: any) => {
        if (localUser) {
            setLocalUser({ ...localUser, [field]: value });
        }
    };

    const handleSave = () => {
        if (localUser) {
            onUpdate({
                full_name: localUser.full_name,
                role: localUser.role,
                is_active: localUser.is_active,
                phone_whatsapp: localUser.phone_whatsapp,
                telegram_chat_id: localUser.telegram_chat_id
            });
        }
    };

    return (
        <div className="glass-card fade-in" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px', height: 'fit-content' }}>
            {/* Header / Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {localUser?.avatar_url ? (
                            <img src={localUser.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '16px', objectFit: 'cover' }} alt="" />
                        ) : (
                            <User size={32} style={{ color: 'var(--primary-color)' }} />
                        )}
                    </div>
                    <div>
                        <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{localUser?.full_name || 'Sin Nombre'}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#94a3b8', fontSize: '13px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={14} /> {localUser?.email}</span>
                            <span style={{ width: '1px', height: '12px', backgroundColor: 'rgba(255,255,255,0.1)' }}></span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: localUser?.is_active !== false ? '#10b981' : '#ef4444' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: localUser?.is_active !== false ? '#10b981' : '#ef4444' }}></div>
                                {localUser?.is_active !== false ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {onDelete && isAdmin && localUser?.id !== currentUser?.id && (
                        <button onClick={() => onDelete(localUser.id)} className="icon-button-danger" style={{ padding: '8px', borderRadius: '8px' }} title="Eliminar Usuario">
                            <Trash2 size={18} />
                        </button>
                    )}
                    {setImpersonatedUser && realUserProfile?.role === 'ADMIN' && localUser?.id !== realUserProfile?.id && (
                        <button
                            onClick={() => setImpersonatedUser(localUser)}
                            className="secondary-button"
                            style={{ gap: '8px', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.2)' }}
                        >
                            <Eye size={18} /> Ver como este usuario
                        </button>
                    )}
                    <button onClick={handleSave} className="primary-button" style={{ gap: '8px' }}>
                        <Save size={18} /> Guardar Cambios
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                {/* Perfil y Rol */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-color)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                        <Shield size={16} />
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Configuración de Acceso</h4>
                    </div>

                    <div className="input-group">
                        <label>Nombre Completo</label>
                        <input
                            type="text"
                            value={localUser?.full_name || ''}
                            onChange={(e) => handleChange('full_name', e.target.value)}
                            placeholder="Ej. Juan Pérez"
                        />
                    </div>

                    <div className="input-group">
                        <label>Rol en la Plataforma</label>
                        <select
                            value={localUser?.role || ''}
                            onChange={(e) => handleChange('role', e.target.value || null)}
                            disabled={!isAdmin}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #334155',
                                background: '#0f172a',
                                color: 'white',
                                opacity: isAdmin ? 1 : 0.6
                            }}
                        >
                            <option value="">-- Sin Rol (Indefinido) --</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                        </select>
                        {!isAdmin && <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Solo administradores pueden cambiar roles.</p>}
                    </div>

                    {/* Información de Contacto (Perfil Integrado) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid #334155' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                            <Activity size={14} /> INFORMACIÓN DE CONTACTO
                        </div>
                        <div className="input-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <MessageCircle size={14} color="#25D366" /> WhatsApp
                            </label>
                            <input
                                type="text"
                                value={localUser?.phone_whatsapp || ''}
                                onChange={(e) => handleChange('phone_whatsapp', e.target.value)}
                                placeholder="+521234567890"
                            />
                        </div>
                        <div className="input-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Send size={14} color="#0088cc" /> Telegram Chat ID
                            </label>
                            <input
                                type="text"
                                value={localUser?.telegram_chat_id || ''}
                                onChange={(e) => handleChange('telegram_chat_id', e.target.value)}
                                placeholder="ID de chat para notificaciones"
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid #334155' }}>
                        <div>
                            <span style={{ display: 'block', fontSize: '14px', fontWeight: '600' }}>Estado de la Cuenta</span>
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{localUser?.is_active !== false ? 'Acceso habilitado' : 'Acceso bloqueado'}</span>
                        </div>
                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
                            <input
                                type="checkbox"
                                checked={localUser?.is_active !== false}
                                onChange={(e) => handleChange('is_active', e.target.checked)}
                                disabled={!isAdmin || localUser?.id === currentUser?.id}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                                position: 'absolute', cursor: 'pointer', inset: 0, backgroundColor: localUser?.is_active !== false ? '#10b981' : '#334155',
                                transition: '.4s', borderRadius: '20px'
                            }}>
                                <span style={{
                                    position: 'absolute', height: '14px', width: '14px', left: localUser?.is_active !== false ? '22px' : '4px', bottom: '3px',
                                    backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
                                }}></span>
                            </span>
                        </label>
                    </div>
                </div>

                {/* Matriz de Permisos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-color)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                        <Activity size={16} />
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Permisos por Empresa</h4>
                    </div>

                    <div style={{
                        backgroundColor: 'rgba(255,255,255,0.01)',
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        <OrgAccessList profileId={localUser?.id} supabase={supabase} />
                    </div>
                </div>
            </div>
        </div>
    );
};
