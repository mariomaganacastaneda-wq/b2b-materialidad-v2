import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, AlertTriangle, Trash2, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface DeleteProformaDialogProps {
  quotationId: string;
  proformaLabel: string;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
  isAdmin?: boolean;
}

interface Blocker {
  type: string;
  count: number;
  message: string;
}

interface DiagnosticResult {
  success: boolean;
  dry_run?: boolean;
  message: string;
  blockers?: Blocker[];
  proforma?: {
    id: string;
    proforma_number: string;
    amount_total: number;
    currency: string;
    status: string;
  };
  will_delete?: {
    items: number;
    invoices: number;
    contracts: number;
    evidence: number;
  };
  orphaned_payments?: {
    count: number;
    total_amount: number;
    message: string;
  };
  storage_files?: string[];
  force?: boolean;
  deleted?: {
    items: number;
    invoices: number;
    contracts: number;
    evidence: number;
  };
}

export default function DeleteProformaDialog({
  quotationId,
  proformaLabel,
  isOpen,
  onClose,
  onDeleted,
  isAdmin = false,
}: DeleteProformaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  useEffect(() => {
    if (isOpen && quotationId && !isAdmin) {
      runDiagnostic();
    }
    if (!isOpen) {
      setDiagnostic(null);
      setError(null);
      setResult(null);
    }
  }, [isOpen, quotationId]);

  const runDiagnostic = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('delete_proforma_safe', {
        p_quotation_id: quotationId,
        p_dry_run: true,
      });
      if (rpcError) throw rpcError;
      setDiagnostic(data as DiagnosticResult);
    } catch (err: any) {
      setError(err.message || 'Error al diagnosticar la proforma');
    } finally {
      setLoading(false);
    }
  };

  const executeDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('delete_proforma_safe', {
        p_quotation_id: quotationId,
        p_dry_run: false,
        ...(isAdmin && { p_force: true }),
      });
      if (rpcError) throw rpcError;

      const res = data as DiagnosticResult;
      if (!res.success) {
        setError(res.message);
        return;
      }

      // Limpiar archivos de Storage (best-effort)
      if (res.storage_files && res.storage_files.length > 0) {
        for (const fileUrl of res.storage_files) {
          try {
            // Extraer bucket y path de URL de Supabase Storage
            const fullMatch = fileUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);
            if (fullMatch) {
              await supabase.storage.from(fullMatch[1]).remove([fullMatch[2]]);
            } else {
              const relMatch = fileUrl.match(/^([^/]+)\/(.+)/);
              if (relMatch) {
                await supabase.storage.from(relMatch[1]).remove([relMatch[2]]);
              }
            }
          } catch {
            // Storage cleanup es best-effort
          }
        }
      }

      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Error al eliminar la proforma');
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    if (result) {
      onDeleted();
    }
    onClose();
  };

  if (!isOpen) return null;

  const isBlocked = !isAdmin && diagnostic && !diagnostic.success;
  const canDelete = isAdmin || (diagnostic && diagnostic.success && diagnostic.dry_run);
  const hasOrphanedPayments = (diagnostic?.orphaned_payments || result?.orphaned_payments) &&
    ((diagnostic?.orphaned_payments?.count ?? 0) > 0 || (result?.orphaned_payments?.count ?? 0) > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              result ? 'bg-emerald-500/20' : isBlocked ? 'bg-red-500/20' : 'bg-amber-500/20'
            }`}>
              {result ? <CheckCircle className="text-emerald-400" size={20} /> :
               isBlocked ? <XCircle className="text-red-400" size={20} /> :
               <AlertTriangle className="text-amber-400" size={20} />}
            </div>
            <div>
              <h2 className="text-white font-bold text-sm">
                {result ? 'Proforma eliminada' :
                 isBlocked ? 'No se puede eliminar' :
                 isAdmin ? 'Eliminar proforma (Admin)' :
                 'Eliminar proforma'}
              </h2>
              <p className="text-slate-400 text-xs">{proformaLabel}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="text-cyan-400 animate-spin" size={28} />
              <span className="text-slate-400 text-sm">Analizando dependencias...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <XCircle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          )}

          {/* Resultado exitoso */}
          {result && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="text-emerald-300 text-sm font-medium">{result.message}</p>
                <div className="mt-2 text-emerald-400/70 text-xs space-y-1">
                  <p>{result.deleted?.items || 0} item(s) de linea eliminados</p>
                  <p>{result.deleted?.invoices || 0} factura(s) eliminada(s)</p>
                  <p>{result.deleted?.contracts || 0} contrato(s) eliminado(s)</p>
                  {(result.deleted?.evidence ?? 0) > 0 && (
                    <p>{result.deleted?.evidence} evidencia(s) eliminada(s)</p>
                  )}
                </div>
              </div>
              {result.orphaned_payments && result.orphaned_payments.count > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                  <AlertCircle className="text-amber-400 flex-shrink-0 mt-0.5" size={16} />
                  <span className="text-amber-300 text-sm">{result.orphaned_payments.message}</span>
                </div>
              )}
            </div>
          )}

          {/* Admin: Confirmacion directa sin diagnostico */}
          {isAdmin && !result && !loading && !error && (
            <div className="space-y-3">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-300 text-sm font-medium">Eliminacion administrativa sin restricciones</p>
                <p className="text-red-400/70 text-xs mt-2">
                  Esta accion eliminara la proforma y TODOS sus documentos asociados:
                </p>
                <ul className="text-red-400/70 text-xs mt-1 space-y-0.5 list-disc list-inside">
                  <li>Facturas (incluyendo timbradas)</li>
                  <li>Contratos (incluyendo con archivo)</li>
                  <li>Evidencia fotografica</li>
                  <li>Items de linea</li>
                </ul>
                <p className="text-red-300 text-xs mt-2 font-bold">Esta accion no se puede deshacer.</p>
              </div>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="text-amber-400 flex-shrink-0 mt-0.5" size={16} />
                <span className="text-amber-300 text-xs">Los pagos asociados se conservaran y quedaran sin proforma asignada.</span>
              </div>
            </div>
          )}

          {/* Diagnostico: BLOQUEADA */}
          {isBlocked && diagnostic && (
            <div className="space-y-3">
              <p className="text-slate-300 text-sm">{diagnostic.message}</p>
              <div className="space-y-2">
                {diagnostic.blockers?.map((blocker, i) => (
                  <div key={i} className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                    <XCircle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
                    <span className="text-red-300 text-sm">{blocker.message}</span>
                  </div>
                ))}
              </div>
              <p className="text-slate-500 text-xs">
                Debe eliminar o cancelar los documentos bloqueantes antes de poder eliminar esta proforma.
              </p>
            </div>
          )}

          {/* Diagnostico: PERMITIDA */}
          {canDelete && diagnostic && (
            <div className="space-y-3">
              {/* Resumen de proforma */}
              {diagnostic.proforma && (
                <div className="p-3 bg-slate-800/60 border border-white/5 rounded-xl">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-xs">Monto</span>
                    <span className="text-white font-bold text-sm">
                      ${new Intl.NumberFormat('es-MX').format(diagnostic.proforma.amount_total)} {diagnostic.proforma.currency}
                    </span>
                  </div>
                </div>
              )}

              {/* Que se eliminara */}
              <div className="p-3 bg-slate-800/40 border border-white/5 rounded-xl space-y-1">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Se eliminara:</p>
                <p className="text-slate-300 text-sm">{diagnostic.will_delete?.items || 0} item(s) de linea</p>
                <p className="text-slate-300 text-sm">{diagnostic.will_delete?.invoices || 0} factura(s) no timbrada(s)</p>
                <p className="text-slate-300 text-sm">{diagnostic.will_delete?.contracts || 0} contrato(s) sin archivo</p>
              </div>

              {/* Aviso de pagos huerfanos */}
              {hasOrphanedPayments && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                  <AlertCircle className="text-amber-400 flex-shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="text-amber-300 text-sm font-medium">
                      {diagnostic.orphaned_payments!.count} pago(s) por ${new Intl.NumberFormat('es-MX').format(diagnostic.orphaned_payments!.total_amount)} quedaran sin proforma
                    </p>
                    <p className="text-amber-400/60 text-xs mt-1">
                      Puede reasignarlos desde la seccion de Pagos.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10">
          {result ? (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-colors"
            >
              Cerrar
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                onClick={executeDelete}
                disabled={!canDelete || deleting}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  canDelete && !deleting
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                {deleting ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Eliminar proforma
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
