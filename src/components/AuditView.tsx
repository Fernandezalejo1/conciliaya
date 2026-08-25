import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Coins,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Undo2,
  UserCheck,
  X
} from 'lucide-react';
import { useConcilia } from '../context/ConciliaContext';
import { AuditLog } from '../types';

export const AuditView: React.FC = () => {
  const { company, auditLogs, revertReconciliation } = useConcilia();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'revertible' | 'reverted' | 'manual' | 'suggested'>('all');
  const [logToRevert, setLogToRevert] = useState<AuditLog | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Filter logs
  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch =
      log.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.detalles?.cliente_nombre && log.detalles.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.detalles?.recibo_id && log.detalles.recibo_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.detalles?.facturas_afectadas && log.detalles.facturas_afectadas.some(f => f.numero.toLowerCase().includes(searchTerm.toLowerCase())));

    if (!matchesSearch) return false;

    if (filterType === 'revertible') return log.revertible && !log.reverted;
    if (filterType === 'reverted') return log.reverted || log.accion === 'reversion';
    if (filterType === 'manual') return log.accion === 'manual_match';
    if (filterType === 'suggested') return log.accion === 'confirm_suggested';

    return true;
  });

  const activeRevertibleCount = auditLogs.filter(l => l.revertible && !l.reverted).length;
  const revertedCount = auditLogs.filter(l => l.reverted).length;

  const handleConfirmRevert = () => {
    if (!logToRevert) return;
    const logDesc = logToRevert.descripcion;
    revertReconciliation(logToRevert.id);
    setFeedbackMessage(`Operación revertida con éxito: "${logDesc}". Los saldos y facturas han sido restaurados.`);
    setLogToRevert(null);

    setTimeout(() => {
      setFeedbackMessage(null);
    }, 6000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Auditoría & Trazabilidad Contable</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {auditLogs.length} registros
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Registro cronológico inmutable de cada cruce contable, conciliación y asignación de pagos con capacidad de reversión segura ante errores.
          </p>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2 text-center min-w-[100px]">
            <span className="block text-xs font-semibold text-slate-400 uppercase">Activas</span>
            <span className="text-lg font-bold text-blue-700">{activeRevertibleCount}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2 text-center min-w-[100px]">
            <span className="block text-xs font-semibold text-slate-400 uppercase">Revertidas</span>
            <span className="text-lg font-bold text-amber-700">{revertedCount}</span>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {feedbackMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start space-x-3 text-emerald-900 animate-fadeIn">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs sm:text-sm font-medium">{feedbackMessage}</div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-emerald-500 hover:text-emerald-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, operador, factura, recibo..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filterType === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({auditLogs.length})
          </button>
          <button
            onClick={() => setFilterType('revertible')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filterType === 'revertible'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Reversibles ({activeRevertibleCount})
          </button>
          <button
            onClick={() => setFilterType('manual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filterType === 'manual'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Manuales
          </button>
          <button
            onClick={() => setFilterType('reverted')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filterType === 'reverted'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Reversiones ({revertedCount})
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Fecha & Hora</th>
                <th className="px-4 py-3">Operador</th>
                <th className="px-4 py-3">Acción / Tipo</th>
                <th className="px-4 py-3">Detalle del Cruce</th>
                <th className="px-4 py-3 text-right">Facturas Afectadas</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <History className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <span>No se encontraron registros de auditoría para este filtro.</span>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isReverted = log.reverted;
                  const isReversionLog = log.accion === 'reversion';

                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isReverted ? 'opacity-60 bg-slate-50/80' : isReversionLog ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-600 font-mono whitespace-nowrap">
                        {new Date(log.fecha).toLocaleString('es-UY', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <div className="flex items-center space-x-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>{log.usuario}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isReverted ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300">
                            Revertido
                          </span>
                        ) : isReversionLog ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Reversión Contable
                          </span>
                        ) : log.accion === 'confirm_suggested' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Sugerencia Confirmada
                          </span>
                        ) : log.accion === 'manual_match' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            Asignación Manual
                          </span>
                        ) : log.accion === 'discard' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            Descarte
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {log.accion}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{log.descripcion}</div>
                        {log.detalles?.saldo_a_favor && (
                          <div className="text-[11px] text-purple-700 font-semibold flex items-center space-x-1 mt-0.5">
                            <Coins className="h-3 w-3" />
                            <span>+ {company.currencySymbol} {log.detalles.saldo_a_favor.toLocaleString('es-UY')} saldo a favor</span>
                          </div>
                        )}
                        {log.detalles?.retencion && (
                          <div className="text-[11px] text-indigo-700 font-medium mt-0.5">
                            Retención DGI: {company.currencySymbol} {log.detalles.retencion.toLocaleString('es-UY')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {log.detalles?.facturas_afectadas && log.detalles.facturas_afectadas.length > 0 ? (
                          <div className="space-y-0.5 font-mono text-[11px]">
                            {log.detalles.facturas_afectadas.map((f, idx) => (
                              <div key={idx} className="text-slate-700">
                                <span className="font-bold text-blue-700">{f.numero}</span> (${f.monto_aplicado.toLocaleString('es-UY')})
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {log.revertible && !log.reverted ? (
                          <button
                            onClick={() => setLogToRevert(log)}
                            className="px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all inline-flex items-center space-x-1.5 shadow-2xs hover:scale-105 active:scale-95"
                            title="Abrir confirmación para restaurar saldos y anular cruce"
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-red-600" />
                            <span>Revertir</span>
                          </button>
                        ) : log.reverted ? (
                          <span className="text-[11px] text-slate-400 font-medium italic">Deshecho</span>
                        ) : (
                          <span className="text-[11px] text-slate-300 font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* In-App Confirmation Modal for Reversion (No window.confirm!) */}
      {logToRevert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200 animate-scaleUp">
            <div className="p-6 border-b border-slate-100 flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Confirmar Reversión de Conciliación</h3>
                  <p className="text-xs text-slate-500">Esta acción restaurará el estado financiero original.</p>
                </div>
              </div>
              <button
                onClick={() => setLogToRevert(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs sm:text-sm text-slate-700">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="font-semibold text-slate-900">{logToRevert.descripcion}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Registrado el {new Date(logToRevert.fecha).toLocaleString('es-UY')} por <span className="font-semibold text-slate-700">{logToRevert.usuario}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
                  Efectos automáticos de la reversión:
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Restauración de saldos:</strong> Las facturas involucradas ({logToRevert.detalles?.facturas_afectadas?.map(f => f.numero).join(', ') || 'asociadas'}) volverán a su saldo pendiente original.
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Reintegro del movimiento:</strong> El extracto bancario volverá a la cola de pendientes para que puedas conciliarlo correctamente.
                    </span>
                  </li>
                  {logToRevert.detalles?.saldo_a_favor && (
                    <li className="flex items-start space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Anulación de crédito:</strong> Se eliminará el saldo a favor de ${logToRevert.detalles.saldo_a_favor.toLocaleString('es-UY')} generado para el cliente.
                      </span>
                    </li>
                  )}
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Libro diario & Recibos:</strong> El recibo emitido y el asiento contable serán cancelados y removidos de los reportes.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Quedará una entrada de auditoría registrando esta reversión para garantizar la trazabilidad ante inspecciones.
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setLogToRevert(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRevert}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Confirmar y Revertir Cruce</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

