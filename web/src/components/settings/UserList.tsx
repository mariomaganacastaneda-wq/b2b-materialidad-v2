import React from 'react';
import { Search, X, ShieldCheck, UserMinus } from 'lucide-react';

interface UserListProps {
    users: any[];
    selectedUserId: string | null;
    onSelectUser: (user: any) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    currentUser?: any;
}

export const UserList: React.FC<UserListProps> = ({
    users,
    selectedUserId,
    onSelectUser,
    searchTerm,
    setSearchTerm,
    currentUser
}) => {
    const filteredUsers = users.filter(u =>
        !searchTerm ||
        (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden', height: 'fit-content' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--primary-color)' }}>Colaboradores</h3>
                    <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', color: '#64748b' }}>{users.length}</span>
                </div>
            </div>

            {/* --- SECCIÓN DE BÚSQUEDA --- */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        aria-label="Buscar colaboradores por nombre o email"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 12px 8px 32px',
                            fontSize: '12px',
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: 'white',
                            outline: 'none'
                        }}
                    />
                    {searchTerm && (
                        <X size={14} onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', cursor: 'pointer' }} />
                    )}
                </div>
            </div>

            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {/* --- MI PERFIL SHORTCUT --- */}
                {!searchTerm && currentUser && (
                    <div
                        onClick={() => onSelectUser(currentUser)}
                        style={{
                            padding: '16px 20px',
                            cursor: 'pointer',
                            borderBottom: '2px solid rgba(99, 102, 241, 0.2)',
                            backgroundColor: selectedUserId === currentUser.id ? 'var(--primary-glow)' : 'rgba(99, 102, 241, 0.05)',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '4px'
                        }}
                    >
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid var(--primary-color)',
                            flexShrink: 0
                        }}>
                            {currentUser.avatar_url ? (
                                <img src={currentUser.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                            ) : (
                                <ShieldCheck size={18} color="var(--primary-color)" />
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'white' }}>Mi Perfil</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Configura tus datos personales</div>
                        </div>
                    </div>
                )}

                {filteredUsers.length > 0 ? (
                    filteredUsers.map((u: any) => (
                        <div
                            key={u.id}
                            onClick={() => onSelectUser(u)}
                            style={{
                                padding: '16px 20px',
                                cursor: 'pointer',
                                borderBottom: '1px solid rgba(255,255,255,0.02)',
                                backgroundColor: selectedUserId === u.id ? 'var(--primary-glow)' : 'transparent',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}
                        >
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                backgroundColor: u.is_active !== false ? 'rgba(99, 102, 241, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: `1px solid ${u.is_active !== false ? 'rgba(99, 102, 241, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                flexShrink: 0
                            }}>
                                {u.avatar_url ? (
                                    <img src={u.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                                ) : (
                                    u.is_active !== false ? <ShieldCheck size={18} color="#a5b4fc" /> : <UserMinus size={18} color="#fca5a5" />
                                )}
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: selectedUserId === u.id ? 'white' : '#cbd5e1',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {u.full_name || 'Sin Nombre'}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {u.email}
                                    </div>
                                    <span style={{
                                        fontSize: '9px',
                                        padding: '1px 5px',
                                        borderRadius: '4px',
                                        backgroundColor: u.role === 'ADMIN' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                                        color: u.role === 'ADMIN' ? '#10b981' : '#94a3b8',
                                        fontWeight: '600'
                                    }}>
                                        {u.role || 'GUEST'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                        No se encontraron colaboradores.
                    </div>
                )}
            </div>
        </div>
    );
};
