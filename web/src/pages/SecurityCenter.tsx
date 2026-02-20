import React, { useState, useEffect } from 'react';
import { Key, Database, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SecurityCenterProps {
    supabase: any;
    clerkUser: any;
    getToken: any;
    impersonatedUser: any;
}

export const SecurityCenter: React.FC<SecurityCenterProps> = ({
    supabase,
    clerkUser,
    getToken,
    impersonatedUser
}) => {
    const [jwtData, setJwtData] = useState<any>(null);
    const [supabaseUser, setSupabaseUser] = useState<any>(null);
    const [dbIdentity, setDbIdentity] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const runDiagnostics = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Obtener Token y decodificar (vía Buffer o manual)
            const token = await getToken({ template: 'supabase' });
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                setJwtData(payload);
            }

            // 2. Obtener Usuario desde el SDK de Supabase
            const { data: { user } } = await supabase.auth.getUser();
            setSupabaseUser(user);

            // 3. Obtener Identidad desde la Base de Datos (SQL BRIDGE)
            const { data, error: dbError } = await supabase.rpc('requesting_user_id');
            if (dbError) {
                // Fallback si RPC no está expuesto o falla
                const { data: rawData, error: rawError } = await supabase.from('profiles').select('id').limit(1).single();
                if (rawError) console.error("Identity check failed:", rawError);
                setDbIdentity(rawData?.id ? "DETECTED (via Query)" : "NULL / RLS BLOCKED");
            } else {
                setDbIdentity(data || "NULL");
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        runDiagnostics();
    }, [impersonatedUser]);

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>Centro de Seguridad</h1>
                    <p style={{ color: '#94a3b8' }}>Verificación técnica de la infraestructura de identidad y RLS.</p>
                </div>
                <button
                    onClick={runDiagnostics}
                    disabled={loading}
                    className="secondary-button"
                    style={{ gap: '8px' }}
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refrescar Diagnóstico
                </button>
            </div>

            {error && (
                <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                {/* JWT & Token Information */}
                <div className="glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', color: 'var(--primary-base)' }}>
                        <Key size={20} />
                        <h3 style={{ margin: 0, fontWeight: 'bold' }}>Pasaporte Digital (JWT Clerk)</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span style={{ color: '#94a3b8' }}>JWT Claims:</span>
                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>RS256 (Asimétrico)</span>
                        </div>
                        <pre style={{
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            padding: '12px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            overflowX: 'auto',
                            color: '#a5b4fc',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                            {JSON.stringify(jwtData, null, 2)}
                        </pre>
                    </div>
                </div>

                {/* Supabase Context */}
                <div className="glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', color: '#10b981' }}>
                        <Database size={20} />
                        <h3 style={{ margin: 0, fontWeight: 'bold' }}>Contexto de Base de Datos</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid #334155' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Identidad Detectada por RLS (`requesting_user_id`):</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 'bold', color: dbIdentity === jwtData?.sub ? '#10b981' : '#f59e0b' }}>
                                    {dbIdentity || 'No detectado'}
                                </span>
                                {dbIdentity === jwtData?.sub && <CheckCircle2 size={14} color="#10b981" />}
                            </div>
                        </div>

                        <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid #334155' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Supabase SDK User ID (`auth.getUser`):</div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{supabaseUser?.id || 'Sesión no activa'}</div>
                        </div>

                        <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid #334155' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Usuario en Suplantación:</div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: impersonatedUser ? '#ef4444' : '#94a3b8' }}>
                                {impersonatedUser ? `${impersonatedUser.full_name} (${impersonatedUser.id})` : 'Ninguno (Identidad Real)'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-card" style={{ borderLeft: '4px solid var(--primary-base)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Estado de la Sonda de Seguridad</h4>
                <div style={{ display: 'flex', gap: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: clerkUser ? '#10b981' : '#ef4444' }}></div>
                        <span>Clerk Session: {clerkUser ? 'ACTIVE' : 'INACTIVE'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: dbIdentity ? '#10b981' : '#ef4444' }}></div>
                        <span>Supabase Gateway: {dbIdentity ? 'OPEN' : 'CLOSED'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: jwtData?.sub === dbIdentity ? '#10b981' : '#ef4444' }}></div>
                        <span>ID Sync: {jwtData?.sub === dbIdentity ? 'MATCH' : 'MISMATCH'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
