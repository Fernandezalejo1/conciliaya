import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  ExternalLink,
  Eye,
  Filter,
  HelpCircle,
  Info,
  Layers,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserCheck,
  Percent,
  RefreshCw,
  X,
  FileSpreadsheet
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useConcilia } from '../context/ConciliaContext';
import { BankMovement, Client, Invoice } from '../types';

export const ReconciliationView: React.FC = () => {
  const {
    company,
    bankMovements,
    invoices,
    clients,
    confirmMatch,
    confirmAllAutoMatches,
    manualMatch,
    discardMovement,
    setActiveTab
  } = useConcilia();

  const [activeSubTab, setActiveSubTab] = useState<'sin_identificar' | 'sugeridos' | 'auto100' | 'auto85' | 'reconciled' | 'all'>('sin_identificar');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Manual modal state
  const [modalMovement, setModalMovement] = useState<BankMovement | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [manualAllocations, setManualAllocations] = useState<{ [invoiceId: string]: number }>({});
  const [saveAsAliasText, setSaveAsAliasText] = useState<string>('');
  const [clientSearchFilter, setClientSearchFilter] = useState<string>('');
  
  // Tax / Fee adjustments in manual modal
  const [taxWithholding, setTaxWithholding] = useState<number>(0);
  const [bankFee, setBankFee] = useState<number>(0);

  // Counts
  const autoItems = bankMovements.filter(m => m.estado_conciliacion === 'auto');
  const auto100Items = bankMovements.filter(m => m.estado_conciliacion === 'auto' && m.confianza >= 99);
  const auto85Items = bankMovements.filter(m => m.estado_conciliacion === 'auto' && m.confianza >= 85 && m.confianza < 99);
  const suggestedItems = bankMovements.filter(m => m.estado_conciliacion === 'sugerido');
  const unidentifiedItems = bankMovements.filter(m => m.estado_conciliacion === 'sin_identificar');
  const reconciledItems = bankMovements.filter(m => m.estado_conciliacion === 'conciliado_manual');
  const pendingItems = bankMovements.filter(
    m => m.estado_conciliacion === 'auto' || m.estado_conciliacion === 'sugerido' || m.estado_conciliacion === 'sin_identificar'
  );

  // Filtered list
  const getFilteredMovements = () => {
    let list: BankMovement[] = [];
    if (activeSubTab === 'sin_identificar') {
      list = unidentifiedItems;
    } else if (activeSubTab === 'sugeridos') {
      list = suggestedItems;
    } else if (activeSubTab === 'auto100') {
      list = auto100Items;
    } else if (activeSubTab === 'auto85') {
      list = auto85Items;
    } else if (activeSubTab === 'reconciled') {
      list = reconciledItems;
    } else {
      list = bankMovements;
    }

    if (!searchTerm.trim()) return list;

    const term = searchTerm.toLowerCase();
    return list.filter(
      m =>
        m.descripcion_cruda.toLowerCase().includes(term) ||
        m.monto.toString().includes(term) ||
        (m.cliente_sugerido_name && m.cliente_sugerido_name.toLowerCase().includes(term)) ||
        (m.referencia && m.referencia.toLowerCase().includes(term))
    );
  };

  const filteredMovements = getFilteredMovements();

  const handleConfirmSingle = (movementId: string, customAlias?: string) => {
    confirmMatch(movementId, customAlias);
    if (pendingItems.length <= 1) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });
    }
  };

  const handleBulkAutoApprove = () => {
    const count = confirmAllAutoMatches();
    if (count > 0) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  // Open manual allocation modal
  const openManualModal = (movement: BankMovement, forceClientId?: string, preWithholding?: number, preFee?: number) => {
    setModalMovement(movement);
    setSaveAsAliasText(movement.descripcion_cruda);
    setClientSearchFilter('');
    setTaxWithholding(preWithholding || movement.sugerencia?.retencion_estimada || 0);
    setBankFee(preFee || 0);

    const preselect = forceClientId || movement.cliente_sugerido_id || (clients.length > 0 ? clients[0].id : '');
    setSelectedClientId(preselect);

    initAllocationsForClient(preselect, movement.monto + (preWithholding || movement.sugerencia?.retencion_estimada || 0));
  };

  const initAllocationsForClient = (clientId: string, totalEffectiveAmount: number) => {
    const clientInvoices = invoices.filter(
      i => i.cliente_id === clientId && i.saldo_pendiente > 0 && i.estado !== 'pagada'
    ).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    let remaining = totalEffectiveAmount;
    const initialMap: { [invoiceId: string]: number } = {};

    for (const inv of clientInvoices) {
      if (remaining <= 0) {
        initialMap[inv.id] = 0;
      } else {
        const apply = Math.min(inv.saldo_pendiente, remaining);
        initialMap[inv.id] = apply;
        remaining -= apply;
      }
    }
    setManualAllocations(initialMap);
  };

  const handleClientChangeInModal = (clientId: string) => {
    setSelectedClientId(clientId);
    if (modalMovement) {
      initAllocationsForClient(clientId, modalMovement.monto + taxWithholding);
    }
  };

  const handleAllocationChange = (invoiceId: string, val: number) => {
    setManualAllocations(prev => ({
      ...prev,
      [invoiceId]: Math.max(0, val)
    }));
  };

  const handleApplyTaxPreset = (percentage: number) => {
    if (!modalMovement) return;
    const estimatedInvoiceTotal = modalMovement.monto / (1 - percentage / 100);
    const calculatedTax = Math.round(estimatedInvoiceTotal - modalMovement.monto);
    setTaxWithholding(calculatedTax);
    initAllocationsForClient(selectedClientId, modalMovement.monto + calculatedTax);
  };

  const handleSaveManualModal = () => {
    if (!modalMovement || !selectedClientId) return;

    const allocationsList: Array<{ factura_id: string; monto: number }> = [];
    let totalAllocated = 0;

    Object.entries(manualAllocations).forEach(([fId, rawMonto]) => {
      const monto = Number(rawMonto) || 0;
      if (monto > 0) {
        allocationsList.push({ factura_id: fId, monto });
        totalAllocated += monto;
      }
    });

    const effectiveTotal = modalMovement.monto + taxWithholding - bankFee;
    const excess = Math.max(0, effectiveTotal - totalAllocated);

    manualMatch(
      modalMovement.id,
      selectedClientId,
      allocationsList,
      excess,
      saveAsAliasText.trim().length >= 3 ? saveAsAliasText.trim() : undefined,
      taxWithholding,
      bankFee
    );

    setModalMovement(null);

    if (pendingItems.length <= 1) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });
    }
  };

  // Calculations inside modal
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const selectedClientInvoices = invoices.filter(
    i => i.cliente_id === selectedClientId && i.saldo_pendiente > 0 && i.estado !== 'pagada' && i.estado !== 'anulada'
  );

  const totalAllocatedInModal = Object.values(manualAllocations).reduce<number>((sum, val) => sum + (Number(val) || 0), 0);
  const effectiveAvailableInModal = modalMovement ? (modalMovement.monto + taxWithholding - bankFee) : 0;
  const excessCreditInModal = Math.max(0, effectiveAvailableInModal - totalAllocatedInModal);
  const remainingDeficitInModal = Math.max(0, totalAllocatedInModal - effectiveAvailableInModal);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Bulk Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Bandeja de Conciliación Inteligente</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {pendingItems.length} pendientes
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Motor con coincidencia determinística, distancias de texto (Levenshtein), tolerancia a retenciones (1-3%) y análisis por IA.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          {autoItems.length > 0 && (
            <button
              onClick={handleBulkAutoApprove}
              className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Aprobar 100% Automáticos ({autoItems.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Sub tabs */}
        <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveSubTab('sin_identificar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 ${
              activeSubTab === 'sin_identificar' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <span>Sin Identificar</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 dark:text-slate-300 font-bold">
              {unidentifiedItems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('sugeridos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 ${
              activeSubTab === 'sugeridos' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <span>Sugeridos</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
              {suggestedItems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('auto100')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 ${
              activeSubTab === 'auto100' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <span>100% Auto</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
              {auto100Items.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('auto85')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 ${
              activeSubTab === 'auto85' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <span>~85% Auto</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-bold">
              {auto85Items.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('reconciled')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 ${
              activeSubTab === 'reconciled' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <span>Conciliados</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 dark:text-slate-300 font-bold">
              {reconciledItems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeSubTab === 'all' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Todos ({bankMovements.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por cliente, monto, ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Movement List Table / Cards */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs overflow-hidden">
        {filteredMovements.length === 0 ? (
          <div className="p-12 text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">¡Bandeja al día!</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {activeSubTab === 'sin_identificar'
                ? 'No quedan movimientos sin identificar. Todos los importes tienen una sugerencia o fueron conciliados.'
                : 'No se encontraron movimientos con los filtros seleccionados.'}
            </p>
            {activeSubTab === 'sin_identificar' && (
              <button
                onClick={() => setActiveTab('accounting')}
                className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-xs rounded-xl transition-colors inline-flex items-center space-x-1.5"
              >
                <span>Ver Asientos y Recibos Emitidos</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredMovements.map((mov) => {
              const isExpanded = expandedRowId === mov.id;
              const isReconciled = mov.estado_conciliacion === 'conciliado_manual';
              const isAuto = mov.estado_conciliacion === 'auto';
              const isSuggested = mov.estado_conciliacion === 'sugerido';
              const isUnidentified = mov.estado_conciliacion === 'sin_identificar';

              return (
                <div
                  key={mov.id}
                  className={`transition-colors ${
                    isExpanded ? 'bg-slate-50/80 dark:bg-slate-800/50' : isReconciled ? 'bg-white/40 dark:bg-slate-800/40' : 'hover:bg-slate-50/50 dark:hover:bg-slate-700/50 bg-white dark:bg-slate-800'
                  }`}
                >
                  <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Date, Bank, Amount, Raw Memo */}
                    <div className="flex items-start space-x-3.5 min-w-0">
                      <button
                        onClick={() => setExpandedRowId(isExpanded ? null : mov.id)}
                        className="mt-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      </button>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{mov.fecha}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                            {mov.origen_banco}
                          </span>
                          {mov.moneda && (
                            <span className="text-2xs font-bold text-slate-600 dark:text-slate-400 bg-slate-200/70 px-1.5 py-0.5 rounded uppercase">
                              {mov.moneda}
                            </span>
                          )}
                          {mov.referencia && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                              Ref: {mov.referencia}
                            </span>
                          )}

                          {/* Confidence / Status Badge */}
                          {isAuto && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <Sparkles className="h-3 w-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                              100% Automático
                            </span>
                          )}
                          {isSuggested && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Sparkles className="h-3 w-3 mr-1 text-amber-600 dark:text-amber-400" />
                              Sugerido ({mov.confianza}%)
                            </span>
                          )}
                          {isUnidentified && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                              <HelpCircle className="h-3 w-3 mr-1 text-red-600" />
                              Sin Identificar
                            </span>
                          )}
                          {isReconciled && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              <Check className="h-3 w-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                              Conciliado
                            </span>
                          )}
                        </div>

                        {/* Raw bank memo */}
                        <div className="font-mono text-xs text-slate-800 dark:text-slate-200 font-medium bg-slate-100/70 dark:bg-slate-700/70 px-2.5 py-1 rounded-md border border-slate-200/50 dark:border-slate-700 inline-block max-w-full truncate">
                          {mov.descripcion_cruda}
                        </div>

                        {/* Suggestion reason callout */}
                        {mov.motivo_sugerencia && !isReconciled && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center space-x-1.5 pt-0.5">
                            <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <span>{mov.motivo_sugerencia}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Amount & Action Buttons */}
                    <div className="flex items-center justify-between lg:justify-end space-x-4 shrink-0 pl-8 lg:pl-0">
                      <div className="text-right">
                        <div className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                          {mov.moneda === 'USD' ? 'US$' : company.currencySymbol} {mov.monto.toLocaleString('es-UY')}
                        </div>
                        {mov.cliente_sugerido_name && (
                          <div className="text-xs font-semibold text-blue-700 max-w-[200px] truncate">
                            {mov.cliente_sugerido_name}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      {!isReconciled ? (
                        <div className="flex items-center space-x-2">
                          {(isAuto || isSuggested) && (
                            <button
                              onClick={() => handleConfirmSingle(mov.id)}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1 hover:scale-102"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Confirmar</span>
                            </button>
                          )}

                          <button
                            onClick={() => openManualModal(mov)}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors flex items-center space-x-1"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                            <span>{isUnidentified ? 'Asignar' : 'Ajustar'}</span>
                          </button>

                          <button
                            onClick={() => discardMovement(mov.id)}
                            title="Descartar movimiento (comisión bancaria o no aplicable)"
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setExpandedRowId(isExpanded ? null : mov.id)}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-medium text-xs rounded-xl hover:bg-slate-200 transition-colors flex items-center space-x-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Ver Aplicación</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Breakdown Drawer */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-slate-200/60 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70">
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200/70 dark:border-slate-700 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                            <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span>Desglose de Aplicación de Fondos</span>
                          </h4>
                          {mov.cliente_sugerido_name && (
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                              Cliente: <strong className="text-slate-900 dark:text-white">{mov.cliente_sugerido_name}</strong>
                            </span>
                          )}
                        </div>

                        {/* If it has proposed or confirmed invoices */}
                        {mov.sugerencia && mov.sugerencia.facturas.length > 0 ? (
                          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                  <th className="px-3 py-2">Factura N°</th>
                                  <th className="px-3 py-2 text-right">Importe Factura</th>
                                  <th className="px-3 py-2 text-right">Saldo Actual</th>
                                  <th className="px-3 py-2 text-right">Monto a Aplicar</th>
                                  <th className="px-3 py-2 text-right">Saldo Restante</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {mov.sugerencia.facturas.map((f) => {
                                  const saldoRestante = Math.max(0, f.saldo_pendiente - f.monto_a_aplicar);
                                  return (
                                     <tr key={f.factura_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                      <td className="px-3 py-2 font-mono font-bold text-blue-700">{f.factura_numero}</td>
                                       <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{company.currencySymbol} {f.importe.toLocaleString('es-UY')}</td>
                                       <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{company.currencySymbol} {f.saldo_pendiente.toLocaleString('es-UY')}</td>
                                       <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                        {company.currencySymbol} {f.monto_a_aplicar.toLocaleString('es-UY')}
                                      </td>
                                       <td className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-300">
                                        {saldoRestante <= 0 ? (
                                           <span className="text-emerald-700 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded text-[11px]">
                                            Cancela total ($0)
                                          </span>
                                        ) : (
                                          <span>{company.currencySymbol} {saldoRestante.toLocaleString('es-UY')}</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : isReconciled && mov.aplicaciones && mov.aplicaciones.length > 0 ? (
                          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                  <th className="px-3 py-2">Factura N°</th>
                                  <th className="px-3 py-2">Cliente</th>
                                  <th className="px-3 py-2 text-right">Monto Aplicado</th>
                                  <th className="px-3 py-2">Confirmado Por</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {mov.aplicaciones.map((app) => (
                                  <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-3 py-2 font-mono font-bold text-blue-700">{app.factura_numero}</td>
                                     <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{app.cliente_nombre}</td>
                                     <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                      {company.currencySymbol} {app.monto_aplicado.toLocaleString('es-UY')}
                                    </td>
                                     <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{app.confirmado_por} ({app.fecha})</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                            No hay facturas vinculadas aún. Usa "Asignar" para seleccionar el cliente y las facturas correspondientes.
                          </p>
                        )}

                        {/* Tax / Withholding Callout */}
                        {((mov.sugerencia?.retencion_estimada || 0) > 0 || (mov.retencion_monto || 0) > 0) && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-amber-900 rounded-lg p-3 text-xs flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Percent className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              <span>
                                Retención fiscal detectada/aplicada: <strong>{company.currencySymbol} {((mov.sugerencia?.retencion_estimada ?? mov.retencion_monto ?? 0)).toLocaleString('es-UY')}</strong> (se computa a favor del cliente).
                              </span>
                            </div>
                            <span className="text-[11px] font-bold bg-amber-200/80 px-2 py-0.5 rounded text-amber-800">
                              Deducción DGI
                            </span>
                          </div>
                        )}

                        {/* Excess Credit Note */}
                        {((mov.sugerencia?.saldo_a_favor_estimado || 0) > 0 || (mov.saldo_a_favor_generado || 0) > 0) && (
                          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 text-purple-900 rounded-lg p-3 text-xs flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Coins className="h-4 w-4 text-purple-600" />
                              <span>
                                Excedente de <strong>{company.currencySymbol} {((mov.sugerencia?.saldo_a_favor_estimado ?? mov.saldo_a_favor_generado ?? 0)).toLocaleString('es-UY')}</strong> acreditado como Saldo a Favor del cliente.
                              </span>
                            </div>
                            <span className="text-[11px] font-bold bg-purple-200/80 px-2 py-0.5 rounded text-purple-800">
                              Crédito Disponible
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Allocation / Split Payment Modal */}
      {modalMovement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200 max-h-[95vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Asignación Manual & Retenciones</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Conciliar {modalMovement.moneda === 'USD' ? 'US$' : company.currencySymbol} {modalMovement.monto.toLocaleString('es-UY')}
                </h3>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                  {modalMovement.descripcion_cruda}
                </p>
              </div>
              <button
                onClick={() => setModalMovement(null)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step 1: Select Client */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                1. Seleccionar Cliente / Empresa
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Filtrar por nombre o RUT..."
                  value={clientSearchFilter}
                  onChange={(e) => setClientSearchFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />

                <select
                  value={selectedClientId}
                  onChange={(e) => handleClientChangeInModal(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {clients
                    .filter(c =>
                      !clientSearchFilter ||
                      c.name.toLowerCase().includes(clientSearchFilter.toLowerCase()) ||
                      c.rut_ci.includes(clientSearchFilter)
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (RUT: {c.rut_ci})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Step 2: Tax Withholding / Bank Fee Tolerances */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>2. Retenciones Fiscales & Gastos Bancarios</span>
                <span className="text-slate-400 dark:text-slate-500 font-normal">Opcional</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-600 dark:text-slate-400 block mb-1">Retención Fiscal DGI / IVA:</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      value={taxWithholding === 0 ? '' : taxWithholding}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setTaxWithholding(val);
                        initAllocationsForClient(selectedClientId, modalMovement.monto + val);
                      }}
                      placeholder="$ 0"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-amber-800"
                    />
                    <div className="flex space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApplyTaxPreset(1)}
                        className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-2xs font-bold"
                      >
                        1%
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyTaxPreset(2)}
                        className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-2xs font-bold"
                      >
                        2%
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyTaxPreset(3)}
                        className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-2xs font-bold"
                      >
                        3%
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-slate-600 dark:text-slate-400 block mb-1">Comisión / Gasto Bancario:</span>
                  <input
                    type="number"
                    min="0"
                    value={bankFee === 0 ? '' : bankFee}
                    onChange={(e) => setBankFee(parseFloat(e.target.value) || 0)}
                    placeholder="$ 0"
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Open Invoices Breakdown with custom amount inputs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  3. Distribuir Pago entre Facturas Pendientes
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedClientInvoices.length} facturas pendientes
                </span>
              </div>

              {selectedClientInvoices.length === 0 ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
                  Este cliente no posee facturas pendientes. El monto disponible ({company.currencySymbol} {effectiveAvailableInModal.toLocaleString('es-UY')}) se guardará como <strong>Saldo a Favor (Crédito)</strong> para futuras facturas.
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Factura</th>
                        <th className="px-3 py-2">Vto</th>
                        <th className="px-3 py-2 text-right">Saldo</th>
                        <th className="px-3 py-2 text-right w-36">Monto a Aplicar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedClientInvoices.map((inv) => {
                        const applied = manualAllocations[inv.id] || 0;
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="px-3 py-2 font-mono font-bold text-blue-700">{inv.numero}</td>
                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{inv.vencimiento}</td>
                            <td className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-300">
                              {inv.moneda === 'USD' ? 'US$' : '$'}{inv.saldo_pendiente.toLocaleString('es-UY')}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end space-x-1">
                                <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  max={inv.saldo_pendiente}
                                  value={applied === 0 ? '' : applied}
                                  onChange={(e) => handleAllocationChange(inv.id, parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-24 px-2 py-1 text-right font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Distribution Summary & Excess */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Depósito bancario transferido:</span>
                <span className="font-bold text-slate-900 dark:text-white">{company.currencySymbol} {modalMovement.monto.toLocaleString('es-UY')}</span>
              </div>
              {taxWithholding > 0 && (
                <div className="flex items-center justify-between text-amber-700 font-semibold">
                  <span>+ Retención fiscal reconocida:</span>
                  <span>+{company.currencySymbol} {taxWithholding.toLocaleString('es-UY')}</span>
                </div>
              )}
              {bankFee > 0 && (
                <div className="flex items-center justify-between text-red-700 font-semibold">
                  <span>- Gasto bancario deducido:</span>
                  <span>-{company.currencySymbol} {bankFee.toLocaleString('es-UY')}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-slate-800 dark:text-slate-200 font-bold border-t border-slate-200 dark:border-slate-700 pt-1">
                <span>Total efectivo a conciliar:</span>
                <span className="text-indigo-700 font-bold">{company.currencySymbol} {effectiveAvailableInModal.toLocaleString('es-UY')}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Total imputado a facturas:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{company.currencySymbol} {totalAllocatedInModal.toLocaleString('es-UY')}</span>
              </div>
              {excessCreditInModal > 0 && (
                <div className="flex items-center justify-between text-purple-700 font-semibold pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Excedente como Saldo a Favor:</span>
                  <span>+ {company.currencySymbol} {excessCreditInModal.toLocaleString('es-UY')}</span>
                </div>
              )}
              {remainingDeficitInModal > 0 && (
                <div className="flex items-center justify-between text-red-600 font-semibold pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Error: Has asignado más del monto disponible por:</span>
                  <span>- {company.currencySymbol} {remainingDeficitInModal.toLocaleString('es-UY')}</span>
                </div>
              )}
            </div>

            {/* Step 4: Learn alias for future uploads */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
                <span>4. Aprender Alias para futuras conciliaciones</span>
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                La próxima vez que el banco traiga este texto, el sistema sabrá automáticamente que pertenece a <strong>{selectedClient?.name}</strong>.
              </p>
              <input
                type="text"
                value={saveAsAliasText}
                onChange={(e) => setSaveAsAliasText(e.target.value)}
                placeholder="Texto a memorizar en el banco..."
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setModalMovement(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={remainingDeficitInModal > 0}
                onClick={handleSaveManualModal}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <Check className="h-4 w-4" />
                <span>Confirmar, Emitir Recibo y Asiento</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
