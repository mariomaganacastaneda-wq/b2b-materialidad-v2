import React, { useState } from 'react';
import { User, X } from 'lucide-react';

interface UserDirectoryProps {
    users: any[];
    setUsers: (users: any[]) => void;
    supabase: any; // Would be better typed with SupabaseClient
}

export const UserDirectory: React.FC<UserDirectoryProps> = ({ users, setUsers, supabase }) => {
    const [editingUser, setEditingUser] = useState<any>(null);

    return (
        <div className="glass-card fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--primary-color)' }}>Directorio de Colaboradores</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className="secondary-button"
                        onClick={() => {
                            const loadInitData = async () => {
                                const { data: userData } = await supabase.from('profiles').select('*');
                                setUsers(userData || []);
                            };
                            loadInitData();
                        }}
                    >
                        ↻ Recargar
                    </button>
                    <button className="secondary-button" disabled>+ Invitar Usuario</button>
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <th style={{ textAlign: 'left', padding: '12px' }}>Usuario</th>
                            <th style={{ textAlign: 'left', padding: '12px' }}>Email</th>
                            <th style={{ textAlign: 'left', padding: '12px' }}>Rol</th>
                            <th style={{ textAlign: 'left', padding: '12px' }}>Estado</th>
                            <th style={{ textAlign: 'left', padding: '12px' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u: any) => (
                            <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {u.avatar_url ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : <User size={16} />}
                                    </div>
                                    {u.full_name || 'Sin Nombre'}
                                </td>
                                <td style={{ padding: '12px', color: '#cbd5e1' }}>{u.email}</td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{ padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc', fontSize: '11px', border: '1px solid rgba(99, 102, 241, 0.3)', fontWeight: '600' }}>
                                        {u.role === 'FACTURACION' ? 'Facturación' :
                                            u.role === 'ADMIN' ? 'Administrador' :
                                                u.role === 'GESTOR_NOM151' ? 'NOM-151' :
                                                    u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                                    </span>
                                </td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                                        Activo
                                    </span>
                                </td>
                                <td style={{ padding: '12px' }}>
                                    <button
                                        onClick={() => setEditingUser(u)}
                                        style={{ background: 'none', border: 'none', color: 'var(--primary-base)', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        Editar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAL DE EDICIÓN DE USUARIO */}
            {editingUser && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '450px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Editar Colaborador</h3>
                            <button onClick={() => setEditingUser(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="input-group">
                                <label>Nombre Completo</label>
                                <input
                                    type="text"
                                    defaultValue={editingUser.full_name}
                                    onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                                />
                            </div>

                            <div className="input-group" style={{ marginBottom: '24px' }}>
                                <label>Rol en la Plataforma</label>
                                <select
                                    defaultValue={editingUser.role}
                                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: 'white', outline: 'none' }}
                                >
                                    {[
                                        { val: 'ADMIN', label: 'Administrador' },
                                        { val: 'VENDEDOR', label: 'Ventas / Vendedor' },
                                        { val: 'FACTURACION', label: 'Facturación' },
                                        { val: 'REPRESENTANTE', label: 'Representante Legal' },
                                        { val: 'GESTOR_NOM151', label: 'Gestor NOM-151' },
                                        { val: 'CXC', label: 'Cuentas por Cobrar' },
                                        { val: 'CONTABLE', label: 'Contador / Fiscal' },
                                        { val: 'CLIENTE', label: 'Cliente (Receptor)' }
                                    ].map(role => (
                                        <option key={role.val} value={role.val}>{role.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setEditingUser(null)}
                                    className="secondary-button"
                                    style={{ flex: 1 }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={async () => {
                                        const { error } = await supabase.from('profiles').update({
                                            full_name: editingUser.full_name,
                                            role: editingUser.role
                                        }).eq('id', editingUser.id);

                                        if (error) {
                                            alert('Error: ' + error.message);
                                        } else {
                                            setUsers(users.map((u: any) => u.id === editingUser.id ? { ...u, full_name: editingUser.full_name, role: editingUser.role } : u));
                                            setEditingUser(null);
                                        }
                                    }}
                                    className="primary-button"
                                    style={{ flex: 1, justifyContent: 'center' }}
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
