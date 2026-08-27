import React from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Coins,
  FileCheck,
  FileText,
  HelpCircle,
  Percent,
  Sparkles,
  TrendingUp,
  UploadCloud,
  Users
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
  const pendingInvoicesCount = invoices.filter(i => i.saldo_pendiente > 0 && i.estado !== 'pagada' && i.estado !== 'anulada').length;

  const totalBankPendingAmount = bankMovements
    .filter(m => m.estado_conciliacion !== 'conciliado_manual' && m.estado_conciliacion !== 'descartado')
    .reduce((sum, m) => sum + m.monto, 0);

  const totalBankPendingCount = bankMovements
    .filter(m => m.estado_conciliacion !== 'conciliado_manual' && m.estado_conciliacion !== 'descartado')
    .length;

  const autoMatches = bankMovements.filter(m => m.estado_conciliacion === 'auto' && m.sugerencia?.tipo !== 'ya_conciliado');
  const yaConciliadoMatches = bankMovements.filter(m => m.estado_conciliacion === 'auto' && m.sugerencia?.tipo === 'ya_conciliado');
  const suggestedMatches = bankMovements.filter(m => m.estado_conciliacion === 'sugerido');
  const unidentifiedMatches = bankMovements.filter(m => m.estado_conciliacion === 'sin_identificar');
  const reconciledMatches = bankMovements.filter(m => m.estado_conciliacion === 'conciliado_manual');

  const totalReconciledAmount = bankMovements
    .filter(m => m.estado_conciliacion === 'conciliado_manual')
    .reduce((sum, m) => sum + m.monto, 0);

  const totalCreditsAmount = clientCredits
    .filter(c => c.estado === 'disponible' || c.estado === 'parcial')
    .reduce((sum, c) => sum + c.saldo_disponible, 0);

  // Chart Data: Status Breakdown
  const statusChartData = [
    { name: 'Conciliados', value: reconciledMatches.length, color: '#10b981' },
    { name: '100% Automáticos', value: autoMatches.length, color: '#2563eb' },
    { name: 'Ya Conciliados', value: yaConciliadoMatches.length, color: '#8b5cf6' },
    { name: 'Sugeridos (1 Clic)', value: suggestedMatches.length, color: '#f59e0b' },
    { name: 'Sin Identificar', value: unidentifiedMatches.length, color: '#ef4444' }
  ].filter(d => d.value > 0);

  // Chart Data: Client Receivables (computed from invoices as source of truth)
  const clientDebts = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.saldo_pendiente > 0 && inv.estado !== 'pagada' && inv.estado !== 'anulada') {
      clientDebts.set(inv.cliente_id, (clientDebts.get(inv.cliente_id) || 0) + inv.saldo_pendiente);
    }
  }
  const topDebtors = [...clients]
    .map(c => ({ ...c, computedDebt: clientDebts.get(c.id) || 0 }))
    .sort((a, b) => b.computedDebt - a.computedDebt)
    .slice(0, 5);

  const clientChartData = topDebtors.map(c => ({
    name: c.name.length > 18 ? c.name.substring(0, 16) + '...' : c.name,
    saldo: c.computedDebt,
    fullName: c.name
  }));

  const handleBulkApprove = () => {
    const count = confirmAllAutoMatches();
    if (count > 0) {
      alert(`¡Éxito! Se conciliaron ${count} movimientos con 100% de certeza.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Alert if auto-matches exist */}
      {autoMatches.length > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-4 sm:p-5 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs shrink-0">
              <Sparkles className="h-6 w-6 text-yellow-300" />
            </div>
            <div>
              <h3 className="font-semibold text-base">
                {autoMatches.length} {autoMatches.length === 1 ? 'movimiento listo' : 'movimientos listos'} para conciliación automática inmediata
              </h3>
              <p className="text-blue-100 text-xs sm:text-sm mt-0.5">
                Coincidencia 100% exacta por número de factura o alias aprendido validado.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={handleBulkApprove}
              className="w-full sm:w-auto px-4 py-2 bg-white dark:bg-slate-800 text-blue-700 hover:bg-blue-50 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Aprobar Todos ({autoMatches.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('reconciliation')}
              className="px-3 py-2 bg-blue-500/30 hover:bg-blue-500/50 text-white font-medium text-xs sm:text-sm rounded-xl transition-colors"
            >
              Revisar Detalle
            </button>
          </div>
        </div>
      )}

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Por conciliar en banco */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Por Conciliar (Banco)</span>
            <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Banknote className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {company.currencySymbol} {totalBankPendingAmount.toLocaleString('es-UY')}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center">
              <span className="font-semibold text-amber-600 dark:text-amber-400 mr-1">{totalBankPendingCount} movimientos</span>
              en extractos actuales
            </p>
          </div>
        </div>

        {/* KPI 2: Cuentas por cobrar pendientes */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cartera Pendiente (Facturas)</span>
            <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {company.currencySymbol} {totalPendingInvoicesAmount.toLocaleString('es-UY')}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center">
              <span className="font-semibold text-blue-600 dark:text-blue-400 mr-1">{pendingInvoicesCount} facturas</span>
              abiertas de {totalInvoicesCount} totales
            </p>
          </div>
        </div>

        {/* KPI 3: Sugerencias & Certeza */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Efectividad del Cruce</span>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Percent className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {bankMovements.length > 0
                ? (() => {
                    // Movements actually reconciled (confirmed), not merely "has a suggestion" —
                    // a 54%-confidence guess that nobody accepted yet shouldn't count as "effective".
                    const atRisk = bankMovements.length - yaConciliadoMatches.length;
                    return atRisk > 0
                      ? `${Math.round((reconciledMatches.length / atRisk) * 100)}%`
                      : '100%';
                  })()
                : '100%'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 mr-1">{autoMatches.length + suggestedMatches.length} sugerencias</span>
              de {bankMovements.length - yaConciliadoMatches.length} en evaluación
            </p>
          </div>
        </div>

        {/* KPI 4: Saldos a favor & Alias */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Saldos a Favor / Créditos</span>
            <div className="h-9 w-9 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Coins className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {company.currencySymbol} {totalCreditsAmount.toLocaleString('es-UY')}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center">
              <span className="font-semibold text-purple-600 dark:text-purple-400 mr-1">{learnedAliases.length} alias</span>
              aprendidos en memoria
            </p>
          </div>
        </div>
      </div>

      {/* Visual Analytics & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Receivables Top Clients */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Top Clientes con Saldo Deudor</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Cuentas corrientes con mayor saldo pendiente de cobro</p>
            </div>
            <button
              onClick={() => setActiveTab('statements')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center space-x-1"
            >
              <span>Ver Cuentas Corrientes</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: '#334155' }} />
                <Tooltip
                  formatter={(value: any) => [`$${Number(value).toLocaleString('es-UY')}`, 'Saldo Pendiente']}
                  labelFormatter={(label) => `Cliente: ${label}`}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', borderColor: '#e2e8f0', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="saldo" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 1 Col: Status Distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Estado del Extracto Actual</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Distribución de los movimientos bancarios</p>

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
                <span className="text-xl font-bold text-slate-900 dark:text-white">{bankMovements.length}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase">Movimientos</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-2 pt-3 border-t border-slate-100">
            {statusChartData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 dark:text-slate-400 font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Action Hub */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => setActiveTab('reconciliation')}
          className="group bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700 hover:border-blue-400 hover:shadow-md transition-all text-left flex items-start space-x-4"
        >
          <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 transition-colors">Bandeja de Conciliación</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Revisa sugerencias inteligentes y asigna pagos dudosos en segundos.</p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('upload')}
          className="group bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700 hover:border-blue-400 hover:shadow-md transition-all text-left flex items-start space-x-4"
        >
          <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0">
            <UploadCloud className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white text-sm group-hover:text-indigo-600 transition-colors">Carga de Archivos</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sube el listado de facturas y el extracto bancario en Excel o CSV.</p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('statements')}
          className="group bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700 hover:border-blue-400 hover:shadow-md transition-all text-left flex items-start space-x-4"
        >
          <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white text-sm group-hover:text-emerald-600 transition-colors">Cuentas Corrientes</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Consulta estados de cuenta por cliente, saldos y créditos a favor.</p>
          </div>
        </button>
      </div>
    </div>
  );
};
