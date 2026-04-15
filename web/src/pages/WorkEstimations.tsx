import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { GlowCard } from '../components/ui/GlowCard';
import { TextGlitch } from '../components/ui/TextGlitch';
import {
    Plus, Search, Eye, Trash2, CheckCircle2, XCircle,
    Upload, FileText, Loader2, Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
    <span className={'material-symbols-outlined ' + className} style={{ fontSize: 'inherit' }}>{name}</span>
);

interface WorkEstimationsProps {
    selectedOrg: any;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fmt = (n: number | null | undefined) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0);

const fmtPct = (n: number | null | undefined) =>
    `${(n ?? 0).toFixed(1)}%`;

const statusBadge = (status: string | null) => {
    const s = (status ?? 'borrador').toLowerCase();
    const map: Record<string, string> = {
        borrador: 'bg-slate-500/20 border-slate-500/40 text-slate-400',
        aprobado: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400',
        en_ejecucion: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
        completado: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
        pagada: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
        rechazada: 'bg-red-500/20 border-red-500/40 text-red-400',
        validada: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
        enviada: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400',
    };
    return map[s] || map.borrador;
};

const statusLabel = (status: string | null) => {
    const s = (status ?? 'borrador').toLowerCase();
    const map: Record<string, string> = {
        borrador: 'Borrador',
        aprobado: 'Aprobado',
        en_ejecucion: 'En Ejecucion',
        completado: 'Completado',
        pagada: 'Pagada',
        rechazada: 'Rechazada',
        validada: 'Validada',
        enviada: 'Enviada',
    };
    return map[s] || s;
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

const WorkEstimations: React.FC<WorkEstimationsProps> = ({ selectedOrg }) => {
    /* ---------- state ---------- */
    const [budgets, setBudgets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Budget detail modal
    const [selectedBudget, setSelectedBudget] = useState<any | null>(null);
    const [budgetItems, setBudgetItems] = useState<any[]>([]);
    const [estimations, setEstimations] = useState<any[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // New estimation modal
    const [showNewEstimation, setShowNewEstimation] = useState(false);
    const [editingEstimation, setEditingEstimation] = useState<any>(null);
    const [estPeriodFrom, setEstPeriodFrom] = useState('');
    const [estPeriodTo, setEstPeriodTo] = useState('');
    const [estNotes, setEstNotes] = useState('');
    const [estItems, setEstItems] = useState<any[]>([]);
    const [savingEstimation, setSavingEstimation] = useState(false);

    // New budget modal
    const [showNewBudget, setShowNewBudget] = useState(false);
    const [newBudgetNumber, setNewBudgetNumber] = useState('');
    const [newBudgetDate, setNewBudgetDate] = useState(new Date().toISOString().split('T')[0]);
    const [newBudgetDescription, setNewBudgetDescription] = useState('');
    const [newBudgetAnticipo, setNewBudgetAnticipo] = useState('');
    const [newBudgetFile, setNewBudgetFile] = useState<File | null>(null);
    const [newBudgetClient, setNewBudgetClient] = useState('');
    const [clients, setClients] = useState<any[]>([]);
    const [parsingExcel, setParsingExcel] = useState(false);
    const [newBudgetPartidas, setNewBudgetPartidas] = useState<any[]>([
        { description: '', unit: '', quantity: '', unit_price: '' },
    ]);
    const [savingBudget, setSavingBudget] = useState(false);

    /* ---------- fetch budgets ---------- */
    const fetchBudgets = useCallback(async () => {
        if (!selectedOrg?.id) {
            setBudgets([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('work_budgets')
                .select('*, work_estimations(amount_total, status), client:organizations!client_org_id(name, rfc)')
                .eq('organization_id', selectedOrg.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setBudgets(data || []);
        } catch (err) {
            console.error('Error cargando presupuestos:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedOrg?.id]);

    useEffect(() => {
        fetchBudgets();
    }, [fetchBudgets]);

    // Cargar clientes (organizaciones con is_client=true)
    useEffect(() => {
        const loadClients = async () => {
            const { data } = await supabase
                .from('organizations')
                .select('id, name, rfc')
                .eq('is_client', true)
                .order('name');
            setClients(data || []);
        };
        loadClients();
    }, []);

    // Parser de Excel: extrae partidas automáticamente al subir archivo
    const parseExcelFile = async (file: File) => {
        setParsingExcel(true);
        try {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array' });
            const sheetName = wb.SheetNames[0];
            const ws = wb.Sheets[sheetName];
            const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

            // Buscar fila de encabezado (que contenga "concepto" o "descripcion")
            let headerIdx = -1;
            for (let i = 0; i < Math.min(rows.length, 15); i++) {
                const row = (rows[i] || []).map((c: any) => String(c || '').toLowerCase());
                if (row.some((c: string) => c.includes('concepto') || c.includes('descripcion') || c.includes('descripción'))) {
                    headerIdx = i;
                    break;
                }
            }

            // Mapear columnas por nombre
            const header = headerIdx >= 0 ? rows[headerIdx].map((c: any) => String(c || '').toLowerCase().trim()) : [];
            const findCol = (keywords: string[]) => header.findIndex(h => keywords.some(k => h.includes(k)));

            const colDesc = findCol(['concepto', 'descripcion', 'descripción', 'trabajo']);
            const colUnit = findCol(['unidad', 'und', 'u.m.']);
            const colQty = findCol(['cantidad', 'cant', 'vol']);
            const colPU = findCol(['unitario', 'p.u.', 'pu', 'precio']);
            const colImporte = findCol(['importe', 'total', 'monto']);

            const partidas: any[] = [];
            const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows.slice(1);

            for (const row of dataRows) {
                if (!row || row.length < 3) continue;
                const desc = colDesc >= 0 ? String(row[colDesc] || '').trim() : '';
                const unit = colUnit >= 0 ? String(row[colUnit] || '').trim() : '';
                const qty = colQty >= 0 ? parseFloat(row[colQty]) || 0 : 0;
                const pu = colPU >= 0 ? parseFloat(row[colPU]) || 0 : 0;

                // Saltar filas vacías, totales, subtotales
                if (!desc || desc.toLowerCase().includes('subtotal') || desc.toLowerCase().includes('total') || desc.toLowerCase().includes('iva')) continue;
                if (qty === 0 && pu === 0) continue;

                partidas.push({
                    description: desc,
                    unit: unit || 'PZA',
                    quantity: String(qty || 1),
                    unit_price: String(pu || 0),
                });
            }

            if (partidas.length > 0) {
                setNewBudgetPartidas(partidas);
            } else {
                alert('No se encontraron partidas en el Excel. Verifica que tenga columnas: Concepto, Unidad, Cantidad, P.U.');
            }
        } catch (err) {
            console.error('Error parseando Excel:', err);
            alert('Error al leer el archivo Excel: ' + (err as any)?.message);
        } finally {
            setParsingExcel(false);
        }
    };

    // Handler del input file: parsea automáticamente
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setNewBudgetFile(file);
        if (file) parseExcelFile(file);
    };

    /* ---------- budget progress ---------- */
    // Avance de obra = solo estimaciones (trabajo ejecutado, sin anticipo)
    const budgetProgress = (b: any) => {
        const total = b.total_amount ?? 0;
        if (total === 0) return 0;
        const estimationsArr: any[] = b.work_estimations ?? [];
        const sumEstimated = estimationsArr.reduce((acc: number, e: any) => acc + (e.amount_total ?? 0), 0);
        return Math.min((sumEstimated / total) * 100, 100);
    };

    /* ---------- open budget detail ---------- */
    const openBudgetDetail = async (budget: any) => {
        setSelectedBudget(budget);
        setLoadingDetail(true);
        try {
            const [itemsRes, estRes] = await Promise.all([
                supabase
                    .from('work_budget_items')
                    .select('*')
                    .eq('work_budget_id', budget.id)
                    .order('item_number', { ascending: true }),
                supabase
                    .from('work_estimations')
                    .select('*')
                    .eq('work_budget_id', budget.id)
                    .order('estimation_number', { ascending: true }),
            ]);
            if (itemsRes.error) throw itemsRes.error;
            if (estRes.error) throw estRes.error;
            setBudgetItems(itemsRes.data || []);
            setEstimations(estRes.data || []);
        } catch (err) {
            console.error('Error cargando detalle del presupuesto:', err);
        } finally {
            setLoadingDetail(false);
        }
    };

    /* ---------- open new estimation ---------- */
    const openNewEstimation = async () => {
        if (!selectedBudget) return;
        setEstPeriodFrom('');
        setEstPeriodTo('');
        setEstNotes('');

        // Fetch latest accumulated volumes for each budget item
        const items = budgetItems.map((bi: any) => ({
            work_budget_item_id: bi.id,
            item_number: bi.item_number,
            description: bi.description,
            unit: bi.unit,
            quantity: bi.quantity,
            unit_price: bi.unit_price,
            volume_previous: 0,
            volume_this_estimation: 0,
        }));

        // For each item, find the accumulated volume from existing estimations
        if (estimations.length > 0) {
            const latestEstimation = estimations[estimations.length - 1];
            const { data: latestItems } = await supabase
                .from('work_estimation_items')
                .select('*')
                .eq('work_estimation_id', latestEstimation.id);

            if (latestItems) {
                for (const li of latestItems) {
                    const match = items.find((i: any) => i.work_budget_item_id === li.work_budget_item_id);
                    if (match) {
                        match.volume_previous = li.volume_accumulated ?? 0;
                    }
                }
            }
        }

        setEstItems(items);
        setEditingEstimation(null);
        setShowNewEstimation(true);
    };

    /* ---------- estimation calculations ---------- */
    const updateEstItemVolume = (idx: number, value: string) => {
        setEstItems((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], volume_this_estimation: parseFloat(value) || 0 };
            return next;
        });
    };

    const estItemCalc = (item: any) => {
        const volThis = item.volume_this_estimation ?? 0;
        const volPrev = item.volume_previous ?? 0;
        const up = item.unit_price ?? 0;
        const qty = item.quantity ?? 0;
        const amountThis = volThis * up;
        const volAccumulated = volPrev + volThis;
        const volRemaining = qty - volAccumulated;
        return { amountThis, volAccumulated, volRemaining };
    };

    const estTotals = () => {
        let subtotal = 0;
        for (const item of estItems) {
            const { amountThis } = estItemCalc(item);
            subtotal += amountThis;
        }
        const iva = subtotal * 0.16;
        const total = subtotal + iva;
        return { subtotal, iva, total };
    };

    /* ---------- edit existing draft estimation ---------- */
    const editEstimation = async (est: any) => {
        if (!selectedBudget) return;
        setEditingEstimation(est);
        setEstPeriodFrom(est.period_from || '');
        setEstPeriodTo(est.period_to || '');
        setEstNotes(est.notes || '');

        // Cargar items existentes de esta estimación
        const { data: existingItems } = await supabase
            .from('work_estimation_items')
            .select('*')
            .eq('work_estimation_id', est.id);

        // Cargar partidas del presupuesto
        const items = budgetItems.map((bi: any) => {
            const existing = existingItems?.find((ei: any) => ei.work_budget_item_id === bi.id);
            return {
                work_budget_item_id: bi.id,
                item_number: bi.item_number,
                description: bi.description,
                unit: bi.unit,
                quantity: bi.quantity,
                unit_price: bi.unit_price,
                volume_previous: existing ? (existing.volume_accumulated - existing.volume_this_estimation) : 0,
                volume_this_estimation: existing?.volume_this_estimation || 0,
            };
        });

        setEstItems(items);
        setShowNewEstimation(true);
    };

    /* ---------- save estimation ---------- */
    const saveEstimation = async (sendForValidation: boolean) => {
        if (!selectedBudget || !selectedOrg?.id) { alert('Selecciona un presupuesto'); return; }
        setSavingEstimation(true);
        try {
            const totals = estTotals();
            console.log('[EST] Guardando estimación:', { totals, items: estItems.filter((it: any) => it.volume_this_estimation > 0).length });
            const nextNumber = estimations.length + 1;

            // Calculate accumulated previous total
            const accPrevious = estimations.reduce((acc: number, e: any) => acc + (e.amount_total ?? 0), 0);

            // Calculate progress
            const budgetTotal = selectedBudget.total_amount ?? 0;
            const accTotal = accPrevious + totals.total;
            const remaining = budgetTotal - accTotal;
            const progressPct = budgetTotal > 0 ? (accTotal / budgetTotal) * 100 : 0;

            // Amortización de anticipo — fórmula obra civil:
            // % = anticipo / subtotal_presupuesto
            // amortización = subtotal_esta_est × %
            // IVA se aplica DESPUÉS de restar amortización
            const anticipoMonto = parseFloat(selectedBudget.anticipo_amount) || 0;
            const budgetSub = parseFloat(selectedBudget.amount_subtotal) || 1;
            const pctAmort = budgetSub > 0 ? anticipoMonto / budgetSub : 0;
            const amortEst = totals.subtotal * pctAmort;
            const amortPrevio = estimations.reduce((acc: number, e: any) => acc + (parseFloat(e.anticipo_amortizado_est) || 0), 0);
            const anticipoPendiente = Math.max(0, anticipoMonto - amortPrevio);
            const anticipoAmortizadoReal = Math.min(amortEst, anticipoPendiente);

            const estPayload = {
                work_budget_id: selectedBudget.id,
                organization_id: selectedOrg.id,
                estimation_number: editingEstimation ? editingEstimation.estimation_number : nextNumber,
                period_from: estPeriodFrom || null,
                period_to: estPeriodTo || null,
                amount_subtotal: totals.subtotal,
                amount_iva: totals.iva,
                amount_total: totals.total,
                accumulated_previous: accPrevious,
                accumulated_total: accTotal,
                remaining: remaining,
                anticipo_amortizado_est: anticipoAmortizadoReal,
                progress_percentage: Math.round(progressPct),
                status: sendForValidation ? 'enviada' : 'borrador',
                notes: estNotes || null,
            };

            let newEst: any;
            if (editingEstimation) {
                // UPDATE borrador existente
                const { data, error: estError } = await supabase
                    .from('work_estimations')
                    .update(estPayload)
                    .eq('id', editingEstimation.id)
                    .select()
                    .single();
                if (estError) throw estError;
                newEst = data;
                // Eliminar items anteriores para reinsertarlos
                await supabase.from('work_estimation_items').delete().eq('work_estimation_id', editingEstimation.id);
            } else {
                // INSERT nueva estimación
                const { data, error: estError } = await supabase
                    .from('work_estimations')
                    .insert(estPayload)
                    .select()
                    .single();
                if (estError) throw estError;
                newEst = data;
            }

            // Insertar trabajos adicionales al presupuesto primero
            const extraItems = estItems.filter((it: any) => it.is_extra && it.description?.trim() && it.volume_this_estimation > 0);
            for (const extra of extraItems) {
                const { data: newBudgetItem, error: biErr } = await supabase
                    .from('work_budget_items')
                    .insert({
                        work_budget_id: selectedBudget.id,
                        item_number: extra.item_number,
                        description: extra.description.trim(),
                        unit: extra.unit || 'PZA',
                        quantity: extra.quantity || extra.volume_this_estimation,
                        unit_price: extra.unit_price,
                        amount: (extra.quantity || extra.volume_this_estimation) * extra.unit_price,
                    })
                    .select()
                    .single();
                if (biErr) throw biErr;
                extra.work_budget_item_id = newBudgetItem.id;
            }

            // Insert estimation items (normales + extras)
            const itemsToInsert = estItems
                .filter((it: any) => it.volume_this_estimation > 0 && it.work_budget_item_id)
                .map((it: any) => {
                    const calc = estItemCalc(it);
                    return {
                        work_estimation_id: newEst.id,
                        work_budget_item_id: it.work_budget_item_id,
                        volume_previous: it.volume_previous,
                        volume_this_estimation: it.volume_this_estimation,
                        volume_accumulated: calc.volAccumulated,
                        volume_remaining: calc.volRemaining,
                        amount_this_estimation: calc.amountThis,
                        amount_accumulated: (it.volume_previous * it.unit_price) + calc.amountThis,
                    };
                });

            if (itemsToInsert.length > 0) {
                const { error: itemsError } = await supabase
                    .from('work_estimation_items')
                    .insert(itemsToInsert);
                if (itemsError) throw itemsError;
            }

            // Actualizar total del presupuesto si hay extras
            if (extraItems.length > 0) {
                const extraTotal = extraItems.reduce((acc: number, it: any) => acc + ((it.quantity || it.volume_this_estimation) * it.unit_price), 0);
                const newBudgetTotal = (parseFloat(selectedBudget.amount_subtotal) || 0) + extraTotal;
                await supabase.from('work_budgets').update({
                    amount_subtotal: newBudgetTotal,
                    amount_iva: newBudgetTotal * 0.16,
                    total_amount: newBudgetTotal * 1.16,
                }).eq('id', selectedBudget.id);
            }

            // Actualizar anticipo_amortizado acumulado en el presupuesto
            const totalAmortizadoAcumulado = amortPrevio + anticipoAmortizadoReal;
            await supabase
                .from('work_budgets')
                .update({
                    anticipo_amortizado: Math.min(totalAmortizadoAcumulado, anticipoMonto),
                    status: progressPct >= 100 ? 'completado' : 'en_ejecucion',
                })
                .eq('id', selectedBudget.id);

            { setShowNewEstimation(false); setEditingEstimation(null); };
            // Refresh detail
            await openBudgetDetail(selectedBudget);
            await fetchBudgets();
        } catch (err: any) {
            console.error('Error guardando estimacion:', err);
            alert('Error al guardar estimación: ' + (err?.message || JSON.stringify(err)));
        } finally {
            setSavingEstimation(false);
        }
    };

    /* ---------- delete estimation ---------- */
    const deleteEstimation = async (estimation: any) => {
        if (!confirm(`Eliminar Estimacion #${estimation.estimation_number}?`)) return;
        try {
            await supabase
                .from('work_estimation_items')
                .delete()
                .eq('work_estimation_id', estimation.id);
            await supabase
                .from('work_estimations')
                .delete()
                .eq('id', estimation.id);
            await openBudgetDetail(selectedBudget);
            await fetchBudgets();
        } catch (err) {
            console.error('Error eliminando estimacion:', err);
        }
    };

    /* ---------- save new budget ---------- */
    const saveNewBudget = async () => {
        if (!selectedOrg?.id) { alert('Selecciona una organización'); return; }
        if (!newBudgetNumber.trim()) { alert('Escribe el número de presupuesto'); return; }
        setSavingBudget(true);
        try {
            // Upload file if provided
            let sourceFileUrl: string | null = null;
            if (newBudgetFile) {
                const ext = newBudgetFile.name.split('.').pop();
                const fileName = `${selectedOrg.id}_budget_${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from('work-budgets')
                    .upload(fileName, newBudgetFile, {
                        cacheControl: '3600',
                        upsert: true,
                        contentType: newBudgetFile.type || 'application/octet-stream',
                    });
                if (uploadError) throw uploadError;
                const { data: urlData } = supabase.storage
                    .from('work-budgets')
                    .getPublicUrl(fileName);
                sourceFileUrl = urlData?.publicUrl || null;
            }

            // Calculate totals from partidas
            const validPartidas = newBudgetPartidas.filter(
                (p: any) => p.description.trim() && parseFloat(p.quantity) > 0 && parseFloat(p.unit_price) > 0
            );
            const subtotal = validPartidas.reduce(
                (acc: number, p: any) => acc + parseFloat(p.quantity) * parseFloat(p.unit_price),
                0
            );
            const iva = subtotal * 0.16;
            const total = subtotal + iva;

            const { data: newBudget, error: budgetError } = await supabase
                .from('work_budgets')
                .insert({
                    organization_id: selectedOrg.id,
                    client_org_id: newBudgetClient || null,
                    budget_number: newBudgetNumber.trim(),
                    budget_date: newBudgetDate || new Date().toISOString().split('T')[0],
                    description: newBudgetDescription.trim() || null,
                    total_amount: total,
                    amount_subtotal: subtotal,
                    amount_iva: iva,
                    anticipo_amount: parseFloat(newBudgetAnticipo) || 0,
                    anticipo_amortizado: 0,
                    source_file_url: sourceFileUrl,
                    status: 'borrador',
                })
                .select()
                .single();

            if (budgetError) throw budgetError;

            // Insert items
            if (validPartidas.length > 0) {
                const itemsToInsert = validPartidas.map((p: any, idx: number) => ({
                    work_budget_id: newBudget.id,
                    item_number: idx + 1,
                    description: p.description.trim(),
                    unit: p.unit.trim() || 'PZA',
                    quantity: parseFloat(p.quantity),
                    unit_price: parseFloat(p.unit_price),
                    amount: parseFloat(p.quantity) * parseFloat(p.unit_price),
                }));
                const { error: itemsError } = await supabase
                    .from('work_budget_items')
                    .insert(itemsToInsert);
                if (itemsError) throw itemsError;
            }

            setShowNewBudget(false);
            resetNewBudgetForm();
            await fetchBudgets();
        } catch (err) {
            console.error('Error creando presupuesto:', err);
            alert('Error al guardar: ' + ((err as any)?.message || JSON.stringify(err)));
        } finally {
            setSavingBudget(false);
        }
    };

    const resetNewBudgetForm = () => {
        setNewBudgetNumber('');
        setNewBudgetDate(new Date().toISOString().split('T')[0]);
        setNewBudgetDescription('');
        setNewBudgetAnticipo('');
        setNewBudgetFile(null);
        setNewBudgetClient('');
        setNewBudgetPartidas([{ description: '', unit: '', quantity: '', unit_price: '' }]);
    };

    /* ---------- partidas helpers ---------- */
    const addPartida = () => {
        setNewBudgetPartidas((prev) => [
            ...prev,
            { description: '', unit: '', quantity: '', unit_price: '' },
        ]);
    };

    const removePartida = (idx: number) => {
        setNewBudgetPartidas((prev) => prev.filter((_: any, i: number) => i !== idx));
    };

    const updatePartida = (idx: number, field: string, value: string) => {
        setNewBudgetPartidas((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    /* ---------- delete budget ---------- */
    const deleteBudget = async (budget: any) => {
        if (!confirm(`Eliminar presupuesto ${budget.budget_number}? Se eliminaran todas sus estimaciones y partidas.`)) return;
        try {
            // Delete estimation items for all estimations of this budget
            const { data: ests } = await supabase
                .from('work_estimations')
                .select('id')
                .eq('work_budget_id', budget.id);
            if (ests && ests.length > 0) {
                for (const est of ests) {
                    await supabase.from('work_estimation_items').delete().eq('work_estimation_id', est.id);
                }
                await supabase.from('work_estimations').delete().eq('work_budget_id', budget.id);
            }
            await supabase.from('work_budget_items').delete().eq('work_budget_id', budget.id);
            await supabase.from('work_budgets').delete().eq('id', budget.id);

            setSelectedBudget(null);
            await fetchBudgets();
        } catch (err) {
            console.error('Error eliminando presupuesto:', err);
        }
    };

    /* ---------- filter ---------- */
    const filtered = budgets.filter((b: any) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            (b.budget_number ?? '').toLowerCase().includes(q) ||
            (b.description ?? '').toLowerCase().includes(q)
        );
    });

    /* ================================================================ */
    /*  RENDER                                                          */
    /* ================================================================ */

    return (
        <div className="space-y-6">
            {/* ---- Header ---- */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 text-2xl">
                        <Icon name="engineering" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            <TextGlitch text="Estimaciones de Obra" />
                        </h1>
                        <p className="text-sm text-slate-400">Presupuestos y estimaciones de obra civil</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        resetNewBudgetForm();
                        const nextNum = (budgets.length + 1).toString().padStart(3, '0');
                        const prefix = selectedOrg?.rfc?.match(/^[A-Z&]{3,4}/)?.[0] || 'PPTO';
                        setNewBudgetNumber(`${prefix}-${nextNum}`);
                        setNewBudgetDate(new Date().toISOString().split('T')[0]);
                        setShowNewBudget(true);
                    }}
                    className="px-4 py-2.5 font-bold rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 flex items-center gap-2 text-sm transition-colors"
                >
                    <Plus size={16} /> Nuevo Presupuesto
                </button>
            </div>

            {/* ---- Search ---- */}
            <div className="relative max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar presupuesto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
            </div>

            {/* ---- Budget list ---- */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
                    <Loader2 size={20} className="animate-spin" /> Cargando presupuestos...
                </div>
            ) : !selectedOrg?.id ? (
                <GlowCard>
                    <div className="text-center py-12 text-slate-400">
                        <Icon name="domain" className="text-4xl" />
                        <p className="mt-2">Selecciona una organizacion para ver presupuestos</p>
                    </div>
                </GlowCard>
            ) : filtered.length === 0 ? (
                <GlowCard>
                    <div className="text-center py-12 text-slate-400">
                        <FileText size={40} className="mx-auto mb-3 opacity-50" />
                        <p>No hay presupuestos registrados</p>
                        <p className="text-xs mt-1">Crea uno con el boton "+ Nuevo Presupuesto"</p>
                    </div>
                </GlowCard>
            ) : (
                <div className="grid gap-4">
                    {filtered.map((b: any) => {
                        const pct = budgetProgress(b);
                        const anticipo = parseFloat(b.anticipo_amount) || 0;
                        const estimado = (b.work_estimations || []).reduce((acc: number, e: any) => acc + (parseFloat(e.amount_total) || 0), 0);
                        const cobrado = anticipo + estimado;
                        const saldo = (parseFloat(b.total_amount) || 0) - cobrado;
                        const clientName = b.client?.name || '';
                        return (
                            <GlowCard key={b.id}>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-sm text-cyan-400 font-bold">
                                                {b.budget_number}
                                            </span>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusBadge(b.status)}`}>
                                                {statusLabel(b.status)}
                                            </span>
                                        </div>
                                        {clientName && (
                                            <p className="text-xs text-amber-400 font-bold mt-1 uppercase">{clientName}</p>
                                        )}
                                        <p className="text-sm text-slate-300 mt-0.5 truncate">
                                            {b.description || 'Sin descripcion'}
                                        </p>
                                    </div>

                                    {/* Montos */}
                                    <div className="flex gap-4 text-center">
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Total</p>
                                            <p className="text-sm font-bold text-white">{fmt(b.total_amount)}</p>
                                        </div>
                                        {anticipo > 0 && (
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase font-bold">Anticipo</p>
                                                <p className="text-sm font-bold text-cyan-400">{fmt(anticipo)}</p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Estimado</p>
                                            <p className="text-sm font-bold text-emerald-400">{fmt(estimado)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Saldo</p>
                                            <p className={`text-sm font-bold ${saldo > 0 ? 'text-amber-400' : saldo < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {fmt(saldo)} {saldo < 0 && <span className="text-[9px]">(excedido)</span>}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Barras de progreso */}
                                    <div className="sm:w-48 space-y-2">
                                        {/* Barra de pagos (anticipo + estimaciones) */}
                                        {(() => {
                                            const pagosPct = parseFloat(b.total_amount) > 0 ? (cobrado / parseFloat(b.total_amount)) * 100 : 0;
                                            const excedido = pagosPct > 100;
                                            return (
                                                <div className="space-y-0.5">
                                                    <div className="flex justify-between text-[10px] text-slate-400">
                                                        <span className="font-bold uppercase">Pagos</span>
                                                        <span className={`font-bold ${excedido ? 'text-red-400' : 'text-emerald-400'}`}>{fmtPct(pagosPct)}</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${excedido ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-emerald-600 to-emerald-400'}`}
                                                            style={{ width: `${Math.min(pagosPct, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        {/* Barra de avance de obra (estimaciones sin anticipo) */}
                                        <div className="space-y-0.5">
                                            <div className="flex justify-between text-[10px] text-slate-400">
                                                <span className="font-bold uppercase">Obra</span>
                                                <span className="text-cyan-400 font-bold">{fmtPct(pct)}</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-500"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openBudgetDetail(b)}
                                            className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:text-cyan-400 hover:bg-slate-700 transition-colors"
                                            title="Ver detalle"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            onClick={() => deleteBudget(b)}
                                            className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:text-red-400 hover:bg-slate-700 transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </GlowCard>
                        );
                    })}
                </div>
            )}

            {/* ================================================================ */}
            {/*  MODAL: Detalle de Presupuesto                                   */}
            {/* ================================================================ */}
            {selectedBudget && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Icon name="engineering" className="text-cyan-400" />
                                    Presupuesto {selectedBudget.budget_number}
                                </h2>
                                <p className="text-sm text-slate-400 mt-1">{selectedBudget.description || 'Sin descripcion'}</p>
                            </div>
                            <button
                                onClick={() => setSelectedBudget(null)}
                                className="text-slate-400 hover:text-white transition-colors text-xl"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {loadingDetail ? (
                                <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                                    <Loader2 size={20} className="animate-spin" /> Cargando...
                                </div>
                            ) : (
                                <>
                                    {/* Budget summary */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                                            <p className="text-xs text-slate-400 uppercase tracking-wide">Total</p>
                                            <p className="text-lg font-bold text-white mt-1">{fmt(selectedBudget.total_amount)}</p>
                                        </div>
                                        <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                                            <p className="text-xs text-slate-400 uppercase tracking-wide">Anticipo</p>
                                            <p className="text-lg font-bold text-white mt-1">{fmt(selectedBudget.anticipo_amount)}</p>
                                        </div>
                                        <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                                            <p className="text-xs text-slate-400 uppercase tracking-wide">Estimaciones</p>
                                            <p className="text-lg font-bold text-white mt-1">{estimations.length}</p>
                                        </div>
                                        <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                                            <p className="text-xs text-slate-400 uppercase tracking-wide">Status</p>
                                            <span className={`inline-block text-xs uppercase font-bold px-2 py-1 rounded-full border mt-1 ${statusBadge(selectedBudget.status)}`}>
                                                {statusLabel(selectedBudget.status)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Budget items table */}
                                    <div>
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-3">
                                            Partidas del Presupuesto
                                        </h3>
                                        {budgetItems.length === 0 ? (
                                            <p className="text-sm text-slate-500 py-4 text-center">Sin partidas registradas</p>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="text-xs text-slate-400 uppercase border-b border-white/5">
                                                            <th className="text-left py-2 px-2 w-12">#</th>
                                                            <th className="text-left py-2 px-2">Concepto</th>
                                                            <th className="text-left py-2 px-2 w-20">Unidad</th>
                                                            <th className="text-right py-2 px-2 w-24">Cantidad</th>
                                                            <th className="text-right py-2 px-2 w-28">P.U.</th>
                                                            <th className="text-right py-2 px-2 w-32">Importe</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {budgetItems.map((bi: any) => (
                                                            <tr key={bi.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                                                <td className="py-2 px-2 text-slate-400 font-mono">{bi.item_number}</td>
                                                                <td className="py-2 px-2 text-slate-200">{bi.description}</td>
                                                                <td className="py-2 px-2 text-slate-400">{bi.unit}</td>
                                                                <td className="py-2 px-2 text-right text-slate-300">{bi.quantity?.toLocaleString('es-MX')}</td>
                                                                <td className="py-2 px-2 text-right text-slate-300">{fmt(bi.unit_price)}</td>
                                                                <td className="py-2 px-2 text-right text-white font-medium">{fmt(bi.amount)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Estimations list */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                                                Estimaciones
                                            </h3>
                                            <button
                                                onClick={openNewEstimation}
                                                className="px-4 py-2.5 font-bold rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 flex items-center gap-2 text-sm transition-colors"
                                            >
                                                <Plus size={14} /> Nueva Estimacion
                                            </button>
                                        </div>

                                        {estimations.length === 0 ? (
                                            <p className="text-sm text-slate-500 py-4 text-center">Sin estimaciones</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {estimations.map((est: any) => (
                                                    <div
                                                        key={est.id}
                                                        className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-800/50 rounded-xl p-4 border border-white/5"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-mono text-sm font-bold text-cyan-400">
                                                                    EST #{est.estimation_number}
                                                                </span>
                                                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusBadge(est.status)}`}>
                                                                    {statusLabel(est.status)}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-400 mt-1">
                                                                Periodo: {est.period_from || '—'} al {est.period_to || '—'}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-6 text-sm">
                                                            <div className="text-right">
                                                                <p className="text-xs text-slate-400">Esta Est.</p>
                                                                <p className="font-bold text-white">{fmt(est.amount_total)}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs text-slate-400">Acumulado</p>
                                                                <p className="font-bold text-slate-300">{fmt(est.accumulated_total)}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs text-slate-400">Avance</p>
                                                                <p className="font-bold text-emerald-400">{fmtPct(est.progress_percentage)}</p>
                                                            </div>
                                                            {est.status === 'borrador' && (
                                                                <button
                                                                    onClick={() => editEstimation(est)}
                                                                    className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-700 transition-colors"
                                                                    title="Editar estimacion"
                                                                >
                                                                    <FileText size={14} />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => deleteEstimation(est)}
                                                                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
                                                                title="Eliminar estimacion"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/*  MODAL: Nueva Estimacion                                         */}
            {/* ================================================================ */}
            {showNewEstimation && (
                <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-6xl shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Plus size={20} className="text-cyan-400" />
                                    {editingEstimation ? `Editar EST #${editingEstimation.estimation_number}` : 'Nueva Estimacion'} - {selectedBudget?.budget_number}
                                </h2>
                                <p className="text-sm text-slate-400 mt-1">Estimacion #{estimations.length + 1}</p>
                            </div>
                            <button
                                onClick={() => { setShowNewEstimation(false); setEditingEstimation(null); }}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Period + Notes */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Periodo Desde</label>
                                    <input
                                        type="date"
                                        value={estPeriodFrom}
                                        onChange={(e) => setEstPeriodFrom(e.target.value)}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Periodo Hasta</label>
                                    <input
                                        type="date"
                                        value={estPeriodTo}
                                        onChange={(e) => setEstPeriodTo(e.target.value)}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Notas</label>
                                    <input
                                        type="text"
                                        value={estNotes}
                                        onChange={(e) => setEstNotes(e.target.value)}
                                        placeholder="Notas opcionales..."
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                            </div>

                            {/* Estimation items table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs text-slate-400 uppercase border-b border-white/5">
                                            <th className="text-left py-2 px-2 w-10">#</th>
                                            <th className="text-left py-2 px-2">Concepto</th>
                                            <th className="text-left py-2 px-2 w-16">Unidad</th>
                                            <th className="text-right py-2 px-2 w-20">Cant. Total</th>
                                            <th className="text-right py-2 px-2 w-24">P.U.</th>
                                            <th className="text-right py-2 px-2 w-24">Acum. Ant.</th>
                                            <th className="text-center py-2 px-2 w-28">Esta Est.</th>
                                            <th className="text-right py-2 px-2 w-24">Acumulado</th>
                                            <th className="text-right py-2 px-2 w-24">Por Estimar</th>
                                            <th className="text-right py-2 px-2 w-28">Importe Est.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {estItems.map((item: any, idx: number) => {
                                            const calc = estItemCalc(item);
                                            const isExtra = item.is_extra === true;
                                            const updateExtra = (field: string, value: any) => {
                                                setEstItems(prev => {
                                                    const next = [...prev];
                                                    next[idx] = { ...next[idx], [field]: value };
                                                    return next;
                                                });
                                            };
                                            return (
                                                <tr key={idx} className={`border-b border-white/5 hover:bg-white/[0.02] ${isExtra ? 'bg-amber-500/5' : ''}`}>
                                                    <td className="py-2 px-2 text-slate-400 font-mono">
                                                        {isExtra ? <span className="text-amber-400 text-[10px] font-bold">EXT</span> : item.item_number}
                                                    </td>
                                                    <td className="py-2 px-2 max-w-[200px]">
                                                        {isExtra ? (
                                                            <input type="text" value={item.description} onChange={e => updateExtra('description', e.target.value)}
                                                                placeholder="Concepto trabajo adicional"
                                                                className="w-full bg-slate-800 border border-amber-500/20 rounded-lg px-2 py-1 text-amber-300 text-sm focus:outline-none focus:border-amber-500/50" />
                                                        ) : (
                                                            <span className="text-slate-200 truncate block" title={item.description}>{item.description}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        {isExtra ? (
                                                            <input type="text" value={item.unit} onChange={e => updateExtra('unit', e.target.value)}
                                                                placeholder="m2"
                                                                className="w-full bg-slate-800 border border-amber-500/20 rounded-lg px-2 py-1 text-amber-300 text-sm text-center focus:outline-none focus:border-amber-500/50" />
                                                        ) : (
                                                            <span className="text-slate-400">{item.unit}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-2 text-right">
                                                        {isExtra ? (
                                                            <input type="number" min="0" step="0.01" value={item.quantity || ''} onChange={e => updateExtra('quantity', parseFloat(e.target.value) || 0)}
                                                                placeholder="0"
                                                                className="w-full bg-slate-800 border border-amber-500/20 rounded-lg px-2 py-1 text-amber-300 text-sm text-right focus:outline-none focus:border-amber-500/50" />
                                                        ) : (
                                                            <span className="text-slate-300">{item.quantity?.toLocaleString('es-MX')}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-2 text-right">
                                                        {isExtra ? (
                                                            <input type="number" min="0" step="0.01" value={item.unit_price || ''} onChange={e => updateExtra('unit_price', parseFloat(e.target.value) || 0)}
                                                                placeholder="0"
                                                                className="w-full bg-slate-800 border border-amber-500/20 rounded-lg px-2 py-1 text-amber-300 text-sm text-right focus:outline-none focus:border-amber-500/50" />
                                                        ) : (
                                                            <span className="text-slate-300">{fmt(item.unit_price)}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-2 text-right text-slate-400">{isExtra ? '-' : item.volume_previous?.toLocaleString('es-MX')}</td>
                                                    <td className="py-2 px-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.volume_this_estimation || ''}
                                                            onChange={(e) => updateEstItemVolume(idx, e.target.value)}
                                                            className="w-full bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm text-center focus:outline-none focus:border-cyan-500/50"
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="py-2 px-2 text-right text-slate-300">
                                                        {calc.volAccumulated.toLocaleString('es-MX')}
                                                    </td>
                                                    <td className={`py-2 px-2 text-right ${calc.volRemaining < 0 ? 'text-red-400' : 'text-slate-300'}`}>
                                                        {isExtra ? '-' : calc.volRemaining.toLocaleString('es-MX')}
                                                    </td>
                                                    <td className="py-2 px-2 text-right text-white font-medium">
                                                        {fmt(calc.amountThis)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Agregar trabajo adicional */}
                            <div className="flex justify-start pt-2">
                                <button
                                    onClick={() => {
                                        const nextNum = estItems.length + 1;
                                        setEstItems(prev => [...prev, {
                                            work_budget_item_id: null,
                                            item_number: nextNum,
                                            description: '',
                                            unit: '',
                                            quantity: 0,
                                            unit_price: 0,
                                            volume_previous: 0,
                                            volume_this_estimation: 0,
                                            is_extra: true,
                                        }]);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                    <Plus size={12} /> Trabajo Adicional
                                </button>
                            </div>

                            {/* Totals */}
                            {(() => {
                                const totals = estTotals();
                                // Anticipo es SIN IVA (monto directo del presupuesto)
                                const anticipoMonto = parseFloat(selectedBudget?.anticipo_amount) || 0;
                                const budgetSubtotal = parseFloat(selectedBudget?.amount_subtotal) || 1;
                                // % amortización = anticipo / subtotal presupuesto
                                const pctAmortizacion = budgetSubtotal > 0 ? anticipoMonto / budgetSubtotal : 0;
                                // Amortización = subtotal esta estimación × %
                                const amortizacionEst = totals.subtotal * pctAmortizacion;
                                const amortizadoPrevio = estimations.reduce((acc: number, e: any) => acc + (parseFloat(e.anticipo_amortizado_est) || 0), 0);
                                const anticipoPendiente = Math.max(0, anticipoMonto - amortizadoPrevio);
                                const amortizacionReal = Math.min(amortizacionEst, anticipoPendiente);
                                // Subtotal después de amortización
                                const subtotalNeto = totals.subtotal - amortizacionReal;
                                // IVA se calcula DESPUÉS de restar amortización
                                const ivaNeto = subtotalNeto * 0.16;
                                const netoAPagar = subtotalNeto + ivaNeto;
                                return (
                                    <div className="flex justify-end">
                                        <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 w-80 space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400">Suma esta estimación</span>
                                                <span className="text-white font-bold">{fmt(totals.subtotal)}</span>
                                            </div>
                                            {anticipoMonto > 0 && (
                                                <>
                                                    <div className="flex justify-between text-sm text-amber-400">
                                                        <span>(-) Amortización anticipo ({(pctAmortizacion * 100).toFixed(2)}%)</span>
                                                        <span>-{fmt(amortizacionReal)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm border-t border-white/10 pt-1">
                                                        <span className="text-slate-300">Subtotal</span>
                                                        <span className="text-white">{fmt(subtotalNeto)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-400">I.V.A. 16%</span>
                                                        <span className="text-white">{fmt(ivaNeto)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-slate-500 border-t border-white/5 pt-1">
                                                        <span>Anticipo por amortizar</span>
                                                        <span>{fmt(Math.max(0, anticipoPendiente - amortizacionReal))}</span>
                                                    </div>
                                                </>
                                            )}
                                            {anticipoMonto === 0 && (
                                                <>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-400">I.V.A. 16%</span>
                                                        <span className="text-white">{fmt(totals.iva)}</span>
                                                    </div>
                                                </>
                                            )}
                                            <div className="flex justify-between text-base font-bold border-t border-cyan-500/30 pt-2">
                                                <span className="text-cyan-400">NETO A PAGAR</span>
                                                <span className="text-cyan-400">{fmt(netoAPagar)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Action buttons */}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => { setShowNewEstimation(false); setEditingEstimation(null); }}
                                    className="px-4 py-2.5 font-bold rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm transition-colors"
                                    disabled={savingEstimation}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => saveEstimation(false)}
                                    disabled={savingEstimation}
                                    className="px-4 py-2.5 font-bold rounded-xl bg-slate-600 text-white hover:bg-slate-500 flex items-center gap-2 text-sm transition-colors disabled:opacity-50"
                                >
                                    {savingEstimation ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                                    Guardar Borrador
                                </button>
                                <button
                                    onClick={() => saveEstimation(true)}
                                    disabled={savingEstimation}
                                    className="px-4 py-2.5 font-bold rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 flex items-center gap-2 text-sm transition-colors disabled:opacity-50"
                                >
                                    {savingEstimation ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                    Enviar para Validacion
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/*  MODAL: Nuevo Presupuesto                                        */}
            {/* ================================================================ */}
            {showNewBudget && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Plus size={20} className="text-cyan-400" />
                                Nuevo Presupuesto
                            </h2>
                            <button
                                onClick={() => setShowNewBudget(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* File upload */}
                            <div>
                                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-2">
                                    Archivo Excel (opcional)
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer bg-slate-800/50 border border-dashed border-white/10 rounded-xl p-4 hover:border-cyan-500/30 transition-colors">
                                    <Upload size={20} className="text-slate-400" />
                                    <div className="flex-1">
                                        {newBudgetFile ? (
                                            <span className="text-sm text-cyan-400">{newBudgetFile.name}</span>
                                        ) : (
                                            <span className="text-sm text-slate-400">Subir archivo .xlsx</span>
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                    />
                                </label>
                                {parsingExcel && (
                                    <div className="flex items-center gap-2 mt-2 text-cyan-400 text-xs">
                                        <Loader2 size={14} className="animate-spin" /> Escaneando Excel...
                                    </div>
                                )}
                            </div>

                            {/* Cliente */}
                            <div>
                                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
                                    Cliente *
                                </label>
                                <select
                                    value={newBudgetClient}
                                    onChange={(e) => setNewBudgetClient(e.target.value)}
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                                >
                                    <option value="">Seleccionar cliente...</option>
                                    {clients.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.rfc})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
                                        No. Presupuesto
                                    </label>
                                    <input
                                        type="text"
                                        value={newBudgetNumber}
                                        readOnly
                                        className="w-full bg-slate-800/50 border border-white/5 rounded-lg px-3 py-2 text-cyan-400 text-sm font-mono cursor-default"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
                                        Fecha
                                    </label>
                                    <input
                                        type="date"
                                        value={newBudgetDate}
                                        onChange={(e) => setNewBudgetDate(e.target.value)}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
                                        Descripcion
                                    </label>
                                    <input
                                        type="text"
                                        value={newBudgetDescription}
                                        onChange={(e) => setNewBudgetDescription(e.target.value)}
                                        placeholder="Obra civil planta norte..."
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-amber-400 uppercase tracking-wide mb-1 font-bold">
                                        Anticipo ($)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={newBudgetAnticipo}
                                        onChange={(e) => setNewBudgetAnticipo(e.target.value)}
                                        placeholder="50000.00"
                                        className="w-full bg-slate-800 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-400 text-sm font-bold placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                                    />
                                </div>
                            </div>

                            {/* Partidas table */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Partidas</h3>
                                    <button
                                        onClick={addPartida}
                                        className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:text-cyan-400 hover:bg-slate-600 text-xs font-bold flex items-center gap-1 transition-colors"
                                    >
                                        <Plus size={12} /> Agregar Partida
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-xs text-slate-400 uppercase border-b border-white/5">
                                                <th className="text-left py-2 px-2 w-10">#</th>
                                                <th className="text-left py-2 px-2">Concepto</th>
                                                <th className="text-left py-2 px-2 w-24">Unidad</th>
                                                <th className="text-right py-2 px-2 w-28">Cantidad</th>
                                                <th className="text-right py-2 px-2 w-28">P.U.</th>
                                                <th className="text-right py-2 px-2 w-32">Importe</th>
                                                <th className="w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {newBudgetPartidas.map((p: any, idx: number) => {
                                                const importe = (parseFloat(p.quantity) || 0) * (parseFloat(p.unit_price) || 0);
                                                return (
                                                    <tr key={idx} className="border-b border-white/5">
                                                        <td className="py-2 px-2 text-slate-400 font-mono">{idx + 1}</td>
                                                        <td className="py-2 px-2">
                                                            <input
                                                                type="text"
                                                                value={p.description}
                                                                onChange={(e) => updatePartida(idx, 'description', e.target.value)}
                                                                placeholder="Descripcion del concepto"
                                                                className="w-full bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            <input
                                                                type="text"
                                                                value={p.unit}
                                                                onChange={(e) => updatePartida(idx, 'unit', e.target.value)}
                                                                placeholder="PZA"
                                                                className="w-full bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm text-center placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={p.quantity}
                                                                onChange={(e) => updatePartida(idx, 'quantity', e.target.value)}
                                                                placeholder="0"
                                                                className="w-full bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm text-right placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={p.unit_price}
                                                                onChange={(e) => updatePartida(idx, 'unit_price', e.target.value)}
                                                                placeholder="0.00"
                                                                className="w-full bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm text-right placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-2 text-right text-white font-medium">
                                                            {fmt(importe)}
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            {newBudgetPartidas.length > 1 && (
                                                                <button
                                                                    onClick={() => removePartida(idx)}
                                                                    className="p-1 rounded text-slate-400 hover:text-red-400 transition-colors"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Budget totals preview */}
                                {(() => {
                                    const subtotal = newBudgetPartidas.reduce(
                                        (acc: number, p: any) => acc + (parseFloat(p.quantity) || 0) * (parseFloat(p.unit_price) || 0),
                                        0
                                    );
                                    const iva = subtotal * 0.16;
                                    const total = subtotal + iva;
                                    return (
                                        <div className="flex justify-end mt-4">
                                            <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 w-64 space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-400">Subtotal</span>
                                                    <span className="text-white">{fmt(subtotal)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-400">IVA 16%</span>
                                                    <span className="text-white">{fmt(iva)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm font-bold border-t border-white/10 pt-2">
                                                    <span className="text-white">Total</span>
                                                    <span className="text-cyan-400">{fmt(total)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Action buttons */}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setShowNewBudget(false)}
                                    className="px-4 py-2.5 font-bold rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm transition-colors"
                                    disabled={savingBudget}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={saveNewBudget}
                                    disabled={savingBudget}
                                    className="px-4 py-2.5 font-bold rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 flex items-center gap-2 text-sm transition-colors disabled:opacity-50"
                                >
                                    {savingBudget ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                    Guardar Presupuesto
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkEstimations;
