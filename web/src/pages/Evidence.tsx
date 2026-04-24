import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ExifReader from 'exifreader';
import {
    Camera,
    UploadCloud,
    Image as ImageIcon,
    MapPin,
    Clock,
    Eye,
    LayoutGrid,
    List,
    X,
    Aperture,
    Sun,
    Maximize2,
    Smartphone,
    Calendar,
    Link2,
    Download,
    CheckSquare,
    Square,
    ChevronDown,
    ChevronRight,
    Package,
    LinkIcon,
    Trash2,
    ExternalLink,
} from 'lucide-react';
import { GlowCard } from '../components/ui/GlowCard';
import { TextGlitch } from '../components/ui/TextGlitch';

interface EvidenceProps {
    userProfile: any;
    selectedOrg: any;
}

/* ──────────────────────── helpers ──────────────────────── */

const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getPublicUrl = (filePath: string) =>
    supabase.storage.from('evidence').getPublicUrl(filePath).data.publicUrl;

const calculateSHA256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

const sanitizeExifForStorage = (tags: Record<string, any>): Record<string, string> => {
    const skip = new Set(['Thumbnail', 'MakerNote', 'UserComment', 'undefined', 'MPEntry']);
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(tags)) {
        if (skip.has(key)) continue;
        if (value && typeof value === 'object' && 'description' in value) {
            const desc = value.description;
            if (typeof desc === 'string' && desc.length < 500) {
                result[key] = desc;
            }
        }
    }
    return result;
};

const parseGpsValue = (tag: any): number | null => {
    if (!tag) return null;
    const v = typeof tag.description === 'number' ? tag.description : parseFloat(tag.description);
    return isNaN(v) ? null : v;
};

const extractExif = async (file: File) => {
    try {
        const tags = await ExifReader.load(file);

        let latitude = parseGpsValue(tags.GPSLatitude);
        let longitude = parseGpsValue(tags.GPSLongitude);
        const latRef = tags.GPSLatitudeRef?.value;
        const lngRef = tags.GPSLongitudeRef?.value;
        if (latitude !== null && Array.isArray(latRef) && latRef[0] === 'S' && latitude > 0) latitude = -latitude;
        if (longitude !== null && Array.isArray(lngRef) && lngRef[0] === 'W' && longitude > 0) longitude = -longitude;

        return {
            gps: { latitude, longitude },
            camera: {
                make: tags.Make?.description || null,
                model: tags.Model?.description || null,
            },
            photo: {
                dateTimeOriginal: tags.DateTimeOriginal?.description || null,
                width: tags['Image Width']?.value || tags.ImageWidth?.value || null,
                height: tags['Image Height']?.value || tags.ImageHeight?.value || null,
                exposureTime: tags.ExposureTime?.description || null,
                fNumber: tags.FNumber?.description || null,
                iso: (tags.ISOSpeedRatings?.description ?? tags.PhotographicSensitivity?.description) || null,
            },
            sanitized: sanitizeExifForStorage(tags),
        };
    } catch {
        return {
            gps: { latitude: null, longitude: null },
            camera: { make: null, model: null },
            photo: {} as any,
            sanitized: {},
        };
    }
};

/** Build folio like SSI-030326-01 from quotation data */
const buildFolio = (q: { proforma_number?: number | string; created_at?: string; organizations?: { rfc?: string } } | null): string | null => {
    if (!q || q.proforma_number == null) return null;
    const rfc = q.organizations?.rfc || '';
    const prefix = rfc.length >= 3 ? rfc.substring(0, rfc.length === 13 ? 4 : 3).toUpperCase() : '???';
    const d = new Date(q.created_at || Date.now());
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const num = String(q.proforma_number).padStart(2, '0');
    return `${prefix}-${dd}${mm}${yy}-${num}`;
};

const generateBatchId = () => crypto.randomUUID();

/* ──────────────────────── types ──────────────────────── */

interface EvidenceGroup {
    key: string;
    folio: string | null;
    quotationId: string | null;
    linkedAt: string | null;
    items: any[];
    isLinked: boolean;
    /** Upload link info for adding more photos to this group */
    uploadLink?: { invoiceId?: string; contractId?: string; quotationId?: string };
    /** Whether this is a pending proforma with no photos yet */
    isPending?: boolean;
}

/* ──────────────────────── component ──────────────────────── */

const Evidence = ({ userProfile, selectedOrg }: EvidenceProps) => {
    const [evidenceItems, setEvidenceItems] = useState<any[]>([]);
    const [pendingItems, setPendingItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
    const [viewMode, setViewMode] = useState<'gallery' | 'table'>('gallery');
    const [preview, setPreview] = useState<any | null>(null);

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Delete confirmation (per-group: stores group key when armed)
    const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Assign modal
    const [assignBatchId, setAssignBatchId] = useState<string | null>(null);
    const [availableQuotations, setAvailableQuotations] = useState<any[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const linkedFileInputRef = useRef<HTMLInputElement>(null);
    const [linkTarget, setLinkTarget] = useState<{ invoiceId?: string; contractId?: string; quotationId?: string } | null>(null);

    /* ── fetch ── */
    const fetchEvidence = useCallback(async () => {
        if (!selectedOrg?.id) return;
        try {
            setLoading(true);

            // All FOTO evidence with nested join to get proforma_number
            let evQuery = supabase
                .from('evidence')
                .select('*, evidence_metadata(*), invoices(id, quotation_id, quotations(proforma_number, created_at, created_by, organizations(rfc)))')
                .eq('organization_id', selectedOrg.id)
                .eq('type', 'FOTO')
                .order('created_at', { ascending: false });

            const { data: evData, error: evErr } = await evQuery;
            if (evErr) throw evErr;

            let filteredEv = evData || [];
            if (userProfile?.view_mode === 'mine' && userProfile?.id) {
                // Obtener IDs de proformas del usuario
                const { data: myQuotations } = await supabase
                    .from('quotations')
                    .select('id')
                    .eq('organization_id', selectedOrg.id)
                    .eq('created_by', userProfile.id);
                const myQuotationIds = new Set((myQuotations || []).map((q: any) => q.id));

                filteredEv = filteredEv.filter((e: any) => {
                    // Verificar por cadena invoice → quotation
                    const quotationId = e.invoices?.quotation_id;
                    if (quotationId && myQuotationIds.has(quotationId)) return true;
                    // Verificar por created_by directo de la evidencia
                    if (e.created_by === userProfile.id) return true;
                    return false;
                });
            }
            setEvidenceItems(filteredEv);

            // Pending quotations that need evidence
            let pendQuery = supabase
                .from('quotations')
                .select('id, proforma_number, created_at, evidence_status, req_evidence, organizations(rfc), invoices(id), contracts(id)')
                .eq('organization_id', selectedOrg.id)
                .or('req_evidence.eq.true,evidence_status.eq.solicitada')
                .order('created_at', { ascending: false });

            if (userProfile?.view_mode === 'mine' && userProfile?.id) {
                pendQuery = pendQuery.eq('created_by', userProfile.id);
            }

            const { data: pendData, error: pendErr } = await pendQuery;

            if (pendErr) throw pendErr;

            // Count photos per invoice_id to show in pending section
            const photoCountByInvoice = new Map<string, number>();
            for (const ev of (evData || [])) {
                if (ev.invoice_id) {
                    photoCountByInvoice.set(ev.invoice_id, (photoCountByInvoice.get(ev.invoice_id) || 0) + 1);
                }
            }

            // Add photo counts to pending items
            const enriched = (pendData || []).map((q: any) => {
                const invIds = (Array.isArray(q.invoices) ? q.invoices : q.invoices ? [q.invoices] : []).map((i: any) => i.id);
                const photoCount = invIds.reduce((sum: number, id: string) => sum + (photoCountByInvoice.get(id) || 0), 0);
                return { ...q, photoCount };
            });
            setPendingItems(enriched);
        } catch (err: any) {
            console.error('Error fetching evidence:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedOrg]);

    useEffect(() => { fetchEvidence(); }, [fetchEvidence]);

    /* ── build unified container list (photos + pending proformas) ── */
    const groups: EvidenceGroup[] = (() => {
        const byBatch = new Map<string, any[]>();
        const independentItems: any[] = [];

        for (const e of evidenceItems) {
            if (e.batch_id) {
                const arr = byBatch.get(e.batch_id) || [];
                arr.push(e);
                byBatch.set(e.batch_id, arr);
            } else {
                independentItems.push(e);
            }
        }

        const result: EvidenceGroup[] = [];
        // Track which quotation IDs already have photo groups
        const coveredQuotationIds = new Set<string>();

        // Batch containers (photos already uploaded)
        for (const [batchId, items] of byBatch) {
            const first = items[0];
            const q = first?.invoices?.quotations ?? null;
            const qId = first?.invoices?.quotation_id ?? null;
            const folio = buildFolio(q);
            if (qId) coveredQuotationIds.add(qId);
            result.push({
                key: `batch-${batchId}`,
                folio,
                quotationId: qId,
                linkedAt: first?.created_at,
                items,
                isLinked: !!first?.invoice_id || !!first?.contract_id,
                uploadLink: qId ? {
                    invoiceId: first?.invoice_id,
                    contractId: first?.contract_id,
                    quotationId: qId,
                } : undefined,
            });
        }

        // Single container for all independent (unbatched) photos
        if (independentItems.length > 0) {
            result.push({
                key: 'independent',
                folio: null,
                quotationId: null,
                linkedAt: independentItems[0]?.created_at,
                items: independentItems,
                isLinked: false,
            });
        }

        // Pending proformas that don't have a photo group yet
        for (const q of pendingItems) {
            if (coveredQuotationIds.has(q.id)) continue;
            const invoices = Array.isArray(q.invoices) ? q.invoices : q.invoices ? [q.invoices] : [];
            const contracts = Array.isArray(q.contracts) ? q.contracts : q.contracts ? [q.contracts] : [];
            result.push({
                key: `pending-${q.id}`,
                folio: buildFolio(q),
                quotationId: q.id,
                linkedAt: q.created_at,
                items: [],
                isLinked: false,
                isPending: true,
                uploadLink: {
                    invoiceId: invoices[0]?.id,
                    contractId: contracts[0]?.id,
                    quotationId: q.id,
                },
            });
        }

        // Sort: pending first, then unlinked, then linked; then by date desc
        result.sort((a, b) => {
            if (a.isPending !== b.isPending) return a.isPending ? -1 : 1;
            if (a.isLinked !== b.isLinked) return a.isLinked ? 1 : -1;
            return new Date(b.linkedAt || 0).getTime() - new Date(a.linkedAt || 0).getTime();
        });

        return result;
    })();

    /* ── batch upload ── */
    const handleBatchUpload = async (
        files: FileList,
        linked?: { invoiceId?: string; contractId?: string; quotationId?: string },
    ) => {
        if (!selectedOrg?.id || files.length === 0) return;
        setUploading(true);
        setUploadProgress({ current: 0, total: files.length });
        setError(null);

        const batchId = generateBatchId();

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setUploadProgress({ current: i + 1, total: files.length });

                const exif = await extractExif(file);
                const sha256 = await calculateSHA256(file);

                const ts = Date.now();
                const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const storagePath = `${selectedOrg.id}/${ts}_${safeName}`;

                const { error: upErr } = await supabase.storage
                    .from('evidence')
                    .upload(storagePath, file, { contentType: file.type });
                if (upErr) throw new Error(`Error subiendo ${file.name}: ${upErr.message}`);

                const metadata: Record<string, any> = {};
                if (exif.gps.latitude != null && exif.gps.longitude != null) {
                    metadata.gps = { lat: exif.gps.latitude, lng: exif.gps.longitude };
                }
                if (exif.camera.make || exif.camera.model) metadata.camera = exif.camera;
                if (exif.photo.dateTimeOriginal) metadata.dateTimeOriginal = exif.photo.dateTimeOriginal;
                if (exif.photo.width && exif.photo.height) metadata.dimensions = { w: exif.photo.width, h: exif.photo.height };
                if (exif.photo.iso || exif.photo.fNumber || exif.photo.exposureTime) {
                    metadata.photoParams = { iso: exif.photo.iso, fNumber: exif.photo.fNumber, exposureTime: exif.photo.exposureTime };
                }

                const { data: record, error: insErr } = await supabase
                    .from('evidence')
                    .insert({
                        organization_id: selectedOrg.id,
                        invoice_id: linked?.invoiceId || null,
                        contract_id: linked?.contractId || null,
                        batch_id: batchId,
                        type: 'FOTO',
                        file_url: storagePath,
                        sha256_hash: sha256,
                        file_size: file.size,
                        mime_type: file.type,
                        metadata,
                    })
                    .select('id')
                    .single();
                if (insErr) throw new Error(`Error guardando ${file.name}: ${insErr.message}`);

                await supabase.from('evidence_metadata').insert({
                    evidence_id: record.id,
                    original_exif: exif.sanitized,
                    detected_latitude: exif.gps.latitude,
                    detected_longitude: exif.gps.longitude,
                    upload_timestamp: new Date().toISOString(),
                    uploaded_by: userProfile?.id || null,
                });

                if (linked?.quotationId) {
                    await supabase
                        .from('quotations')
                        .update({ evidence_status: 'en_revision' })
                        .eq('id', linked.quotationId);
                }
            }

            await fetchEvidence();
        } catch (err: any) {
            console.error('Upload error:', err);
            setError(err.message);
        } finally {
            setUploading(false);
            setUploadProgress({ current: 0, total: 0 });
            setLinkTarget(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (linkedFileInputRef.current) linkedFileInputRef.current.value = '';
        }
    };

    /* ── selection helpers ── */
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === evidenceItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(evidenceItems.map(e => e.id)));
        }
    };

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    /* ── download photos in a group ── */
    const [downloadingGroup, setDownloadingGroup] = useState<string | null>(null);

    const downloadGroupPhotos = async (group: EvidenceGroup) => {
        if (group.items.length === 0) return;
        // Download only selected photos in this group; if none selected, download all
        const selectedInGroup = group.items.filter((e: any) => selectedIds.has(e.id));
        const itemsToDownload = selectedInGroup.length > 0 ? selectedInGroup : group.items;

        setDownloadingGroup(group.key);
        try {
            // Try File System Access API (lets user pick folder)
            if ('showDirectoryPicker' in window) {
                const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
                for (const item of itemsToDownload) {
                    const fileName = item.file_url.split('/').pop() || `foto_${item.id}.jpg`;
                    const { data, error: dlErr } = await supabase.storage.from('evidence').download(item.file_url);
                    if (dlErr || !data) {
                        console.warn(`No se pudo descargar ${fileName}:`, dlErr?.message);
                        continue;
                    }
                    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(data);
                    await writable.close();
                }
            } else {
                // Fallback: download each file via blob URL
                for (const item of itemsToDownload) {
                    const fileName = item.file_url.split('/').pop() || 'evidence.jpg';
                    const { data, error: dlErr } = await supabase.storage.from('evidence').download(item.file_url);
                    if (dlErr || !data) continue;
                    const blobUrl = URL.createObjectURL(data);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        } catch (err: any) {
            // User cancelled the directory picker — not an error
            if (err.name !== 'AbortError') {
                console.error('Download error:', err);
                setError(`Error al descargar: ${err.message}`);
            }
        } finally {
            setDownloadingGroup(null);
        }
    };

    /* ── delete items from a group ── */
    const deleteGroupItems = async (groupKey: string, items: any[]) => {
        if (confirmDeleteGroup !== groupKey) {
            setConfirmDeleteGroup(groupKey);
            return;
        }
        setDeleting(true);
        setError(null);
        try {
            // Delete from storage
            const paths = items.map(e => e.file_url).filter(Boolean);
            if (paths.length > 0) {
                const { error: stErr } = await supabase.storage.from('evidence').remove(paths);
                if (stErr) console.warn('Storage delete warning:', stErr.message);
            }

            // Delete metadata rows
            const ids = items.map(e => e.id);
            await supabase.from('evidence_metadata').delete().in('evidence_id', ids);

            // Delete evidence rows
            const { error: delErr } = await supabase.from('evidence').delete().in('id', ids);
            if (delErr) throw delErr;

            setSelectedIds(prev => {
                const next = new Set(prev);
                ids.forEach(id => next.delete(id));
                return next;
            });
            setConfirmDeleteGroup(null);
            await fetchEvidence();
        } catch (err: any) {
            console.error('Delete error:', err);
            setError(`Error al borrar: ${err.message}`);
        } finally {
            setDeleting(false);
        }
    };

    /* ── assign batch to proforma ── */
    const openAssignModal = async (batchId: string) => {
        // Fetch quotations with invoices to assign
        const { data } = await supabase
            .from('quotations')
            .select('id, proforma_number, created_at, organizations(rfc), invoices(id), contracts(id)')
            .eq('organization_id', selectedOrg.id)
            .order('proforma_number', { ascending: false })
            .limit(50);
        setAvailableQuotations(data || []);
        setAssignBatchId(batchId);
    };

    const assignBatchToProforma = async (quotation: any) => {
        if (!assignBatchId) return;
        const realBatchId = assignBatchId.replace('batch-', '');
        const invoices = Array.isArray(quotation.invoices) ? quotation.invoices : quotation.invoices ? [quotation.invoices] : [];
        const contracts = Array.isArray(quotation.contracts) ? quotation.contracts : quotation.contracts ? [quotation.contracts] : [];

        const { error: upErr } = await supabase
            .from('evidence')
            .update({
                invoice_id: invoices[0]?.id || null,
                contract_id: contracts[0]?.id || null,
            })
            .eq('batch_id', realBatchId);

        if (upErr) {
            setError(`Error asignando: ${upErr.message}`);
        } else {
            // Update quotation evidence status
            await supabase
                .from('quotations')
                .update({ evidence_status: 'en_revision' })
                .eq('id', quotation.id);
            setAssignBatchId(null);
            await fetchEvidence();
        }
    };

    /* ── get folio label for an evidence item ── */
    const getFolioLabel = (e: any): string | null => {
        return buildFolio(e.invoices?.quotations ?? null);
    };

    /* ──────────────────────── render ──────────────────────── */
    return (
        <div className="fade-in space-y-6">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <Camera className="text-white text-xl" />
                        </div>
                        <TextGlitch text="Evidencia Fotografica" className="text-2xl font-black text-white tracking-tight" />
                    </div>
                    <p className="text-slate-400 text-sm mt-1">
                        Subida por lote con extraccion automatica de metadatos EXIF.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* View toggle */}
                    <div className="flex items-center bg-slate-800/60 rounded-lg p-1 border border-white/5">
                        <button onClick={() => setViewMode('gallery')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'gallery' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Galeria">
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Tabla">
                            <List className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Select all toggle */}
                    {evidenceItems.length > 0 && (
                        <button
                            onClick={toggleSelectAll}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 text-xs font-bold rounded-lg border border-white/5 transition-colors"
                            title={selectedIds.size === evidenceItems.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                        >
                            {selectedIds.size === evidenceItems.length
                                ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                                : <Square className="w-3.5 h-3.5" />
                            }
                        </button>
                    )}

                    {/* Upload button (general / unlinked) */}
                    <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden"
                        onChange={(e) => e.target.files && handleBatchUpload(e.target.files)} />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-cyan-500/20"
                    >
                        <UploadCloud className="w-4 h-4" />
                        Subir Fotos (Lote)
                    </button>
                </div>
            </div>

            {/* ── Upload progress ── */}
            {uploading && (
                <GlowCard className="!p-4 bg-cyan-950/30 border-cyan-500/20">
                    <div className="flex items-center gap-3">
                        <div className="animate-spin w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full" />
                        <div className="flex-1">
                            <div className="text-sm font-bold text-cyan-300">
                                Procesando {uploadProgress.current} / {uploadProgress.total}...
                            </div>
                            <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-cyan-500 transition-all duration-300 rounded-full"
                                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </GlowCard>
            )}

            {/* ── Error ── */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Hidden input for linked upload */}
            <input ref={linkedFileInputRef} type="file" multiple accept="image/*" className="hidden"
                onChange={(e) => {
                    if (e.target.files && linkTarget) handleBatchUpload(e.target.files, linkTarget);
                }} />

            {/* ── Main content ── */}
            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="animate-pulse bg-slate-800/40 rounded-xl aspect-square" />
                    ))}
                </div>
            ) : groups.length === 0 ? (
                <GlowCard className="!py-16 text-center bg-slate-900/40 border-white/5">
                    <Camera className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500 italic">No se encontraron fotografias.</p>
                    <p className="text-slate-600 text-xs mt-2">Usa "Subir Fotos (Lote)" para cargar fotos con metadatos EXIF.</p>
                    <p className="text-slate-600 text-xs">Puedes subirlas sin proforma y asignarlas despues.</p>
                </GlowCard>
            ) : (
                /* ── Grouped view ── */
                <div className="space-y-4">
                    {groups.map((group) => {
                        const isExpanded = expandedGroups.has(group.key);
                        const allGroupIds = group.items.map((e: any) => e.id);
                        const allSelected = allGroupIds.every(id => selectedIds.has(id));

                        return (
                            <GlowCard
                                key={group.key}
                                className={`!p-0 overflow-hidden border-white/5 ${group.isPending ? 'bg-amber-950/10 border-amber-500/10' : 'bg-slate-900/40'}`}
                            >
                                {/* Container header */}
                                <div
                                    className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${group.isPending ? 'hover:bg-amber-500/5' : 'hover:bg-white/5'}`}
                                    onClick={() => group.items.length > 0 ? toggleGroup(group.key) : undefined}
                                >
                                    <div className="flex items-center gap-3">
                                        {group.items.length > 0 ? (
                                            isExpanded
                                                ? <ChevronDown className="w-4 h-4 text-cyan-400" />
                                                : <ChevronRight className="w-4 h-4 text-slate-500" />
                                        ) : (
                                            <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                                        )}
                                        <Package className="w-4 h-4 text-slate-400" />
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Folio link */}
                                            {group.folio && group.quotationId && (
                                                <Link
                                                    to={`/proformas/${group.quotationId}`}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-600/20 text-cyan-400 text-xs font-bold font-mono rounded hover:bg-cyan-600/30 hover:text-cyan-300 transition-colors"
                                                    title="Ver proforma"
                                                    onClick={(ev) => ev.stopPropagation()}
                                                >
                                                    {group.folio}
                                                    <ExternalLink className="w-3 h-3" />
                                                </Link>
                                            )}
                                            {group.folio && !group.quotationId && (
                                                <span className="px-2 py-0.5 bg-cyan-600/20 text-cyan-400 text-xs font-bold font-mono rounded">
                                                    {group.folio}
                                                </span>
                                            )}
                                            {!group.folio && group.key === 'independent' && (
                                                <span className="text-xs font-bold text-slate-300">Fotos independientes</span>
                                            )}
                                            {/* Photo count badge */}
                                            {group.items.length > 0 ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-800/60 rounded text-sm text-white font-medium cursor-pointer hover:bg-slate-700/60 transition-colors">
                                                    <Camera className="w-3.5 h-3.5 text-slate-400" />
                                                    {group.items.length} {group.items.length === 1 ? 'foto' : 'fotos'}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-600/10 rounded text-sm text-red-400 font-medium">
                                                    <Camera className="w-3.5 h-3.5" />
                                                    0 fotos
                                                </span>
                                            )}
                                            {/* Status badges */}
                                            {!group.isLinked && !group.isPending && group.key !== 'independent' && (
                                                <span className="px-2 py-0.5 bg-amber-600/20 text-amber-400 text-[10px] font-bold rounded">
                                                    SIN ASIGNAR
                                                </span>
                                            )}
                                            {group.isPending && (
                                                <span className="px-2 py-0.5 bg-amber-600/20 text-amber-400 text-[10px] font-bold rounded">
                                                    PENDIENTE
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {group.linkedAt && (
                                            <span className="text-[10px] text-slate-500 hidden sm:inline">
                                                {new Date(group.linkedAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        )}
                                        {/* Upload more photos to this group */}
                                        {group.uploadLink && (
                                            <button
                                                onClick={(ev) => {
                                                    ev.stopPropagation();
                                                    setLinkTarget(group.uploadLink!);
                                                    linkedFileInputRef.current?.click();
                                                }}
                                                disabled={uploading}
                                                className="flex items-center gap-1 px-2 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 disabled:opacity-50 text-cyan-400 text-[10px] font-bold rounded transition-colors"
                                            >
                                                <UploadCloud className="w-3 h-3" /> Subir
                                            </button>
                                        )}
                                        {/* Download photos in group (selected or all) */}
                                        {group.items.length > 0 && (() => {
                                            const selCount = group.items.filter((e: any) => selectedIds.has(e.id)).length;
                                            const label = downloadingGroup === group.key
                                                ? 'Descargando...'
                                                : selCount > 0
                                                    ? `Descargar (${selCount})`
                                                    : `Descargar (${group.items.length})`;
                                            return (
                                                <button
                                                    onClick={(ev) => {
                                                        ev.stopPropagation();
                                                        downloadGroupPhotos(group);
                                                    }}
                                                    disabled={downloadingGroup === group.key}
                                                    className="flex items-center gap-1 px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-50 text-emerald-400 text-[10px] font-bold rounded transition-colors"
                                                    title={selCount > 0 ? `Descargar ${selCount} fotos seleccionadas` : `Descargar todas (${group.items.length})`}
                                                >
                                                    {downloadingGroup === group.key ? (
                                                        <div className="animate-spin w-3 h-3 border border-emerald-400 border-t-transparent rounded-full" />
                                                    ) : (
                                                        <Download className="w-3 h-3" />
                                                    )}
                                                    {label}
                                                </button>
                                            );
                                        })()}
                                        {/* Delete selected in group */}
                                        {(() => {
                                            const selInGroup = group.items.filter((e: any) => selectedIds.has(e.id));
                                            if (selInGroup.length === 0) return null;
                                            const isArmed = confirmDeleteGroup === group.key;
                                            return (
                                                <button
                                                    onClick={(ev) => {
                                                        ev.stopPropagation();
                                                        deleteGroupItems(group.key, selInGroup);
                                                    }}
                                                    disabled={deleting}
                                                    className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded transition-colors ${isArmed ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse' : 'bg-red-600/20 hover:bg-red-600/30 text-red-400'}`}
                                                    title={isArmed ? `Confirmar borrado de ${selInGroup.length} fotos` : `Borrar ${selInGroup.length} fotos seleccionadas`}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    {deleting && isArmed ? 'Borrando...' : isArmed ? `Confirmar (${selInGroup.length})` : `Borrar (${selInGroup.length})`}
                                                </button>
                                            );
                                        })()}
                                        {/* Select all in group */}
                                        {group.items.length > 0 && (
                                            <button
                                                onClick={(ev) => {
                                                    ev.stopPropagation();
                                                    setSelectedIds(prev => {
                                                        const next = new Set(prev);
                                                        if (allSelected) {
                                                            allGroupIds.forEach(id => next.delete(id));
                                                        } else {
                                                            allGroupIds.forEach(id => next.add(id));
                                                        }
                                                        return next;
                                                    });
                                                }}
                                                className="p-1 hover:bg-white/10 rounded transition-colors"
                                                title={allSelected ? 'Deseleccionar grupo' : 'Seleccionar grupo'}
                                            >
                                                {allSelected
                                                    ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                                                    : <Square className="w-3.5 h-3.5 text-slate-500" />
                                                }
                                            </button>
                                        )}
                                        {/* Assign button for unlinked batch groups */}
                                        {!group.isLinked && !group.isPending && group.key.startsWith('batch-') && (
                                            <button
                                                onClick={(ev) => {
                                                    ev.stopPropagation();
                                                    openAssignModal(group.key);
                                                }}
                                                className="flex items-center gap-1 px-2 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 text-[10px] font-bold rounded transition-colors"
                                                title="Asignar a proforma"
                                            >
                                                <LinkIcon className="w-3 h-3" /> Asignar
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Group photos */}
                                {isExpanded && (
                                    viewMode === 'gallery' ? (
                                        <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {group.items.map((e: any) => {
                                                const meta = e.metadata || {};
                                                const publicUrl = getPublicUrl(e.file_url);
                                                const isSelected = selectedIds.has(e.id);
                                                return (
                                                    <div key={e.id} className="relative group">
                                                        {/* Selection checkbox */}
                                                        <button
                                                            onClick={() => toggleSelect(e.id)}
                                                            className={`absolute top-2 left-2 z-20 p-1 rounded-md transition-all ${isSelected ? 'bg-cyan-600 text-white' : 'bg-black/40 text-white/60 opacity-0 group-hover:opacity-100'}`}
                                                        >
                                                            {isSelected
                                                                ? <CheckSquare className="w-4 h-4" />
                                                                : <Square className="w-4 h-4" />
                                                            }
                                                        </button>

                                                        <div
                                                            className={`overflow-hidden rounded-xl border transition-all cursor-pointer ${isSelected ? 'border-cyan-500/50 ring-1 ring-cyan-500/30' : 'border-white/5 hover:border-cyan-500/30'}`}
                                                            onClick={() => setPreview({ ...e, publicUrl })}
                                                        >
                                                            {/* Thumbnail */}
                                                            <div className="aspect-square bg-slate-800 relative overflow-hidden">
                                                                <img src={publicUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                <button className="absolute top-2 right-2 p-1.5 bg-black/40 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60">
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                                {e.file_size && (
                                                                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/50 rounded text-[9px] text-white/80 font-mono">
                                                                        {formatSize(e.file_size)}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Info */}
                                                            <div className="p-2.5 bg-slate-900/80 space-y-1.5">
                                                                {/* Capture date - prominent */}
                                                                {meta.dateTimeOriginal ? (
                                                                    <div className="flex items-center gap-1.5 text-xs text-purple-300 font-medium">
                                                                        <Calendar className="w-3 h-3 text-purple-400" />
                                                                        {meta.dateTimeOriginal}
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                                        <Calendar className="w-3 h-3" />
                                                                        {new Date(e.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                    </div>
                                                                )}

                                                                {/* Badges row */}
                                                                <div className="flex flex-wrap gap-1">
                                                                    {meta.camera && (meta.camera.make || meta.camera.model) && (
                                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-800/80 rounded text-[9px] text-slate-300">
                                                                            <Smartphone className="w-2.5 h-2.5 text-cyan-400" />
                                                                            {[meta.camera.make, meta.camera.model].filter(Boolean).join(' ')}
                                                                        </span>
                                                                    )}
                                                                    {meta.gps && (
                                                                        <a
                                                                            href={`https://maps.google.com/?q=${meta.gps.lat},${meta.gps.lng}`}
                                                                            target="_blank" rel="noreferrer"
                                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-900/30 rounded text-[9px] text-emerald-400 hover:bg-emerald-900/50"
                                                                            onClick={(ev) => ev.stopPropagation()}
                                                                        >
                                                                            <MapPin className="w-2.5 h-2.5" /> GPS
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        /* Table view inside group */
                                        <div className="overflow-x-auto border-t border-white/5">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-white/[0.02]">
                                                        <th className="px-4 py-2 w-8"></th>
                                                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">Preview</th>
                                                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">Fecha Captura</th>
                                                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">Camara</th>
                                                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">GPS</th>
                                                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">Archivo</th>
                                                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">SHA256</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {group.items.map((e: any) => {
                                                        const meta = e.metadata || {};
                                                        const publicUrl = getPublicUrl(e.file_url);
                                                        const isSelected = selectedIds.has(e.id);
                                                        return (
                                                            <tr
                                                                key={e.id}
                                                                className={`hover:bg-white/5 transition-colors cursor-pointer ${isSelected ? 'bg-cyan-500/5' : ''}`}
                                                                onClick={() => setPreview({ ...e, publicUrl })}
                                                            >
                                                                <td className="px-4 py-2" onClick={(ev) => ev.stopPropagation()}>
                                                                    <button onClick={() => toggleSelect(e.id)} className="p-0.5">
                                                                        {isSelected
                                                                            ? <CheckSquare className="w-4 h-4 text-cyan-400" />
                                                                            : <Square className="w-4 h-4 text-slate-600" />
                                                                        }
                                                                    </button>
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    <img src={publicUrl} alt="" className="w-10 h-10 rounded-lg object-cover" loading="lazy" />
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    <div className="text-xs text-purple-300 font-medium">
                                                                        {meta.dateTimeOriginal || '—'}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                                                        Subida: {new Date(e.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    <div className="text-xs text-white">
                                                                        {meta.camera ? [meta.camera.make, meta.camera.model].filter(Boolean).join(' ') : '—'}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    {meta.gps ? (
                                                                        <a
                                                                            href={`https://maps.google.com/?q=${meta.gps.lat},${meta.gps.lng}`}
                                                                            target="_blank" rel="noreferrer"
                                                                            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                                                                            onClick={(ev) => ev.stopPropagation()}
                                                                        >
                                                                            <MapPin className="w-3 h-3" />
                                                                            {Number(meta.gps.lat).toFixed(4)}, {Number(meta.gps.lng).toFixed(4)}
                                                                        </a>
                                                                    ) : <span className="text-xs text-slate-600">—</span>}
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    <div className="text-xs text-slate-300">{formatSize(e.file_size)}</div>
                                                                    <div className="text-[10px] text-slate-500">{e.mime_type}</div>
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    {e.sha256_hash ? (
                                                                        <span className="text-[10px] text-slate-500 font-mono" title={e.sha256_hash}>
                                                                            {e.sha256_hash.slice(0, 12)}...
                                                                        </span>
                                                                    ) : '—'}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )
                                )}
                            </GlowCard>
                        );
                    })}
                </div>
            )}

            {/* ── Assign to proforma modal ── */}
            {assignBatchId && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setAssignBatchId(null)}>
                    <div
                        className="bg-[#0a0f1d] border border-white/10 rounded-2xl p-6 max-w-md w-full max-h-[70vh] overflow-y-auto shadow-2xl"
                        onClick={(ev) => ev.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <LinkIcon className="w-5 h-5 text-cyan-400" />
                                Asignar a Proforma
                            </h3>
                            <button onClick={() => setAssignBatchId(null)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-slate-400 mb-4">Selecciona la proforma a la que vincular este grupo de fotos:</p>
                        <div className="space-y-2">
                            {availableQuotations.map((q: any) => (
                                <button
                                    key={q.id}
                                    onClick={() => assignBatchToProforma(q)}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/60 hover:bg-slate-700/60 border border-white/5 rounded-xl transition-colors text-left"
                                >
                                    <span className="text-sm font-bold text-white font-mono">{buildFolio(q) || `P-${q.proforma_number}`}</span>
                                    <span className="text-xs text-slate-500">
                                        {new Date(q.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                </button>
                            ))}
                            {availableQuotations.length === 0 && (
                                <p className="text-sm text-slate-500 text-center py-4">No hay proformas disponibles.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Full-screen preview ── */}
            {preview && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
                    <button className="absolute top-4 right-4 p-2 text-white/60 hover:text-white bg-white/10 rounded-xl z-10" onClick={() => setPreview(null)}>
                        <X className="w-6 h-6" />
                    </button>
                    <div className="max-w-5xl max-h-[90vh] flex flex-col md:flex-row gap-4" onClick={(ev) => ev.stopPropagation()}>
                        <img src={preview.publicUrl} alt="" className="max-h-[80vh] max-w-full md:max-w-[70%] object-contain rounded-xl" />
                        <div className="bg-slate-900/80 rounded-xl p-4 md:w-72 space-y-3 overflow-y-auto max-h-[80vh] border border-white/10 flex-shrink-0">
                            <h3 className="text-sm font-bold text-white">Metadatos EXIF</h3>

                            {/* Proforma link */}
                            {getFolioLabel(preview) && (
                                <div className="flex items-center gap-2">
                                    <Link2 className="w-4 h-4 text-cyan-400" />
                                    {preview.invoices?.quotation_id ? (
                                        <Link
                                            to={`/proformas/${preview.invoices.quotation_id}`}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-600/20 text-cyan-400 text-xs font-bold font-mono rounded hover:bg-cyan-600/30 hover:text-cyan-300 transition-colors"
                                        >
                                            {getFolioLabel(preview)}
                                            <ExternalLink className="w-3 h-3" />
                                        </Link>
                                    ) : (
                                        <span className="px-2 py-0.5 bg-cyan-600/20 text-cyan-400 text-xs font-bold font-mono rounded">
                                            {getFolioLabel(preview)}
                                        </span>
                                    )}
                                </div>
                            )}

                            {preview.metadata?.camera && (
                                <MetaRow icon={<Smartphone className="w-4 h-4 text-cyan-400" />} label="Dispositivo"
                                    value={[preview.metadata.camera.make, preview.metadata.camera.model].filter(Boolean).join(' ')} />
                            )}
                            {preview.metadata?.dateTimeOriginal && (
                                <MetaRow icon={<Calendar className="w-4 h-4 text-purple-400" />} label="Fecha de Captura"
                                    value={preview.metadata.dateTimeOriginal} />
                            )}
                            {preview.metadata?.gps && (
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">Ubicacion GPS</div>
                                    <a
                                        href={`https://maps.google.com/?q=${preview.metadata.gps.lat},${preview.metadata.gps.lng}`}
                                        target="_blank" rel="noreferrer"
                                        className="flex items-center gap-2 text-sm text-emerald-400 hover:underline"
                                    >
                                        <MapPin className="w-4 h-4" />
                                        {Number(preview.metadata.gps.lat).toFixed(6)}, {Number(preview.metadata.gps.lng).toFixed(6)}
                                    </a>
                                </div>
                            )}
                            {preview.metadata?.dimensions && (
                                <MetaRow icon={<Maximize2 className="w-4 h-4 text-blue-400" />} label="Dimensiones"
                                    value={`${preview.metadata.dimensions.w} x ${preview.metadata.dimensions.h} px`} />
                            )}
                            {preview.metadata?.photoParams && (
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">Parametros</div>
                                    <div className="space-y-1">
                                        {preview.metadata.photoParams.iso && (
                                            <div className="flex items-center gap-2 text-sm text-white">
                                                <Sun className="w-4 h-4 text-amber-400" /> ISO {preview.metadata.photoParams.iso}
                                            </div>
                                        )}
                                        {preview.metadata.photoParams.fNumber && (
                                            <div className="flex items-center gap-2 text-sm text-white">
                                                <Aperture className="w-4 h-4 text-pink-400" /> {preview.metadata.photoParams.fNumber}
                                            </div>
                                        )}
                                        {preview.metadata.photoParams.exposureTime && (
                                            <div className="flex items-center gap-2 text-sm text-white">
                                                <Clock className="w-4 h-4 text-orange-400" /> {preview.metadata.photoParams.exposureTime}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            <MetaRow icon={<ImageIcon className="w-4 h-4 text-slate-400" />} label="Archivo"
                                value={`${formatSize(preview.file_size)} · ${preview.mime_type || ''}`} />
                            {preview.sha256_hash && (
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">SHA256</div>
                                    <div className="text-[10px] text-slate-400 font-mono break-all">{preview.sha256_hash}</div>
                                </div>
                            )}
                            <MetaRow icon={<Clock className="w-4 h-4 text-slate-400" />} label="Fecha de Carga"
                                value={new Date(preview.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />

                            {/* Download single photo */}
                            <a
                                href={preview.publicUrl}
                                download={preview.file_url?.split('/').pop() || 'evidence.jpg'}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-xl transition-colors mt-4"
                            >
                                <Download className="w-4 h-4" /> Descargar
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-bold">{label}</div>
            <div className="flex items-center gap-2 text-sm text-white">{icon} {value}</div>
        </div>
    );
}

export default Evidence;
