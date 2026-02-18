
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Upload,
    CheckCircle2,
    XCircle,
    Loader2,
    FolderOpen,
    ChevronRight,
    Search
} from 'lucide-react';

interface ProcessingResult {
    fileName: string;
    success: boolean;
    message?: string;
    rfc?: string;
    orgName?: string;
}

const BulkCSFManager = () => {
    const [status, setStatus] = useState<'idle' | 'uploading' | 'completed'>('idle');
    const [files, setFiles] = useState<File[]>([]);
    const [currentFileIndex, setCurrentFileIndex] = useState(0);
    const [results, setResults] = useState<ProcessingResult[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const fileList = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
            setFiles(fileList);
            setStatus('idle');
            setResults([]);
            setCurrentFileIndex(0);
        }
    };

    const processFiles = async () => {
        if (files.length === 0) return;

        setStatus('uploading');
        const newResults: ProcessingResult[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setCurrentFileIndex(i);
            console.log(`[BulkCSF] [${i + 1}/${files.length}] Procesando: ${file.name}`);

            try {
                // 1. Prepare file path
                const timestamp = Date.now();
                const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const filePath = `bulk_${timestamp}_${sanitizedName}`;

                // 2. Upload to storage
                console.log(`[BulkCSF] Subiendo a Storage: ${filePath}...`);
                const { error: uploadError } = await supabase.storage
                    .from('csf')
                    .upload(filePath, file, {
                        upsert: true,
                        contentType: 'application/pdf'
                    });

                if (uploadError) {
                    console.error(`[BulkCSF] Error en Storage para ${file.name}:`, uploadError);
                    throw new Error(`Error de subida: ${uploadError.message}`);
                }
                console.log(`[BulkCSF] Subida a Storage exitosa`);

                // 3. Invoke Edge Function
                console.log(`[BulkCSF] Invocando Edge Function 'process-csf' para ${file.name}...`);
                const { data: extractionRes, error: invokeError } = await supabase.functions.invoke('process-csf', {
                    body: {
                        filePath,
                        organizationId: null,
                        isCreatingNew: true
                    }
                });

                if (invokeError) {
                    console.error(`[BulkCSF] Error de invocación para ${file.name}:`, invokeError);
                    throw new Error(invokeError.message);
                }

                if (extractionRes?.success === false) {
                    console.error(`[BulkCSF] La función reportó error para ${file.name}:`, extractionRes.error);
                    throw new Error(extractionRes.error || 'Error en procesamiento');
                }

                console.log(`[BulkCSF] ✅ Procesamiento exitoso para ${file.name}`);
                newResults.push({
                    fileName: file.name,
                    success: true,
                    orgName: extractionRes.data?.name,
                    rfc: extractionRes.data?.rfc
                });

            } catch (err: any) {
                console.error(`[BulkCSF] ❌ Fallo en ${file.name}:`, err.message);
                newResults.push({
                    fileName: file.name,
                    success: false,
                    message: err.message
                });
            }

            // Update results as we go
            setResults([...newResults]);

            // Safety delay
            await new Promise(resolve => setTimeout(resolve, 800));
        }

        setStatus('completed');
    };

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-card" style={{ border: '2px dashed rgba(99, 102, 241, 0.2)', padding: '40px', textAlign: 'center' }}>
                <input
                    type="file"
                    id="bulk-csf-input"
                    multiple
                    // @ts-ignore
                    webkitdirectory=""
                    directory=""
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary-base)'
                    }}>
                        <FolderOpen size={32} />
                    </div>

                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Carga Masiva de Constancias (Lote)</h2>
                        <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
                            Selecciona una carpeta o múltiples archivos PDF. El sistema extraerá e integrará automáticamente los datos fiscales de todas las empresas.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                        <label
                            htmlFor="bulk-csf-input"
                            className="secondary-button"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                        >
                            <Search size={18} /> Seleccionar Carpeta / Archivos
                        </label>

                        {files.length > 0 && status !== 'uploading' && (
                            <button
                                onClick={processFiles}
                                className="primary-button"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <Upload size={18} /> Iniciar Proceso de {files.length} Archivos
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {status === 'uploading' && (
                <div className="glass-card fade-in" style={{ borderColor: 'var(--primary-glow)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div>
                            <div style={{ fontSize: '14px', color: '#94a3b8' }}>Procesando Lote Fiscal...</div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Archivo {currentFileIndex + 1} de {files.length}</div>
                        </div>
                        <Loader2 className="animate-spin" size={24} color="var(--primary-base)" />
                    </div>

                    <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                        <div style={{
                            width: `${((currentFileIndex + 1) / files.length) * 100}%`,
                            height: '100%',
                            backgroundColor: 'var(--primary-base)',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Archivo actual: <span style={{ color: 'white' }}>{files[currentFileIndex]?.name}</span>
                    </div>
                </div>
            )}

            {(results.length > 0 || status === 'completed') && (
                <div className="glass-card fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Resumen del Procesamiento</h3>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <span style={{ color: 'var(--color-success)', fontSize: '12px', fontWeight: 'bold' }}>✓ {successCount} Exitosos</span>
                            <span style={{ color: 'var(--color-error)', fontSize: '12px', fontWeight: 'bold' }}>✗ {failureCount} Errores</span>
                        </div>
                    </div>

                    <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {results.map((result, idx) => (
                            <div key={idx} style={{
                                padding: '12px 16px',
                                backgroundColor: 'rgba(255,255,255,0.02)',
                                borderRadius: '10px',
                                border: `1px solid ${result.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {result.success ? (
                                        <CheckCircle2 size={18} color="var(--color-success)" />
                                    ) : (
                                        <XCircle size={18} color="var(--color-error)" />
                                    )}
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: '500' }}>{result.fileName}</div>
                                        {result.success ? (
                                            <div style={{ fontSize: '11px', color: '#10b981' }}>
                                                {result.orgName} ({result.rfc})
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '11px', color: '#ef4444' }}>{result.message}</div>
                                        )}
                                    </div>
                                </div>
                                {result.success && (
                                    <div style={{ color: '#64748b' }}>
                                        <ChevronRight size={16} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {status === 'completed' && (
                        <div style={{ marginTop: '20px', textAlign: 'center' }}>
                            <button
                                onClick={() => { setStatus('idle'); setFiles([]); setResults([]); }}
                                className="secondary-button"
                                style={{ fontSize: '12px' }}
                            >
                                Limpiar y Nueva Carga
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BulkCSFManager;
