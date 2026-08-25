import React from 'react';
import {
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Coins,
  FileText,
  Percent,
  Sparkles,
  TrendingUp,
  UploadCloud,
  Users,
  Plus,
  AlertTriangle
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { useConcilia } from '../context/ConciliaContext';

export const DashboardView: React.FC = () => {
  const {
    company,
    invoices,
    bankMovements,
    clients,
    clientCredits,
    learnedAliases,
    setActiveTab,
    confirmAllAutoMatches
  } = useConcilia();

  // Metrics
  const totalPendingInvoicesAmount = invoices
    .filter(i => i.saldo_pendiente > 0 && i.estado !== 'pagada' && i.estado !== 'anulada')
    .reduce((sum, i) => sum + i.saldo_pendiente, 0);

  const totalInvoicesCount = invoices.length;
  const pendingInvoicesCount = invoices.filter(i => i.saldo_pendiente > 0).length;

  const totalBankPendingAmount = bankMovements
    .filter(m => m.estado_conciliacion !== 'conciliado_manual' && m.estado_conciliacion !== 'descartado')
    .reduce((sum, m) => sum + m.monto, 0);

  const totalBankPendingCount = bankMovements
    .filter(m => m.estado_conciliacion !== 'conciliado_manual' && m.estado_conciliacion !== 'descartado')
    .length;

  const autoMatches = bankMovements.filter(m => m.estado_conciliacion === 'auto');
  const suggestedMatches = bankMovements.filter(m => m.estado_conciliacion === 'sugerido');
  const unidentifiedMatches = bankMovements.filter(m => m.estado_conciliacion === 'sin_identificar');
  const reconciledMatches = bankMovements.filter(m => m.estado_conciliacion === 'conciliado_manual');

  const totalReconciledAmount = bankMovements
    .filter(m => m.estado_conciliacion === 'conciliado_manual')
    .reduce((sum, m) => sum + m.monto, 0);

  const totalCreditsAmount = clientCredits
    .filter(c => c.estado === 'disponible' || c.estado === 'parcial')
    .reduce((sum, c) => sum + c.saldo_disponible, 0);

  const clientsWithDebt = clients.filter(c => c.currentBalance > 0).length;

  // Chart Data
  const statusChartData = [
    { name: 'Conciliados', value: reconciledMatches.length, color: '#10b981' },
    { name: 'Automáticos', value: autoMatches.length, color: '#2563eb' },
    { name: 'Sugeridos', value: suggestedMatches.length, color: '#f59e0b' },
    { name: 'Sin Identificar', value: unidentifiedMatches.length, color: '#ef4444' }
  ].filter(d => d.value > 0);

  const topDebtors = [...clients]
    .sort((a, b) => b.currentBalance - a.currentBalance)
    .slice(0, 5);

  const clientChartData = topDebtors.map(c => ({
    name: c.name.length > 18 ? c.name.substring(0, 16) + '...' : c.name,
    saldo: c.currentBalance,
    fullName: c.name
  }));

  const handleBulkApprove = () => {
    const count = confirmAllAutoMatches();
    if (count > 0) {
      alert(`¡Éxito! Se conciliaron ${count} movimientos con 100% de certeza.`);
    }
  };

  const isEmpty = clients.length === 0 && invoices.length === 0 && bankMovements.length === 0;

  return (
    <div className="space-y-6">

      {/* Empty State */}
      {isEmpty && (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-2xl p-8 sm:p-12 border border-slate-200/80 shadow-xs text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 mb-4">
            <Sparkles className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Bienvenido a ConciliaYA</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Para comenzar, registrá tus clientes y subí tus facturas y extractos bancarios.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setActiveTab('clients')}
              className="inline-flex items-center px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-xs transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Registrar Clientes
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className="inline-flex items-center px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-300 transition-colors"
            >
              <UploadCloud className="h-4 w-4 mr-2" />
              Subir Archivos
            </button>
          </div>
        </div>
      )}

      {/* Auto-match Banner */}
      {autoMatches.length > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-4 sm:p-5 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs shrink-0">
              <Sparkles className="h-6 w-6 text-yellow-300" />
            </div>
            <div>
              <h3 className="font-semibold text-base">
                {autoMatches.length} {autoMatches.length === 1 ? 'movimiento listo' : 'movimientos listos'} para conciliación automática
              </h3>
              <p className="text-blue-100 text-xs sm:text-sm mt-0.5">
                Coincidencia 100% exacta por número de factura o alias aprendido.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={handleBulkApprove}
              className="w-full sm:w-auto px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Aprobar Todos ({autoMatches.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('reconciliation')}
              className="px-3 py-2 bg-blue-500/30 hover:bg-blue-500/50 text-white font-medium text-xs sm:text-sm rounded-xl transition-colors"
            >
              Revisar
            </button>
          </div>
        </div>
      )}

      {/* KPI Row 1 - Main Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Por Conciliar</span>
            <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Banknote className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {company.currencySymbol} {totalBankPendingAmount.toLocaleString('es-UY')}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-semibold text-amber-600">{totalBankPendingCount}</span> movimientos en extractos
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cartera Pendiente</span>
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {company.currencySymbol} {totalPendingInvoicesAmount.toLocaleString('es-UY')}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-semibold text-blue-600">{pendingInvoicesCount}</span> facturas abiertas
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Efectividad Cruce</span>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Percent className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {bankMovements.length > 0
                ? `${Math.round(((autoMatches.length + suggestedMatches.length + reconciledMatches.length) / bankMovements.length) * 100)}%`
                : '—'}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-semibold text-emerald-600">{autoMatches.length + suggestedMatches.length}</span> sugerencias activas
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldos a Favor</span>
            <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Coins className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {company.currencySymbol} {totalCreditsAmount.toLocaleString('es-UY')}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-semibold text-purple-600">{learnedAliases.length}</span> alias aprendidos
            </p>
          </div>
        </div>
      </div>

      {/* KPI Row 2 - Client & Reconciliation Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Clientes</span>
            <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{clients.length}</div>
            <p className="text-xs text-slate-500 mt-1">
              {clientsWithDebt > 0 ? (
                <><span className="font-semibold text-red-500">{clientsWithDebt}</span> con saldo deudor</>
              ) : (
                <span className="font-semibold text-emerald-500">Todos al día</span>
              )}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('clients')}
            className="mt-3 w-full text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Agregar Cliente
          </button>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Conciliados</span>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600">{reconciledMatches.length}</div>
            <p className="text-xs text-slate-500 mt-1">
              {company.currencySymbol} {totalReconciledAmount.toLocaleString('es-UY')} procesados
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sin Identificar</span>
            <div className="h-9 w-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-red-600">{unidentifiedMatches.length}</div>
            <p className="text-xs text-slate-500 mt-1">
              Requieren análisis manual o con IA
            </p>
          </div>
          {unidentifiedMatches.length > 0 && (
            <button
              onClick={() => setActiveTab('reconciliation')}
              className="mt-3 w-full text-xs font-semibold text-red-600 hover:text-red-800 flex items-center justify-center gap-1 py-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              Revisar Ahora
            </button>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Receivables Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Top Clientes con Saldo</h3>
              <p className="text-xs text-slate-500">Mayores deudores pendientes de cobro</p>
            </div>
            <button
              onClick={() => setActiveTab('statements')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <span>Ver Todos</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {clientChartData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clientChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: '#334155' }} />
                  <Tooltip
                    formatter={(value: any) => [`$${Number(value).toLocaleString('es-UY')}`, 'Saldo']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', borderColor: '#e2e8f0', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="saldo" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">
              Sin datos de clientes para mostrar
            </div>
          )}
        </div>

        {/* Status Pie Chart */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Estado del Extracto</h3>
            <p className="text-xs text-slate-500">Distribución de movimientos</p>

            {statusChartData.length > 0 ? (
              <div className="h-44 w-full mt-2 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold text-slate-900">{bankMovements.length}</span>
                  <span className="text-[10px] text-slate-400 font-medium uppercase">Movimientos</span>
                </div>
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-sm text-slate-400">
                Sin movimientos
              </div>
            )}
          </div>

          <div className="space-y-2 mt-2 pt-3 border-t border-slate-100">
            {statusChartData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setActiveTab('reconciliation')}
          className="group bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-blue-400 hover:shadow-md transition-all text-left flex items-center space-x-3"
        >
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">Conciliar</h4>
            <p className="text-[11px] text-slate-500">Revisar y aprobar pagos</p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('upload')}
          className="group bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-indigo-400 hover:shadow-md transition-all text-left flex items-center space-x-3"
        >
          <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0">
            <UploadCloud className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">Cargar</h4>
            <p className="text-[11px] text-slate-500">Subir facturas y extractos</p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('clients')}
          className="group bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-emerald-400 hover:shadow-md transition-all text-left flex items-center space-x-3"
        >
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 text-sm group-hover:text-emerald-600 transition-colors">Clientes</h4>
            <p className="text-[11px] text-slate-500">Gestionar padrón</p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('accounting')}
          className="group bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-purple-400 hover:shadow-md transition-all text-left flex items-center space-x-3"
        >
          <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 text-sm group-hover:text-purple-600 transition-colors">Contabilidad</h4>
            <p className="text-[11px] text-slate-500">Asientos y recibos</p>
          </div>
        </button>
      </div>
    </div>
  );
};
