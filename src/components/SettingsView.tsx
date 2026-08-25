import React, { useState } from 'react';
import {
  Building2,
  CheckCircle,
  Download,
  Percent,
  RotateCcw,
  Save,
  Settings,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
  DollarSign,
  Mail,
  CreditCard,
  X,
  AlertTriangle
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

  // In-app confirmation modal states
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Configuración del Sistema</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Parámetros de la empresa, tipo de cambio bimonetario (USD/UYU), sensibilidad del motor determinístico y copias de seguridad.
        </p>
      </div>

      {savedMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs flex items-center space-x-2">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>¡Configuración guardada exitosamente! Recalculando coincidencias y tasas de cambio...</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Building2 className="h-4 w-4 text-blue-600" />
            <span>Datos de la Empresa & Remitente de Correo</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Razón Social *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">RUT / Identificación Tributaria *</label>
              <input
                type="text"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email de Cobranzas / Emisor de Notificaciones</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cobranzas@empresa.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono de Contacto</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+598 2900 0000"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Multi-currency & Exchange Rate */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span>Monedas y Tipo de Cambio Oficial (Bimonetario)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Moneda Principal por Defecto</label>
              <input
                type="text"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                placeholder="$ / UYU"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Cambio USD / UYU (Cotización)</label>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500">1 USD =</span>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={usdRate}
                  onChange={(e) => setUsdRate(parseFloat(e.target.value) || 42.5)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-slate-500">UYU</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Utilizado automáticamente por el motor de conciliación para emparejar facturas emitidas en Dólares (USD) pagadas mediante depósitos en Pesos (UYU) o viceversa.
          </p>
        </div>

        {/* Engine Sensitivity Slider */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-2">
              <Sliders className="h-4 w-4 text-blue-600" />
              <span>Sensibilidad del Motor de Matching</span>
            </h3>
            <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full">
              {autoMatchThreshold}% Umbral Automático
            </span>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min="75"
              max="99"
              value={autoMatchThreshold}
              onChange={(e) => setAutoMatchThreshold(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>75% (Más permisivo)</span>
              <span>90% (Recomendado - Equilibrio óptimo)</span>
              <span>99% (Solo 100% exactos)</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/60">
            Cualquier sugerencia con un porcentaje igual o mayor a este umbral se clasificará como <strong>100% Automática</strong> y podrá ser aprobada en lote con un solo clic.
          </p>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>Guardar Preferencias</span>
          </button>
        </div>
      </form>

      {/* Backup & Demo Management */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100">
          Gestión de Datos & Copia de Seguridad
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportBackupJSON}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors flex items-center space-x-1.5"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Exportar Backup Completo (JSON)</span>
          </button>

          <button
            onClick={() => setShowResetModal(true)}
            className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4 text-amber-600" />
            <span>Restablecer Datos Demo</span>
          </button>

          <button
            onClick={() => setShowClearModal(true)}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
            <span>Vaciar Base de Datos</span>
          </button>
        </div>
      </div>

      {/* In-app Reset Demo Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">¿Restablecer datos demo?</h3>
                  <p className="text-xs text-slate-500">Se restaurarán las facturas y extractos iniciales.</p>
                </div>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 my-4 bg-amber-50 border border-amber-200 p-3 rounded-xl">
              Esta acción restaurará el estado con los datos de prueba de importadora uruguaya (facturas pendientes, extractos bancarios y alias).
            </p>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  resetToDemo();
                  setShowResetModal(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs cursor-pointer"
              >
                Restablecer Ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-app Clear Database Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">¿Vaciar base de datos?</h3>
                  <p className="text-xs text-slate-500">Se borrarán todos los movimientos y facturas cargadas.</p>
                </div>
              </div>
              <button
                onClick={() => setShowClearModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 my-4 bg-red-50 border border-red-200 p-3 rounded-xl">
              ¿Estás completamente seguro? Esta acción eliminará todos los extractos bancarios, facturas, recibos y asientos generados en esta sesión.
            </p>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllData();
                  setShowClearModal(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs cursor-pointer"
              >
                Vaciar Base de Datos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
