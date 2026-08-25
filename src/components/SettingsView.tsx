import React, { useState } from 'react';
import {
  Building2,
  CheckCircle,
  Download,
  DollarSign,
  RotateCcw,
  Save,
  Settings,
  Sliders,
  Trash2,
  X,
  Shield,
  Database
} from 'lucide-react';
import { useConcilia } from '../context/ConciliaContext';

export const SettingsView: React.FC = () => {
  const {
    company,
    setCompany,
    setUsdExchangeRate,
    runMatchingEngine,
    resetToDemo,
    clearAllData,
    bankMovements,
    invoices,
    clients,
    learnedAliases,
    officialReceipts,
    accountingEntries,
    emailReminderLogs
  } = useConcilia();

  const [name, setName] = useState(company.name);
  const [rut, setRut] = useState(company.rut);
  const [email, setEmail] = useState(company.email || '');
  const [phone, setPhone] = useState(company.phone || '');
  const [currencySymbol, setCurrencySymbol] = useState(company.currencySymbol);
  const [usdRate, setUsdRate] = useState(company.usdExchangeRate || 42.5);
  const [autoMatchThreshold, setAutoMatchThreshold] = useState(company.autoMatchThreshold * 100);
  const [savedMsg, setSavedMsg] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setCompany(prev => ({
      ...prev,
      name,
      rut,
      email,
      phone,
      currencySymbol,
      usdExchangeRate: usdRate,
      autoMatchThreshold: autoMatchThreshold / 100
    }));
    setSavedMsg(true);
    setTimeout(() => {
      runMatchingEngine();
      setSavedMsg(false);
    }, 1500);
  };

  const handleExportBackupJSON = () => {
    const backup = {
      company,
      clients,
      invoices,
      bankMovements,
      learnedAliases,
      officialReceipts,
      accountingEntries,
      emailReminderLogs,
      exportedAt: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_conciliaya_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Configuración</h2>
          <p className="text-xs text-slate-500 mt-1">Parámetros del sistema, empresa y copias de seguridad.</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <Settings className="h-5 w-5 text-slate-500" />
        </div>
      </div>

      {/* Success Toast */}
      {savedMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs flex items-center space-x-2">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Configuración guardada. Recalculando coincidencias...</span>
        </div>
      )}

      {/* Company Info Card */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center space-x-3">
          <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Empresa</h3>
            <p className="text-[11px] text-slate-500">Datos de identificación fiscal y contacto</p>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Razón Social</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">RUT</label>
              <input
                type="text"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email de Cobranzas</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cobranzas@empresa.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Teléfono</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+598 2900 0000"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Currency Section */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2 mb-4">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Monedas y Tipo de Cambio</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Moneda Principal</label>
              <input
                type="text"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                placeholder="$ / UYU"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Cotización USD / UYU</label>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 whitespace-nowrap">1 USD =</span>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={usdRate}
                  onChange={(e) => setUsdRate(parseFloat(e.target.value) || 42.5)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <span className="text-xs text-slate-500">UYU</span>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 bg-white p-2.5 rounded-lg border border-slate-200/60">
            El motor de conciliación usa esta tasa para emparejar facturas en USD con pagos en UYU y viceversa.
          </p>
        </div>

        {/* Sensitivity Section */}
        <div className="px-6 py-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Sliders className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Sensibilidad del Motor</span>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
              {autoMatchThreshold}%
            </span>
          </div>

          <input
            type="range"
            min="75"
            max="99"
            value={autoMatchThreshold}
            onChange={(e) => setAutoMatchThreshold(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 px-0.5">
            <span>75% Permiso</span>
            <span className="text-slate-500 font-medium">90% Recomendado</span>
            <span>99% Solo exactos</span>
          </div>

          <p className="text-[11px] text-slate-500 mt-3 bg-blue-50 p-2.5 rounded-lg border border-blue-100">
            Coincidencias con certeza ≥ a este umbral se aprueban automáticamente con 1 clic.
          </p>
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>Guardar Cambios</span>
          </button>
        </div>
      </form>

      {/* Data Management Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center space-x-3">
          <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Datos y Respaldo</h3>
            <p className="text-[11px] text-slate-500">Exportar información o restablecer el sistema</p>
          </div>
        </div>

        <div className="p-6 space-y-3">
          <button
            onClick={handleExportBackupJSON}
            className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center space-x-3 group"
          >
            <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 group-hover:border-slate-300 flex items-center justify-center shrink-0">
              <Download className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Exportar Backup</p>
              <p className="text-[11px] text-slate-500">Descarga un archivo JSON con todos los datos de la sesión</p>
            </div>
          </button>

          <button
            onClick={() => setShowResetModal(true)}
            className="w-full text-left px-4 py-3 bg-amber-50/50 hover:bg-amber-50 border border-amber-200/60 rounded-xl transition-colors flex items-center space-x-3 group"
          >
            <div className="h-9 w-9 rounded-lg bg-white border border-amber-200 group-hover:border-amber-300 flex items-center justify-center shrink-0">
              <RotateCcw className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Restablecer Demo</p>
              <p className="text-[11px] text-slate-500">Carga datos de ejemplo para probar el sistema</p>
            </div>
          </button>

          <button
            onClick={() => setShowClearModal(true)}
            className="w-full text-left px-4 py-3 bg-red-50/50 hover:bg-red-50 border border-red-200/60 rounded-xl transition-colors flex items-center space-x-3 group"
          >
            <div className="h-9 w-9 rounded-lg bg-white border border-red-200 group-hover:border-red-300 flex items-center justify-center shrink-0">
              <Trash2 className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Vaciar Todo</p>
              <p className="text-[11px] text-slate-500">Elimina todos los datos cargados en esta sesión</p>
            </div>
          </button>
        </div>
      </div>

      {/* Modals */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Restablecer Demo</h3>
                  <p className="text-xs text-slate-500">Se cargarán datos de ejemplo</p>
                </div>
              </div>
              <button onClick={() => setShowResetModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 my-4 bg-amber-50 border border-amber-200 p-3 rounded-xl">
              Se restaurarán facturas, extractos y alias de ejemplo de una importadora uruguaya.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button onClick={() => setShowResetModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl">
                Cancelar
              </button>
              <button
                onClick={() => { resetToDemo(); setShowResetModal(false); }}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs"
              >
                Restablecer
              </button>
            </div>
          </div>
        </div>
      )}

      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Vaciar Base de Datos</h3>
                  <p className="text-xs text-slate-500">Se eliminarán todos los datos</p>
                </div>
              </div>
              <button onClick={() => setShowClearModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 my-4 bg-red-50 border border-red-200 p-3 rounded-xl">
              Esta acción es irreversible. Se borrarán todos los movimientos, facturas, recibos y asientos generados.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button onClick={() => setShowClearModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl">
                Cancelar
              </button>
              <button
                onClick={() => { clearAllData(); setShowClearModal(false); }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs"
              >
                Vaciar Todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
