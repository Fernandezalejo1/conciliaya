import React, { useState } from 'react';
import {
  FileText,
  Download,
  Receipt,
  Search,
  CheckCircle,
  Filter,
  DollarSign,
  Calendar,
  Building,
  Printer,
  FileSpreadsheet,
  ArrowRight
} from 'lucide-react';
import { useConcilia } from '../context/ConciliaContext';
import { OfficialReceipt, AccountingEntry } from '../types';

export const AccountingView: React.FC = () => {
  const {
    company,
    accountingEntries,
    officialReceipts,
    clients
  } = useConcilia();

  const [activeSubTab, setActiveSubTab] = useState<'entries' | 'receipts'>('entries');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<OfficialReceipt | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Filter entries
  const filteredEntries = accountingEntries.filter(entry => {
    const term = searchTerm.toLowerCase();
    return (
      entry.asiento_numero.toLowerCase().includes(term) ||
      entry.concepto.toLowerCase().includes(term) ||
      (entry.cliente_nombre && entry.cliente_nombre.toLowerCase().includes(term))
    );
  });

  // Filter receipts
  const filteredReceipts = officialReceipts.filter(rec => {
    const term = searchTerm.toLowerCase();
    return (
      rec.numero_recibo.toLowerCase().includes(term) ||
      rec.cliente_nombre.toLowerCase().includes(term) ||
      rec.banco.toLowerCase().includes(term)
    );
  });

  // Export Journal Entries to CSV formatted for ERPs (Memory Conty, Contasol, SAP, etc.)
  const exportJournalCSV = () => {
    if (accountingEntries.length === 0) {
      setNotificationMsg('No hay asientos contables para exportar. Concilia pagos primero.');
      setTimeout(() => setNotificationMsg(null), 3500);
      return;
    }

    const rows: string[] = [];
    rows.push('Numero_Asiento,Fecha,Concepto,Cliente,Cuenta_Codigo,Cuenta_Nombre,Debito,Credito,Moneda,Referencia');

    accountingEntries.forEach(entry => {
      entry.lineas.forEach(line => {
        rows.push(
          [
            `"${entry.asiento_numero}"`,
            `"${entry.fecha}"`,
            `"${entry.concepto.replace(/"/g, '""')}"`,
            `"${(entry.cliente_nombre || '').replace(/"/g, '""')}"`,
            `"${line.cuenta_codigo}"`,
            `"${line.cuenta_nombre.replace(/"/g, '""')}"`,
            line.debito.toFixed(2),
            line.credito.toFixed(2),
            `"${entry.moneda}"`,
            `"${(line.referencia || '').replace(/"/g, '""')}"`
          ].join(',')
        );
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(rows.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `Asientos_Contables_ConciliaYA_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Official Receipts List
  const exportReceiptsCSV = () => {
    if (officialReceipts.length === 0) {
      setNotificationMsg('No hay recibos emitidos para exportar.');
      setTimeout(() => setNotificationMsg(null), 3500);
      return;
    }

    const rows: string[] = [];
    rows.push('Numero_Recibo,Fecha,Cliente,RUT_CI,Banco,Total_Cobrado,Moneda,Retencion_Fiscal,Gasto_Bancario,Saldo_A_Favor,Facturas_Canceladas');

    officialReceipts.forEach(rec => {
      const facturas = rec.facturas_canceladas.map(f => `${f.factura_numero}($${f.monto_aplicado})`).join('; ');
      rows.push(
        [
          `"${rec.numero_recibo}"`,
          `"${rec.fecha}"`,
          `"${rec.cliente_nombre.replace(/"/g, '""')}"`,
          `"${rec.cliente_rut || ''}"`,
          `"${rec.banco}"`,
          rec.monto_total_cobrado.toFixed(2),
          `"${rec.moneda}"`,
          rec.retencion_fiscal.toFixed(2),
          rec.gasto_bancario.toFixed(2),
          rec.saldo_a_favor_generado.toFixed(2),
          `"${facturas}"`
        ].join(',')
      );
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(rows.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `Recibos_Cobranza_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notificationMsg && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-amber-600" />
            <span>{notificationMsg}</span>
          </div>
          <button onClick={() => setNotificationMsg(null)} className="text-amber-500 hover:text-amber-700 cursor-pointer">
            ×
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Exportación Contable y Recibos Oficiales</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Generación automática de asientos de partida doble y comprobantes de cobranza listos para importar en ERPs (Memory, SAP, Contasol, ContaSys).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={exportJournalCSV}
            className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Asientos (ERP)
          </button>
          <button
            onClick={exportReceiptsCSV}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Download className="h-4 w-4 mr-2 text-slate-500" />
            Exportar Recibos
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveSubTab('entries')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSubTab === 'entries'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Asientos Contables ({accountingEntries.length})
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('receipts')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSubTab === 'receipts'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Recibos de Cobranza ({officialReceipts.length})
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por número, cliente o concepto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* TAB 1: Asientos Contables */}
      {activeSubTab === 'entries' && (
        <div className="space-y-4">
          {filteredEntries.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <FileText className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-semibold text-slate-800">No hay asientos contables generados</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                A medida que confirmes conciliaciones en la pestaña Conciliación, el sistema creará automáticamente los asientos de cobranza balanceados.
              </p>
            </div>
          ) : (
            filteredEntries.map(entry => (
              <div key={entry.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded text-xs border border-indigo-200">
                      {entry.asiento_numero}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                      <Calendar className="h-3.5 w-3.5" />
                      {entry.fecha}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">
                      {entry.concepto}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4 text-xs">
                    <span className="text-slate-500">
                      Moneda: <strong className="text-slate-700">{entry.moneda}</strong>
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Balanceado ({company.currencySymbol}{entry.total_debito.toLocaleString()})
                    </span>
                  </div>
                </div>

                <div className="p-4 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                        <th className="py-2 px-3 w-28">Cuenta</th>
                        <th className="py-2 px-3">Descripción de Cuenta</th>
                        <th className="py-2 px-3">Referencia / Facturas</th>
                        <th className="py-2 px-3 text-right w-32">Débito</th>
                        <th className="py-2 px-3 text-right w-32">Crédito</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {entry.lineas.map((line, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-semibold text-slate-700">{line.cuenta_codigo}</td>
                          <td className="py-2 px-3 font-sans text-slate-800">{line.cuenta_nombre}</td>
                          <td className="py-2 px-3 font-sans text-slate-500">{line.referencia || '-'}</td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-900">
                            {line.debito > 0 ? `${company.currencySymbol}${line.debito.toLocaleString()}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-900">
                            {line.credito > 0 ? `${company.currencySymbol}${line.credito.toLocaleString()}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 font-bold bg-slate-50/50">
                        <td colSpan={3} className="py-2 px-3 text-right font-sans text-slate-700">TOTALES:</td>
                        <td className="py-2 px-3 text-right text-indigo-700 font-mono">
                          {company.currencySymbol}{entry.total_debito.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-indigo-700 font-mono">
                          {company.currencySymbol}{entry.total_credito.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: Recibos de Cobranza */}
      {activeSubTab === 'receipts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReceipts.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Receipt className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-semibold text-slate-800">No hay recibos de cobranza</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                Al conciliar pagos se emitirán automáticamente los recibos oficiales numerados con el detalle de facturas canceladas y retenciones.
              </p>
            </div>
          ) : (
            filteredReceipts.map(rec => (
              <div key={rec.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-all">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                    <div>
                      <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {rec.numero_recibo}
                      </span>
                      <p className="text-xs text-slate-400 mt-1">{rec.fecha}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">
                        {rec.moneda === 'USD' ? 'US$' : '$'}{rec.monto_total_cobrado.toLocaleString()}
                      </p>
                      <span className="text-2xs font-semibold text-slate-500 uppercase">{rec.moneda}</span>
                    </div>
                  </div>

                  <h4 className="font-semibold text-slate-900 text-sm mb-1 line-clamp-1">{rec.cliente_nombre}</h4>
                  <p className="text-xs text-slate-500 mb-3">RUT/CI: {rec.cliente_rut || 'Sin registrar'} • {rec.banco}</p>

                  <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <p className="font-medium text-slate-700 mb-1">Facturas canceladas:</p>
                    {rec.facturas_canceladas.map((f, idx) => (
                      <div key={idx} className="flex items-center justify-between text-slate-600">
                        <span className="font-mono text-slate-800">{f.factura_numero}</span>
                        <span>{company.currencySymbol}{f.monto_aplicado.toLocaleString()}</span>
                      </div>
                    ))}
                    {rec.retencion_fiscal > 0 && (
                      <div className="flex items-center justify-between text-amber-700 font-medium pt-1 border-t border-slate-200">
                        <span>Retención Fiscal:</span>
                        <span>+{company.currencySymbol}{rec.retencion_fiscal.toLocaleString()}</span>
                      </div>
                    )}
                    {rec.saldo_a_favor_generado > 0 && (
                      <div className="flex items-center justify-between text-blue-700 font-medium pt-1 border-t border-slate-200">
                        <span>Saldo a Favor generado:</span>
                        <span>{company.currencySymbol}{rec.saldo_a_favor_generado.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Emitido: {rec.emitido_por}</span>
                  <button
                    onClick={() => setSelectedReceipt(rec)}
                    className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    <Printer className="h-3.5 w-3.5 mr-1" />
                    Ver Comprobante
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Printable Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Receipt Content */}
            <div className="p-8 space-y-6" id="printable-receipt">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-slate-900">{company.name}</h2>
                  <p className="text-xs text-slate-500">RUT {company.rut}</p>
                  <p className="text-xs text-slate-500">{company.address || 'Montevideo, Uruguay'}</p>
                  <p className="text-xs text-slate-500">{company.phone} • {company.email}</p>
                </div>

                <div className="text-right">
                  <div className="bg-slate-900 text-white px-4 py-2 rounded-lg">
                    <p className="text-2xs font-semibold uppercase tracking-widest text-slate-300">Recibo Oficial de Cobranza</p>
                    <p className="text-lg font-mono font-bold">{selectedReceipt.numero_recibo}</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 font-medium">Fecha de Emisión: {selectedReceipt.fecha}</p>
                </div>
              </div>

              {/* Client and Bank info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 uppercase font-semibold text-2xs">Recibimos de:</span>
                  <p className="font-bold text-slate-900 text-sm">{selectedReceipt.cliente_nombre}</p>
                  <p className="text-slate-600">RUT / C.I.: {selectedReceipt.cliente_rut || 'Sin especificar'}</p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-semibold text-2xs">Medio de Pago / Depósito:</span>
                  <p className="font-semibold text-slate-800">{selectedReceipt.banco}</p>
                  <p className="text-slate-600">Ref. Bancaria: {selectedReceipt.referencia_bancaria || 'Depósito Bancario'}</p>
                </div>
              </div>

              {/* Breakdown */}
              <div>
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-500 uppercase font-semibold">
                      <th className="py-2">Concepto / Comprobante</th>
                      <th className="py-2 text-right">Monto Aplicado</th>
                      <th className="py-2 text-right">Saldo Restante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedReceipt.facturas_canceladas.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 font-medium text-slate-800">
                          Cancelación Factura <span className="font-mono font-bold text-slate-900">{item.factura_numero}</span>
                        </td>
                        <td className="py-2.5 text-right font-mono font-semibold text-slate-900">
                          {selectedReceipt.moneda === 'USD' ? 'US$' : '$'}{item.monto_aplicado.toLocaleString()}
                        </td>
                        <td className="py-2.5 text-right font-mono text-slate-500">
                          {selectedReceipt.moneda === 'USD' ? 'US$' : '$'}{item.saldo_restante.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {selectedReceipt.retencion_fiscal > 0 && (
                      <tr>
                        <td className="py-2 text-amber-800 font-medium">Retención Fiscal DGI / IVA / IRAE deducida</td>
                        <td className="py-2 text-right font-mono font-semibold text-amber-800">
                          {selectedReceipt.moneda === 'USD' ? 'US$' : '$'}{selectedReceipt.retencion_fiscal.toLocaleString()}
                        </td>
                        <td className="py-2 text-right font-mono text-slate-400">-</td>
                      </tr>
                    )}
                    {selectedReceipt.saldo_a_favor_generado > 0 && (
                      <tr>
                        <td className="py-2 text-blue-800 font-medium">Excedente acreditado como Saldo a Favor del Cliente</td>
                        <td className="py-2 text-right font-mono font-semibold text-blue-800">
                          {selectedReceipt.moneda === 'USD' ? 'US$' : '$'}{selectedReceipt.saldo_a_favor_generado.toLocaleString()}
                        </td>
                        <td className="py-2 text-right font-mono text-slate-400">-</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-900 font-bold text-sm">
                      <td className="py-3 text-slate-900">TOTAL PERCIBIDO:</td>
                      <td className="py-3 text-right font-mono text-slate-900">
                        {selectedReceipt.moneda === 'USD' ? 'US$' : '$'}{selectedReceipt.monto_total_cobrado.toLocaleString()} {selectedReceipt.moneda}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
                <div>
                  <div className="border-t border-slate-300 w-3/4 mx-auto pt-2">
                    <p className="font-semibold text-slate-700">Por {company.name}</p>
                    <p className="text-2xs text-slate-400">Departamento de Tesorería & Cobranzas</p>
                  </div>
                </div>
                <div>
                  <div className="border-t border-slate-300 w-3/4 mx-auto pt-2">
                    <p className="font-semibold text-slate-700">Recibido Conforme</p>
                    <p className="text-2xs text-slate-400">Cliente / Pagador</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end space-x-3">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-xs"
              >
                Cerrar
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
              >
                <Printer className="h-4 w-4 mr-1.5" />
                Imprimir Comprobante
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
